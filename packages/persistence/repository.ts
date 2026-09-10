import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import lockfile from "proper-lockfile";
import { generateKeyBetween } from "fractional-indexing";
import {
  AppError,
  contentSchema,
  emptyBlock,
  idSchema,
  type Content,
  type Document,
  type TreeNode,
} from "../document-schema/index";

type Manifest = {
  schemaVersion: 1;
  documents: Record<string, number>;
  receipts: Record<string, { digest: string; ids: string[] }>;
};
export type FaultStage =
  "afterWrite" | "afterSync" | "afterRename" | "beforeManifest";
export class Repository {
  private docs = new Map<string, Document>();
  private manifest: Manifest = {
    schemaVersion: 1,
    documents: {},
    receipts: {},
  };
  private tail: Promise<unknown> = Promise.resolve();
  private release?: () => Promise<void>;
  constructor(
    public root: string,
    private fault?: (stage: FaultStage) => void,
  ) {
    this.root = path.resolve(root);
  }
  async init() {
    await fs.mkdir(this.root, { recursive: true });
    if ((await fs.lstat(this.root)).isSymbolicLink())
      throw new Error("Workspace cannot be a symlink");
    this.release = await lockfile.lock(this.root, {
      realpath: true,
      stale: 10000,
      update: 2000,
      retries: 0,
    });
    try {
      for (const dir of ["documents", "assets"]) {
        const target = path.join(this.root, dir);
        await fs.mkdir(target, { recursive: true });
        if ((await fs.lstat(target)).isSymbolicLink())
          throw new Error("Storage directories cannot be symlinks");
      }
      try {
        if (
          (
            await fs.lstat(path.join(this.root, "workspace.json"))
          ).isSymbolicLink()
        )
          throw new Error("Manifest cannot be a symlink");
        this.manifest = JSON.parse(
          await fs.readFile(path.join(this.root, "workspace.json"), "utf8"),
        );
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
        await this.atomic(
          path.join(this.root, "workspace.json"),
          JSON.stringify(this.manifest),
        );
      }
      if (
        this.manifest.schemaVersion !== 1 ||
        !this.manifest.documents ||
        !this.manifest.receipts
      )
        throw new Error("Unsupported or corrupt workspace manifest");
      for (const [id, revision] of Object.entries(this.manifest.documents)) {
        idSchema.parse(id);
        if (!Number.isSafeInteger(revision) || revision < 1)
          throw new Error("Invalid revision");
        if ((await fs.lstat(this.documentPath(id, revision))).isSymbolicLink())
          throw new Error("Document cannot be a symlink");
        const doc: Document = JSON.parse(
          await fs.readFile(this.documentPath(id, revision), "utf8"),
        );
        if (
          doc.schemaVersion !== 1 ||
          doc.id !== id ||
          doc.revision !== revision
        )
          throw new Error("Corrupt document envelope");
        contentSchema.parse(doc);
        this.docs.set(id, doc);
      }
      for (const doc of this.docs.values()) {
        const seen = new Set([doc.id]);
        let parent = doc.parentId;
        while (parent) {
          if (seen.has(parent) || !this.docs.has(parent))
            throw new Error("Corrupt hierarchy");
          seen.add(parent);
          parent = this.docs.get(parent)!.parentId;
        }
      }
    } catch (error) {
      await this.release();
      this.release = undefined;
      throw error;
    }
    return this;
  }
  async close() {
    await this.tail;
    await this.release?.();
    this.release = undefined;
  }
  private documentPath(id: string, revision: number) {
    return path.join(this.root, "documents", `${id}.${revision}.json`);
  }
  private queue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn);
    this.tail = next.catch(() => {});
    return next;
  }
  private async atomic(file: string, bytes: string | Buffer) {
    const temp = `${file}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await fs.open(temp, "wx", 0o600);
      await handle.writeFile(bytes);
      this.fault?.("afterWrite");
      await handle.sync();
      this.fault?.("afterSync");
      await handle.close();
      handle = undefined;
      await fs.rename(temp, file);
      this.fault?.("afterRename");
      const dir = await fs.open(path.dirname(file), "r");
      try {
        await dir.sync();
      } finally {
        await dir.close();
      }
    } finally {
      await handle?.close();
      await fs.unlink(temp).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    }
  }
  private async commit(
    changes: Document[],
    receipt?: { id: string; digest: string },
  ) {
    const next = structuredClone(this.manifest);
    for (let offset = 0; offset < changes.length; offset += 8) {
      const batch = changes.slice(offset, offset + 8);
      const results = await Promise.allSettled(
        batch.map((doc) =>
          this.atomic(
            this.documentPath(doc.id, doc.revision),
            JSON.stringify(doc),
          ),
        ),
      );
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      for (const doc of batch) next.documents[doc.id] = doc.revision;
    }
    if (receipt)
      next.receipts[receipt.id] = {
        digest: receipt.digest,
        ids: changes.map((d) => d.id),
      };
    this.fault?.("beforeManifest");
    try {
      await this.atomic(
        path.join(this.root, "workspace.json"),
        JSON.stringify(next),
      );
    } catch (error) {
      // A post-rename error has an uncertain durability result. Reconcile memory to the visible commit.
      const visible = JSON.parse(
        await fs.readFile(path.join(this.root, "workspace.json"), "utf8"),
      );
      if (JSON.stringify(visible) === JSON.stringify(next)) {
        this.manifest = next;
        for (const doc of changes) this.docs.set(doc.id, doc);
      }
      throw error;
    }
    this.manifest = next;
    for (const doc of changes) this.docs.set(doc.id, doc);
  }
  private replay(id: string, digest: string): Document[] | undefined {
    const receipt = this.manifest.receipts[id];
    if (!receipt) return;
    if (receipt.digest !== digest)
      throw new AppError(409, "Mutation ID was reused for different content");
    return receipt.ids.map((id) => this.get(id, true));
  }
  tree(): TreeNode[] {
    return [...this.docs.values()]
      .map(({ blocks: _blocks, ...doc }) => ({
        ...doc,
        hidden: this.hidden(doc.id),
      }))
      .sort((a, b) =>
        a.position < b.position
          ? -1
          : a.position > b.position
            ? 1
            : a.id.localeCompare(b.id),
      );
  }
  treeTag() {
    return digest(this.tree());
  }
  hidden(id: string): boolean {
    let doc = this.docs.get(id);
    const seen = new Set<string>();
    while (doc) {
      if (doc.deletedAt || seen.has(doc.id)) return true;
      seen.add(doc.id);
      doc = doc.parentId ? this.docs.get(doc.parentId) : undefined;
    }
    return false;
  }
  get(id: string, includeHidden = false): Document {
    const doc = this.docs.get(id);
    if (!doc) throw new AppError(404, "Page not found");
    if (!includeHidden && this.hidden(id))
      throw new AppError(409, "Page is in trash");
    return structuredClone(doc);
  }
  private parent(parentId: string | null) {
    if (parentId) this.get(parentId);
  }
  private rank(parentId: string | null, beforeId?: string, excluding?: string) {
    const siblings = this.tree().filter(
      (d) => d.parentId === parentId && !d.hidden && d.id !== excluding,
    );
    const index = beforeId
      ? siblings.findIndex((d) => d.id === beforeId)
      : siblings.length;
    if (index < 0) throw new AppError(400, "Invalid destination");
    return generateKeyBetween(
      siblings[index - 1]?.position ?? null,
      siblings[index]?.position ?? null,
    );
  }
  create(title: string, parentId: string | null, mutationId: string) {
    return this.queue(async () => {
      const hash = digest({ title, parentId });
      const existing = this.replay(mutationId, hash);
      if (existing) return existing[0];
      this.parent(parentId);
      const now = new Date().toISOString();
      const doc: Document = {
        schemaVersion: 1,
        id: randomUUID(),
        title,
        icon: "📄",
        blocks: [emptyBlock()],
        parentId,
        position: this.rank(parentId),
        revision: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      contentSchema.parse(doc);
      await this.commit([doc], { id: mutationId, digest: hash });
      return structuredClone(doc);
    });
  }
  save(id: string, revision: number, content: Content, mutationId: string) {
    return this.queue(async () => {
      contentSchema.parse(content);
      const current = this.get(id);
      const hash = digest(content);
      if (current.lastMutationId === mutationId) {
        if (current.lastMutationDigest !== hash)
          throw new AppError(409, "Mutation ID reused");
        return current;
      }
      if (current.revision !== revision)
        throw new AppError(
          412,
          "This page changed elsewhere. Your draft is preserved.",
        );
      const next = {
        ...current,
        ...content,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
        lastMutationId: mutationId,
        lastMutationDigest: hash,
      };
      await this.commit([next]);
      return structuredClone(next);
    });
  }
  mutate(
    id: string,
    revision: number,
    action: "move" | "trash" | "restore",
    options: {
      parentId?: string | null;
      beforeId?: string;
      treeTag?: string;
    } = {},
  ) {
    return this.queue(async () => {
      const current = this.get(id, true);
      if (current.revision !== revision)
        throw new AppError(412, "Page changed. Refresh and try again.");
      const next = {
        ...current,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      if (action === "move") {
        this.get(id);
        if (options.treeTag !== this.treeTag())
          throw new AppError(412, "Hierarchy changed. Refresh and try again.");
        const parentId = options.parentId ?? null;
        this.parent(parentId);
        let ancestor = parentId;
        while (ancestor) {
          if (ancestor === id)
            throw new AppError(
              400,
              "A page cannot be moved into itself or its descendants",
            );
          ancestor = this.docs.get(ancestor)!.parentId;
        }
        next.parentId = parentId;
        next.position = this.rank(parentId, options.beforeId, id);
      } else if (action === "trash") {
        this.get(id);
        next.deletedAt = new Date().toISOString();
      } else {
        if (current.parentId && this.hidden(current.parentId))
          throw new AppError(409, "Restore the parent page first");
        next.deletedAt = null;
      }
      // Content replay identities apply only to the revision that accepted them.
      delete next.lastMutationId;
      delete next.lastMutationDigest;
      await this.commit([next]);
      return structuredClone(next);
    });
  }
  importDocuments(
    input: {
      key: string;
      parentKey: string | null;
      title: string;
      icon?: string;
      linkPreviews?: Document['linkPreviews'];
      blocks: Document["blocks"];
      sourcePath?: string;
    }[],
    mutationId: string,
    rewrite?: (
      blocks: Document["blocks"],
      ids: Map<string, string>,
    ) => Document["blocks"],
  ) {
    return this.queue(async () => {
      const hash = digest(input);
      const replay = this.replay(mutationId, hash);
      if (replay) return replay;
      const ids = new Map(input.map((d) => [d.key, randomUUID()]));
      if (ids.size !== input.length)
        throw new AppError(400, "Duplicate import key");
      const now = new Date().toISOString();
      const ranks = new Map<string | null, string>();
      ranks.set(null, this.rank(null));
      const docs = input.map((item) => {
        const parentId = item.parentKey ? ids.get(item.parentKey) : null;
        if (parentId === undefined)
          throw new AppError(400, "Missing import parent");
        const previous = ranks.get(parentId) ?? null;
        const position = generateKeyBetween(previous, null);
        ranks.set(parentId, position);
        const doc: Document = {
          schemaVersion: 1,
          id: ids.get(item.key)!,
          title: item.title,
          icon: item.icon ?? "📄",
          linkPreviews: item.linkPreviews,
          blocks: rewrite
            ? rewrite(structuredClone(item.blocks), ids)
            : item.blocks,
          parentId,
          position,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          sourcePath: item.sourcePath,
        };
        contentSchema.parse(doc);
        return doc;
      });
      const lookup = new Map(docs.map((d) => [d.id, d]));
      for (const doc of docs) {
        let p = doc.parentId;
        const seen = new Set([doc.id]);
        while (p) {
          if (seen.has(p))
            throw new AppError(400, "Import hierarchy contains a cycle");
          seen.add(p);
          p = lookup.get(p)!.parentId;
        }
      }
      await this.commit(docs, { id: mutationId, digest: hash });
      return structuredClone(docs);
    });
  }
  async putAsset(bytes: Buffer, filename: string) {
    if (bytes.length > 20 * 1024 * 1024)
      throw new AppError(413, "Each attachment must be under 20 MB");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const ext = imageType(bytes) ?? "bin";
    const id = `${hash}.${ext}`;
    await this.queue(() =>
      this.atomic(path.join(this.root, "assets", id), bytes),
    );
    return {
      id,
      url: `/api/assets/${id}`,
      name: filename,
      image: ext !== "bin",
    };
  }
  async asset(id: string) {
    if (!/^[a-f0-9]{64}\.(png|jpg|gif|webp|bin)$/.test(id))
      throw new AppError(404, "Asset not found");
    const file = path.join(this.root, "assets", id);
    if ((await fs.lstat(file)).isSymbolicLink())
      throw new AppError(400, "Invalid asset");
    return fs.readFile(file);
  }
  snapshot() {
    return this.queue(async () =>
      [...this.docs.values()]
        .filter((d) => !this.hidden(d.id))
        .map((d) => structuredClone(d)),
    );
  }
}
export function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function imageType(bytes: Buffer) {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString())) return "gif";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "webp";
  return null;
}
