import Fastify from "fastify";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fetchPublic, parsePreview } from "./link-preview";
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
  options: { token?: string; production?: boolean } = {},
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
        if (a.length !== b.length || !timingSafeEqual(a, b))
          throw new AppError(401, "Workspace token required");
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
  app.post('/api/link-preview', async (req) => {
    const { url } = z.object({ url: z.string().max(4096) }).parse(req.body);
    if (previewRequests >= 4) throw new AppError(429, 'Preview service busy; try again');
    previewRequests++;
    try {
      const signal = AbortSignal.timeout(10000);
      const page = await fetchPublic(url, 'html', signal);
      const metadata = parsePreview(page.bytes.toString('utf8'), page.url);
      let image: string | undefined;
      if (metadata.image) {
        try {
          const result = await fetchPublic(metadata.image, 'image', signal);
          const asset = await repo.putAsset(result.bytes, 'preview');
          if (asset.image) image = asset.url;
        } catch { /* A missing image must not prevent a usable title. */ }
      }
      return { title: metadata.title, description: metadata.description, image };
    } finally { previewRequests--; }
  });
  app.get("/api/tree", async (_req, reply) => {
    reply.header("ETag", `"${repo.treeTag()}"`);
    return { nodes: repo.tree(), tag: repo.treeTag() };
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
      })
      .parse(req.body);
    reply.code(201);
    return repo.create(input.title, input.parentId, input.mutationId);
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
            ["application/x-lotion-directory", "application/x-yestion-directory"].includes(part.mimetype) &&
            bytes.length === 0,
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
