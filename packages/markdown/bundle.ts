import JSZip from "jszip";
import type { Readable } from "node:stream";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  AppError,
  type Block,
  type Document,
  type LinkPreview,
  emptyBlock,
} from "../document-schema/index";
import { Repository } from "../persistence/repository";
import { fromMarkdown, toMarkdown } from "./convert";
const MAX_TOTAL = 100 * 1024 * 1024;
export type Entry = { path: string; bytes: Buffer; directory?: boolean };
function hash(bytes: Buffer | string) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function validatePath(name: string) {
  if (
    !name ||
    name.length > 1000 ||
    name.includes("\\") ||
    name.startsWith("/") ||
    // eslint-disable-next-line no-control-regex -- reject control characters in untrusted archive names
    /[\u0000-\u001f:]/.test(name) ||
    name.split("/").some((p) => p === ".." || p === ".") ||
    name.split("/").length > 34
  )
    throw new AppError(400, "Unsafe or overly deep import path");
  return name.replace(/\/$/, "");
}
export async function readZip(bytes: Buffer): Promise<Entry[]> {
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files);
  if (entries.length > 5000)
    throw new AppError(413, "Too many files (maximum 5,000)");
  const result: Entry[] = [];
  let size = 0;
  for (const file of entries) {
    const original = (file as any).unsafeOriginalName ?? file.name;
    validatePath(original);
    if (((Number(file.unixPermissions) || 0) & 0o170000) === 0o120000)
      throw new AppError(400, "Symbolic links are not supported");
    // Check declared size before inflation, then enforce actual streamed output size.
    if (((file as any)._data?.uncompressedSize ?? 0) > MAX_TOTAL - size)
      throw new AppError(413, "Expanded import exceeds 100 MB");
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = file.nodeStream() as Readable;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_TOTAL) {
          stream.destroy();
          reject(new AppError(413, "Expanded import exceeds 100 MB"));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("error", reject);
      stream.on("end", resolve);
    });
    result.push({
      path: validatePath(original),
      bytes: Buffer.concat(chunks),
      directory: file.dir,
    });
  }
  return result;
}
function mapStrings(value: any, fn: (s: string) => string): any {
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        (key === "href" || key === "url") && typeof v === "string"
          ? fn(v)
          : mapStrings(v, fn),
      ]),
    );
  return value;
}
export async function exportBundle(
  repo: Repository,
  rootId?: string,
  portable = false,
) {
  let docs = await repo.snapshot();
  if (rootId) {
    const byId = new Map(docs.map((d) => [d.id, d]));
    docs = docs.filter((d) => {
      let current: Document | undefined = d;
      while (current) {
        if (current.id === rootId) return true;
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return false;
    });
    if (!docs.length) throw new AppError(404, "Page not found");
  }
  const zip = new JSZip(),
    paths = new Map<string, string>(),
    warnings: string[] = [];
  const byId = new Map(docs.map((d) => [d.id, d]));
  function filePath(d: Document): string {
    if (paths.has(d.id)) return paths.get(d.id)!;
    const name = (d.title || "Untitled")
      .normalize("NFC")
      .replace(/[^\p{L}\p{N} _-]/gu, "-")
      .slice(0, 70);
    const parent = d.parentId ? byId.get(d.parentId) : undefined;
    const location =
      (parent ? path.posix.dirname(filePath(parent)) + "/" : "") +
      `${name}--${d.id}/index.md`;
    paths.set(d.id, location);
    return location;
  }
  docs.forEach(filePath);
  const manifest: any = { format: "yestion", version: 1, documents: [] };
  const assets = new Set<string>();
  for (const doc of docs) {
    for (const preview of Object.values(doc.linkPreviews ?? {})) {
      if (preview.image) assets.add(preview.image.split('/').at(-1)!);
    }
    const file = paths.get(doc.id)!;
    const blocks = mapStrings(doc.blocks, (url) => {
      const asset = url.match(
        /^\/api\/assets\/([a-f0-9]{64}\.(?:png|jpg|gif|webp|bin))$/,
      );
      if (asset) {
        assets.add(asset[1]);
        return path.posix.relative(
          path.posix.dirname(file),
          `assets/${asset[1]}`,
        );
      }
      const link = url.match(/^#\/page\/([^#]+)(.*)$/);
      if (link && paths.has(link[1]))
        return (
          path.posix.relative(path.posix.dirname(file), paths.get(link[1])!) +
          link[2]
        );
      return url;
    });
    const output = toMarkdown(blocks);
    warnings.push(...output.warnings);
    zip.file(file, output.markdown);
    const snapshot = `.app/documents/${doc.id}.json`;
    if (!portable) zip.file(snapshot, JSON.stringify(doc));
    manifest.documents.push({
      id: doc.id,
      parentId: byId.has(doc.parentId ?? "") ? doc.parentId : null,
      title: doc.title,
      position: doc.position,
      path: file,
      snapshot: portable ? undefined : snapshot,
      markdownHash: hash(output.markdown),
    });
  }
  for (const asset of assets)
    zip.file(`assets/${asset}`, await repo.asset(asset));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "export-notes.txt",
    [...new Set(warnings)].join("\n") || "All supported content exported.",
  );
  return {
    bytes: await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    }),
    warnings: [...new Set(warnings)],
  };
}
export async function importEntries(
  repo: Repository,
  entries: Entry[],
  mutationId: string,
  mode: "auto" | "markdown" | "snapshot" = "auto",
) {
  if (
    entries.length > 5000 ||
    entries.reduce((n, e) => n + e.bytes.length, 0) > MAX_TOTAL
  )
    throw new AppError(413, "Import exceeds file or size limit");
  const files = new Map<string, Entry>(),
    folded = new Set<string>();
  for (const e of entries) {
    const key = validatePath(e.path).normalize("NFC");
    if (folded.has(key.toLowerCase()))
      throw new AppError(400, `Duplicate or case-colliding path: ${key}`);
    folded.add(key.toLowerCase());
    files.set(key, { ...e, path: key });
  }
  // Folder picker may wrap an exported bundle in its selected directory.
  const manifestPath =
    [...files.keys()].find((p) => p === "manifest.json") ??
    [...files.keys()].find(
      (p) => p.split("/").length === 2 && p.endsWith("/manifest.json"),
    );
  const prefix = manifestPath?.slice(0, -"manifest.json".length) ?? "";
  const manifest = manifestPath
    ? JSON.parse(files.get(manifestPath)!.bytes.toString("utf8"))
    : undefined;
  const warnings: string[] = [];
  let input: {
    key: string;
    parentKey: string | null;
    title: string;
    icon?: string;
    linkPreviews?: Record<string, LinkPreview>;
    blocks: Block[];
    sourcePath: string;
  }[] = [];
  const pathKeys = new Map<string, string>(),
    assetUrls = new Map<string, string>();
  for (const [name, e] of files)
    if (
      !e.directory &&
      !/\.md$/i.test(name) &&
      !name.includes(".app/") &&
      !name.endsWith("manifest.json") &&
      !name.endsWith("export-notes.txt")
    ) {
      const asset = await repo.putAsset(e.bytes, path.posix.basename(name));
      assetUrls.set(name, asset.url);
    }
  if (manifest?.format === "yestion") {
    if (
      manifest.version !== 1 ||
      !Array.isArray(manifest.documents) ||
      manifest.documents.length > 5000
    )
      throw new AppError(400, "Unsupported export manifest");
    const sorted = [...manifest.documents].sort((a, b) =>
      String(a.position).localeCompare(String(b.position)),
    );
    for (const item of sorted) {
      const mdPath = prefix + validatePath(item.path);
      const md = files.get(mdPath);
      if (!md) throw new AppError(400, `Missing Markdown: ${mdPath}`);
      const changed = hash(md.bytes) !== item.markdownHash;
      if (changed && item.snapshot && mode === "auto")
        throw new AppError(
          409,
          "Markdown was modified after export. Choose Markdown or exact snapshots.",
        );
      let blocks: Block[];
      let icon: string | undefined;
      let linkPreviews: Record<string, LinkPreview> | undefined;
      if (item.snapshot && mode !== "markdown") {
        const source = files.get(prefix + validatePath(item.snapshot));
        if (!source) throw new AppError(400, "Missing exact snapshot");
        const doc = JSON.parse(source.bytes.toString("utf8"));
        icon = doc.icon;
        linkPreviews = doc.linkPreviews;
        if (doc.schemaVersion !== 1)
          throw new AppError(400, "Unsupported snapshot schema");
        blocks = doc.blocks;
        blocks = mapStrings(blocks, (url) =>
          url.startsWith("/api/assets/")
            ? (assetUrls.get(prefix + "assets/" + url.split("/").at(-1)) ?? url)
            : url,
        );
      } else {
        const parsed = fromMarkdown(md.bytes.toString("utf8"));
        blocks = parsed.blocks;
        warnings.push(...parsed.warnings);
      }
      input.push({
        key: item.id,
        parentKey: item.parentId,
        title: String(item.title),
        icon,
        linkPreviews,
        blocks,
        sourcePath: mdPath,
      });
      pathKeys.set(mdPath, item.id);
    }
  } else {
    if (manifest)
      warnings.push(
        "Unrecognized manifest imported as ordinary Markdown folders",
      );
    const dirs = new Set<string>();
    for (const [name, e] of files) {
      let dir = e.directory ? name : path.posix.dirname(name);
      while (dir && dir !== ".") {
        dirs.add(dir);
        dir = path.posix.dirname(dir);
      }
    }
    for (const dir of [...dirs].sort(
      (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
    )) {
      const index = [...files.keys()].find(
        (p) => p.toLowerCase() === `${dir}/index.md`.toLowerCase(),
      );
      const parent = path.posix.dirname(dir);
      const parsed = index
        ? fromMarkdown(files.get(index)!.bytes.toString("utf8"))
        : { blocks: [emptyBlock()], warnings: [] };
      warnings.push(...parsed.warnings);
      const key = "dir:" + dir;
      input.push({
        key,
        parentKey: parent === "." ? null : "dir:" + parent,
        title: path.posix.basename(dir),
        blocks: parsed.blocks,
        sourcePath: index ?? dir + "/index.md",
      });
      if (index) pathKeys.set(index, key);
    }
    for (const [name, e] of files)
      if (!e.directory && /\.md$/i.test(name) && !pathKeys.has(name)) {
        const parsed = fromMarkdown(e.bytes.toString("utf8"));
        warnings.push(...parsed.warnings);
        const dir = path.posix.dirname(name),
          key = "file:" + name;
        input.push({
          key,
          parentKey: dir === "." ? null : "dir:" + dir,
          title: path.posix.basename(name).replace(/\.md$/i, ""),
          blocks: parsed.blocks,
          sourcePath: name,
        });
        pathKeys.set(name, key);
      }
    if (!input.length)
      throw new AppError(400, "No Markdown pages or folders found");
  }
  const referenced = new Set<string>();
  input = input.map((item) => ({
    ...item,
    blocks: mapStrings(item.blocks, (url) => {
      if (/^(https?:|mailto:|#|\/api\/assets\/)/.test(url)) return url;
      const [raw, fragment] = url.split("#");
      let decoded: string;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        decoded = raw;
      }
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(item.sourcePath), decoded),
      );
      if (assetUrls.has(resolved)) {
        referenced.add(resolved);
        return assetUrls.get(resolved)!;
      }
      if (pathKeys.has(resolved))
        return (
          "#/import/" +
          encodeURIComponent(pathKeys.get(resolved)!) +
          (fragment ? "#" + fragment : "")
        );
      warnings.push(`Unresolved link in ${item.sourcePath}: ${url}`);
      return url;
    }),
  }));
  if (!manifest?.format && assetUrls.size > referenced.size) {
    input.push({
      key: "attachments:" + mutationId,
      parentKey: null,
      title: "Imported attachments",
      sourcePath: "",
      blocks: [...assetUrls]
        .filter(([p]) => !referenced.has(p))
        .map(([name, url]) => ({
          id: crypto.randomUUID(),
          type: "file",
          props: { url, name: path.posix.basename(name) },
          children: [],
        })),
    });
  }
  const docs = await repo.importDocuments(input, mutationId, (blocks, ids) =>
    mapStrings(blocks, (url) => {
      const imported = url.match(/^#\/import\/([^#]+)(.*)$/);
      if (imported)
        return (
          "#/page/" + ids.get(decodeURIComponent(imported[1])) + imported[2]
        );
      const old = url.match(/^#\/page\/([^#]+)(.*)$/);
      return old && ids.has(old[1])
        ? "#/page/" + ids.get(old[1]) + old[2]
        : url;
    }),
  );
  return { documents: docs, warnings: [...new Set(warnings)] };
}
