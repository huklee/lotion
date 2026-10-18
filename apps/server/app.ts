import Fastify from "fastify";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { LinkPreviewService } from "./link-preview-service";
import { DEFAULT_PRESETS, type SummaryService } from "./summaries";
import type { NotificationService } from "./notifications";
import type { FavoritesStore } from "./favorites";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  readCookie,
  sessionCookie,
  type SessionStore,
} from "./sessions";
import { Repository } from "../../packages/persistence/repository";
import {
  AppError,
  contentSchema,
  idSchema,
  mutationSchema,
} from "../../packages/document-schema/index";
import {
  exportBundle,
  importEntries,
  readZip,
  type Entry,
} from "../../packages/markdown/bundle";

export async function createApp(
  repo: Repository,
  options: {
    token?: string;
    production?: boolean;
    summaries?: SummaryService;
    notifications?: NotificationService;
    sessions?: SessionStore;
    favorites?: FavoritesStore;
  } = {},
) {
  const app = Fastify({ bodyLimit: 12 * 1024 * 1024, logger: false });
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
      files: 5000,
      fields: 4,
      parts: 5004,
    },
  });
  app.setErrorHandler((error: any, _req, reply) =>
    reply
      .code(
        error instanceof z.ZodError
          ? 400
          : (error.statusCode ?? (error.code === "ENOENT" ? 404 : 500)),
      )
      .send({
        error:
          error instanceof z.ZodError
            ? "Invalid request: " +
              error.issues.map((i: any) => i.message).join("; ")
            : error.statusCode
              ? error.message
              : error.code === "ENOENT"
                ? "File not found"
                : "Storage operation failed. Your last committed data has been preserved.",
      }),
  );
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin")
      .header("X-Frame-Options", "DENY");
    if (req.url.startsWith("/api/")) {
      if (
        !options.token &&
        !["localhost", "127.0.0.1", "[::1]"].includes(
          new URL(`http://${req.headers.host}`).hostname,
        )
      )
        throw new AppError(403, "Untrusted Host header");
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host)
        throw new AppError(403, "Cross-origin request denied");
      if (req.headers["sec-fetch-site"] === "cross-site")
        throw new AppError(403, "Cross-site request denied");
      if (options.token) {
        const provided =
          req.headers.authorization?.replace(/^Bearer /, "") ?? "";
        const a = Buffer.from(provided),
          b = Buffer.from(options.token);
        const tokenOk = a.length === b.length && timingSafeEqual(a, b);
        // a browser session created by an earlier token check also counts
        const sessionOk =
          !tokenOk &&
          !!options.sessions &&
          (await options.sessions.verify(
            readCookie(req.headers.cookie, SESSION_COOKIE),
          ));
        if (!tokenOk && !sessionOk)
          throw new AppError(401, "Workspace token required");
        (req as any).viaToken = tokenOk;
      }
    }
  });
  const revision = (req: any) => {
    const value = Number(
      String(req.headers["if-match"] ?? "").replaceAll('"', ""),
    );
    if (!Number.isSafeInteger(value) || value < 1)
      throw new AppError(428, "A revision precondition is required");
    return value;
  };
  const id = (req: any) => idSchema.parse(req.params.id);
  let previewRequests = 0;
  const linkPreviews = new LinkPreviewService(repo);
  app.post("/api/link-preview", async (req) => {
    const { url } = z.object({ url: z.string().max(4096) }).parse(req.body);
    if (previewRequests >= 4)
      throw new AppError(429, "Preview service busy; try again");
    previewRequests++;
    try {
      return await linkPreviews.get(url, AbortSignal.timeout(10000));
    } finally {
      previewRequests--;
    }
  });
  app.get("/api/tree", async (_req, reply) => {
    reply.header("ETag", `"${repo.treeTag()}"`);
    return { nodes: repo.tree(), tag: repo.treeTag() };
  });
  app.get("/api/changes", async (req) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
        before: z.string().datetime({ offset: true }).optional(),
      })
      .parse(req.query);
    return repo.changes(query.limit, query.before);
  });
  app.get("/api/search", async (req, reply) => {
    const input = z
      .object({
        q: z.string().trim().min(1).max(200),
        limit: z.coerce.number().int().min(1).max(50).default(50),
        exclude: idSchema.optional(),
      })
      .parse(req.query);
    reply.header("Cache-Control", "no-store");
    return repo.search(input.q, input.limit, input.exclude);
  });
  const secureCookie = (req: any) =>
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(`http://${req.headers.host}`).hostname,
    ) || req.headers["x-forwarded-proto"] === "https";
  /** Trade the token (Authorization header) for a long-lived session cookie. */
  app.post("/api/session", async (req, reply) => {
    if (!options.token) return { authenticated: true, session: false };
    if (!options.sessions)
      throw new AppError(503, "Sessions are not configured on this server");
    if (!(req as any).viaToken)
      throw new AppError(401, "Workspace token required");
    const id = await options.sessions.create();
    reply.header(
      "Set-Cookie",
      sessionCookie(id, secureCookie(req), SESSION_DAYS),
    );
    return { authenticated: true, session: true, days: SESSION_DAYS };
  });
  app.get("/api/session", async () => ({ authenticated: true }));
  app.delete("/api/session", async (req, reply) => {
    await options.sessions?.revoke(
      readCookie(req.headers.cookie, SESSION_COOKIE),
    );
    reply.header("Set-Cookie", sessionCookie("", secureCookie(req), 0));
    return { authenticated: false };
  });
  const favorites = () => {
    if (!options.favorites)
      throw new AppError(503, "Favorites are not configured on this server");
    return options.favorites;
  };
  app.get("/api/favorites", async () => ({ ids: await favorites().list() }));
  app.put("/api/favorites/:id", async (req) => ({
    ids: await favorites().add(String((req.params as any).id)),
  }));
  app.delete("/api/favorites/:id", async (req) => ({
    ids: await favorites().remove(String((req.params as any).id)),
  }));
  const notifications = () => {
    if (!options.notifications)
      throw new AppError(
        503,
        "Notifications are not configured on this server",
      );
    return options.notifications;
  };
  app.get("/api/notifications", async (req) =>
    notifications().list(Number((req.query as any)?.limit) || 100),
  );
  app.post("/api/notifications", async (req, reply) => {
    reply.code(201);
    return notifications().add(req.body);
  });
  app.post("/api/notifications/seen", async (req) =>
    notifications().markSeen((req.body as any)?.at),
  );
  const summaries = () => {
    if (!options.summaries)
      throw new AppError(503, "Summaries are not configured on this server");
    return options.summaries;
  };
  app.get("/api/summary/settings", async () => summaries().settings());
  app.put("/api/summary/settings", async (req) =>
    summaries().saveSettings(req.body),
  );
  app.get("/api/summary/skills", async () => summaries().skills());
  app.get("/api/summary/default-presets", async () => DEFAULT_PRESETS);
  app.get("/api/summary/slack-channels", async () =>
    summaries().slackChannels(),
  );
  app.get("/api/summary/jobs", async () => summaries().list());
  app.post("/api/summary/jobs", async (req, reply) => {
    reply.code(202);
    return summaries().start(req.body);
  });
  app.get("/api/summary/jobs/:id", async (req) => {
    const job = summaries().get(String((req.params as any).id));
    if (!job) throw new AppError(404, "Summary job not found");
    return job;
  });
  app.get("/api/documents/:id", async (req, reply) => {
    const doc = repo.get(id(req));
    reply.header("ETag", `"${doc.revision}"`);
    return doc;
  });
  app.post("/api/documents", async (req, reply) => {
    const input = z
      .object({
        title: z.string().max(500).default("Untitled"),
        parentId: idSchema.nullable().default(null),
        mutationId: mutationSchema,
        linkParent: z.boolean().default(false),
      })
      .parse(req.body);
    reply.code(201);
    return repo.create(
      input.title,
      input.parentId,
      input.mutationId,
      input.linkParent,
    );
  });
  app.post("/api/documents/:id/copy", async (req, reply) => {
    const input = z.object({ mutationId: mutationSchema }).parse(req.body);
    reply.code(201);
    return repo.copy(id(req), revision(req), input.mutationId);
  });
  app.put("/api/documents/:id/content", async (req) => {
    const input = z
      .object({
        title: z.string(),
        icon: z.string().max(32).optional(),
        linkPreviews: contentSchema.shape.linkPreviews,
        blocks: z.array(z.any()),
        mutationId: mutationSchema,
      })
      .parse(req.body);
    const content = contentSchema.parse(input);
    return repo.save(id(req), revision(req), content, input.mutationId);
  });
  for (const action of ["move", "trash", "restore"] as const)
    app.post(`/api/documents/:id/${action}`, async (req) => {
      const input = z
        .object({
          parentId: idSchema.nullable().optional(),
          beforeId: idSchema.optional(),
          treeTag: z.string().optional(),
        })
        .parse(req.body ?? {});
      return repo.mutate(id(req), revision(req), action, input);
    });
  app.post("/api/assets", async (req) => {
    const file = await req.file({ limits: { fileSize: 20 * 1024 * 1024 } });
    if (!file) throw new AppError(400, "Choose a file");
    const bytes = await file.toBuffer();
    return repo.putAsset(bytes, file.filename);
  });
  app.get("/api/assets/:id", async (req, reply) => {
    const assetId = (req.params as any).id;
    const bytes = await repo.asset(assetId);
    const mime: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
    };
    const type = mime[assetId.split(".").at(-1)];
    reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .type(type ?? "application/octet-stream");
    if (!type) reply.header("Content-Disposition", "attachment");
    return bytes;
  });
  app.post("/api/imports", async (req) => {
    const entries: Entry[] = [];
    let total = 0;
    const query = z
      .object({
        mutationId: mutationSchema,
        mode: z.enum(["auto", "markdown", "snapshot"]).default("auto"),
      })
      .parse(req.query);
    for await (const part of req.parts()) {
      if (part.type !== "file") continue;
      const bytes = await part.toBuffer();
      total += bytes.length;
      if (total > 100 * 1024 * 1024)
        throw new AppError(413, "Import exceeds 100 MB");
      if (part.filename.toLowerCase().endsWith(".zip"))
        entries.push(...(await readZip(bytes)));
      else
        entries.push({
          path: decodeURIComponent(
            part.fieldname === "file" ? part.filename : part.fieldname,
          ),
          bytes,
          directory:
            [
              "application/x-lotion-directory",
              "application/x-yestion-directory",
            ].includes(part.mimetype) && bytes.length === 0,
        });
    }
    return importEntries(repo, entries, query.mutationId, query.mode);
  });
  app.post("/api/exports", async (req, reply) => {
    const input = z
      .object({
        rootId: idSchema.optional(),
        portable: z.boolean().default(false),
      })
      .parse(req.body ?? {});
    const bundle = await exportBundle(repo, input.rootId, input.portable);
    reply
      .type("application/zip")
      .header(
        "Content-Disposition",
        'attachment; filename="lotion-workspace.zip"',
      );
    return bundle.bytes;
  });
  if (options.production && existsSync(path.resolve("dist"))) {
    await app.register(staticFiles, { root: path.resolve("dist") });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: "Not found" })
        : reply.sendFile("index.html"),
    );
  }
  app.addHook("onClose", async () => repo.close());
  return app;
}
