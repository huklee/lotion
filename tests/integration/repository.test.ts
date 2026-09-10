import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Repository,
  type FaultStage,
} from "../../packages/persistence/repository";
let dir: string, repo: Repository;
let fail: FaultStage | undefined;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-test-"));
  repo = await new Repository(dir, (stage) => {
    if (stage === fail) throw new Error("Injected I/O failure");
  }).init();
});
afterEach(async () => {
  fail = undefined;
  await repo.close();
  await fs.rm(dir, { recursive: true, force: true });
});
const create = (title = "Page", parent: string | null = null) =>
  repo.create(title, parent, crypto.randomUUID());
it("restores a stopped full workspace backup including trash and asset bytes", async () => {
  const d = await create("Backed up"),
    asset = await repo.putAsset(Buffer.from("attachment"), "note.txt");
  await repo.mutate(d.id, 1, "trash");
  await repo.close();
  const restoredDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "lotion-restore-"),
  );
  try {
    await fs.cp(dir, restoredDir, { recursive: true });
    const restored = await new Repository(restoredDir).init();
    try {
      expect(restored.get(d.id, true).title).toBe("Backed up");
      expect(restored.hidden(d.id)).toBe(true);
      expect(await restored.asset(asset.id)).toEqual(Buffer.from("attachment"));
    } finally {
      await restored.close();
    }
  } finally {
    await fs.rm(restoredDir, { recursive: true, force: true });
  }
});
it("fails startup on a newer schema without replacing data", async () => {
  await create();
  await repo.close();
  const manifest = JSON.parse(
    await fs.readFile(path.join(dir, "workspace.json"), "utf8"),
  );
  manifest.schemaVersion = 99;
  await fs.writeFile(
    path.join(dir, "workspace.json"),
    JSON.stringify(manifest),
  );
  await expect(new Repository(dir).init()).rejects.toThrow("Unsupported");
  expect(
    JSON.parse(await fs.readFile(path.join(dir, "workspace.json"), "utf8"))
      .schemaVersion,
  ).toBe(99);
});
it("persists Unicode content and hierarchy across restart", async () => {
  const parent = await create("한글"),
    child = await create("Child", parent.id);
  await repo.save(
    child.id,
    1,
    {
      title: "Renamed",
      blocks: [
        {
          id: "b",
          type: "paragraph",
          content: [{ type: "text", text: "🙂", styles: {} }],
        },
      ],
    },
    crypto.randomUUID(),
  );
  await repo.close();
  repo = await new Repository(dir).init();
  expect(repo.get(child.id).title).toBe("Renamed");
  expect(repo.get(child.id).parentId).toBe(parent.id);
});
it("accepts one concurrent save and rejects the stale one", async () => {
  const d = await create();
  const results = await Promise.allSettled([
    repo.save(d.id, 1, { title: "A", blocks: d.blocks }, crypto.randomUUID()),
    repo.save(d.id, 1, { title: "B", blocks: d.blocks }, crypto.randomUUID()),
  ]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(repo.get(d.id).title).toBe("A");
});
it("recognizes retries after restart and rejects changed payload reuse", async () => {
  const d = await create(),
    id = crypto.randomUUID();
  await repo.save(d.id, 1, { title: "A", blocks: d.blocks }, id);
  await repo.close();
  repo = await new Repository(dir).init();
  expect(
    (await repo.save(d.id, 1, { title: "A", blocks: d.blocks }, id)).revision,
  ).toBe(2);
  await expect(
    repo.save(d.id, 1, { title: "B", blocks: d.blocks }, id),
  ).rejects.toMatchObject({ statusCode: 409 });
});
it("create retry does not duplicate pages", async () => {
  const id = crypto.randomUUID();
  const a = await repo.create("A", null, id),
    b = await repo.create("A", null, id);
  expect(a.id).toBe(b.id);
  expect(repo.tree()).toHaveLength(1);
});
it("refuses a second writer", async () => {
  await expect(new Repository(dir).init()).rejects.toMatchObject({
    code: "ELOCKED",
  });
});
it.each([
  "afterWrite",
  "afterSync",
  "afterRename",
  "beforeManifest",
] as FaultStage[])(
  "preserves previous commit when a snapshot fails at %s",
  async (stage) => {
    const d = await create("Original");
    fail = stage;
    await expect(
      repo.save(
        d.id,
        1,
        { title: "New", blocks: d.blocks },
        crypto.randomUUID(),
      ),
    ).rejects.toThrow();
    fail = undefined;
    await repo.close();
    repo = await new Repository(dir).init();
    expect(repo.get(d.id).title).toBe("Original");
  },
);
it("hides descendants and restores without clearing child tombstones", async () => {
  const p = await create(),
    child = await create("Child", p.id),
    other = await create("Other", p.id);
  await repo.mutate(child.id, 1, "trash");
  await repo.mutate(p.id, 1, "trash");
  expect(repo.tree().every((d) => d.hidden)).toBe(true);
  await expect(repo.mutate(child.id, 2, "restore")).rejects.toMatchObject({
    statusCode: 409,
  });
  await repo.mutate(p.id, 2, "restore");
  expect(repo.hidden(other.id)).toBe(false);
  expect(repo.hidden(child.id)).toBe(true);
});
it("rejects hierarchy cycles and stale tree operations", async () => {
  const p = await create(),
    child = await create("Child", p.id);
  await expect(
    repo.mutate(p.id, 1, "move", {
      parentId: child.id,
      treeTag: repo.treeTag(),
    }),
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(
    repo.mutate(child.id, 1, "move", { parentId: null, treeTag: "stale" }),
  ).rejects.toMatchObject({ statusCode: 412 });
});
it("commits an import tree atomically and idempotently", async () => {
  const input = [
    {
      key: "p",
      parentKey: null,
      title: "Parent",
      blocks: [{ id: "a", type: "paragraph" }],
    },
    {
      key: "c",
      parentKey: "p",
      title: "Child",
      blocks: [{ id: "b", type: "paragraph" }],
    },
  ];
  const id = crypto.randomUUID();
  fail = "beforeManifest";
  await expect(repo.importDocuments(input, id)).rejects.toThrow();
  expect(repo.tree()).toHaveLength(0);
  fail = undefined;
  const docs = await repo.importDocuments(input, id);
  expect(docs[1].parentId).toBe(docs[0].id);
  expect((await repo.importDocuments(input, id))[0].id).toBe(docs[0].id);
});
it("rejects an import cycle without publishing pages", async () => {
  await expect(
    repo.importDocuments(
      [
        {
          key: "a",
          parentKey: "b",
          title: "A",
          blocks: [{ id: "x", type: "paragraph" }],
        },
        {
          key: "b",
          parentKey: "a",
          title: "B",
          blocks: [{ id: "y", type: "paragraph" }],
        },
      ],
      crypto.randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(repo.tree()).toHaveLength(0);
});
it("deduplicates asset bytes and rejects traversal", async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const a = await repo.putAsset(png, "a.png"),
    b = await repo.putAsset(png, "b.png");
  expect(a.id).toBe(b.id);
  expect(await repo.asset(a.id)).toEqual(png);
  await expect(repo.asset("../workspace.json")).rejects.toMatchObject({
    statusCode: 404,
  });
});
