import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { Repository } from "../../packages/persistence/repository";
import {
  importEntries,
  exportBundle,
  readZip,
  validatePath,
} from "../../packages/markdown/bundle";
let dir: string, repo: Repository;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-import-"));
  repo = await new Repository(dir).init();
});
afterEach(async () => {
  await repo.close();
  await fs.rm(dir, { recursive: true, force: true });
});
const entry = (path: string, source: string) => ({
  path,
  bytes: Buffer.from(source),
});
it("imports a whole nested folder, images and internal links", async () => {
  const result = await importEntries(
    repo,
    [
      entry(
        "Notes/index.md",
        "# Hello\n\n[Child](Research/topic.md)\n\n![image](assets/a.png)",
      ),
      entry(
        "Notes/Research/topic.md",
        "Some research\n\n```mermaid\ngraph TD\n A --> B\n```\n",
      ),
      {
        path: "Notes/assets/a.png",
        bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      },
    ],
    crypto.randomUUID(),
  );
  const notes = result.documents.find((d) => d.title === "Notes")!,
    research = result.documents.find((d) => d.title === "Research")!,
    topic = result.documents.find((d) => d.title === "topic")!;
  expect(research.parentId).toBe(notes.id);
  expect(topic.parentId).toBe(research.id);
  expect(
    topic.blocks.find((block) => block.type === "mermaid")?.props?.code,
  ).toBe("graph TD\n A --> B");
  expect(JSON.stringify(notes.blocks)).toContain(`#/page/${topic.id}`);
  expect(JSON.stringify(notes.blocks)).toContain("/api/assets/");
});
it.each(["lotion", "yestion"])("%s exact bundle restores image bytes and rich layout", async (format) => {
  const d = await repo.create("Original", null, crypto.randomUUID());
  const asset = await repo.putAsset(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    "x.png",
  );
  const saved = await repo.save(
    d.id,
    1,
    {
      title: "Original",
      icon: "🧭",
      linkPreviews: {
        "https://example.com": { title: "Preview title", image: asset.url },
      },
      blocks: [
        {
          id: "diagram",
          type: "mermaid",
          props: { code: "graph TD\n A --> B" },
          children: [],
        },
        {
          id: "img",
          type: "image",
          props: { url: asset.url, previewWidth: 321, caption: "hello" },
        },
      ],
    },
    crypto.randomUUID(),
  );
  const bundle = await exportBundle(repo);
  const entries = await readZip(bundle.bytes);
  const manifestEntry = entries.find(entry => entry.path.endsWith("manifest.json"))!;
  const manifest = JSON.parse(manifestEntry.bytes.toString());
  expect(manifest.format).toBe("lotion");
  manifest.format = format;
  manifestEntry.bytes = Buffer.from(JSON.stringify(manifest));
  const imported = await importEntries(repo, entries, crypto.randomUUID());
  expect(imported.documents).toHaveLength(1);
  expect(imported.documents[0].blocks).toEqual(saved.blocks);
  expect(imported.documents[0].icon).toBe("🧭");
  expect(imported.documents[0].linkPreviews).toEqual(saved.linkPreviews);
  expect(imported.documents[0].id).not.toBe(saved.id);
});
it("detects modified Markdown instead of silently selecting stale snapshots", async () => {
  await repo.create("Page", null, crypto.randomUUID());
  const entries = await readZip((await exportBundle(repo)).bytes);
  entries.find((e) => e.path.endsWith("/index.md"))!.bytes =
    Buffer.from("Edited outside");
  await expect(
    importEntries(repo, entries, crypto.randomUUID()),
  ).rejects.toMatchObject({ statusCode: 409 });
  const result = await importEntries(
    repo,
    entries,
    crypto.randomUUID(),
    "markdown",
  );
  expect(JSON.stringify(result.documents[0].blocks)).toContain(
    "Edited outside",
  );
});
it("preserves empty directory pages", async () => {
  const result = await importEntries(
    repo,
    [{ path: "Empty", bytes: Buffer.alloc(0), directory: true }],
    crypto.randomUUID(),
  );
  expect(result.documents[0].title).toBe("Empty");
  const restored = await importEntries(
    repo,
    await readZip((await exportBundle(repo)).bytes),
    crypto.randomUUID(),
  );
  expect(restored.documents[0].title).toBe("Empty");
});
it.each([
  "../escape.md",
  "/absolute.md",
  "folder/../escape.md",
  "C:\\escape.md",
  "folder\\file.md",
])("rejects unsafe path %s", (name) =>
  expect(() => validatePath(name)).toThrow(),
);
it("rejects duplicate case-folded names before import", async () => {
  await expect(
    importEntries(
      repo,
      [entry("A.md", "a"), entry("a.md", "b")],
      crypto.randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(repo.tree()).toHaveLength(0);
});
it("checks original ZIP paths before JSZip normalization", async () => {
  const zip = new JSZip();
  zip.file("../escape.md", "oops");
  await expect(
    readZip(await zip.generateAsync({ type: "nodebuffer" })),
  ).rejects.toMatchObject({ statusCode: 400 });
});
