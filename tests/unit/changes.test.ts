import { describe, expect, it } from "vitest";
import type { Block, Document } from "../../packages/document-schema/index";
import {
  diffRevisions,
  groupChanges,
  type RevisionChange,
} from "../../packages/persistence/changes";
import { ChangeFeed } from "../../packages/persistence/change-feed";

const text = (value: string) => [{ type: "text", text: value, styles: {} }];
const para = (id: string, value: string, children?: Block[]): Block => ({
  id,
  type: "paragraph",
  content: text(value),
  ...(children ? { children } : {}),
});
function doc(
  id: string,
  revision: number,
  at: string,
  blocks: Block[],
  extra: Partial<Document> = {},
): Document {
  return {
    schemaVersion: 1,
    id,
    revision,
    title: "Page",
    blocks,
    parentId: null,
    position: "a0",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: at,
    deletedAt: null,
    ...extra,
  };
}

describe("diffRevisions", () => {
  it("reports a first revision as created with an excerpt", () => {
    const c = diffRevisions(
      null,
      doc("p", 1, "2026-10-01T09:00:00Z", [para("a", "Hello there")]),
    );
    expect(c.kinds).toEqual(["created"]);
    expect(c.added).toBe(1);
    expect(c.excerpt).toBe("Hello there");
  });

  it("counts added, removed and changed blocks, nested ones included", () => {
    const before = doc("p", 1, "2026-10-01T09:00:00Z", [
      para("a", "Keep"),
      para("b", "Old text", [para("b1", "child")]),
      para("c", "Gone"),
    ]);
    const after = doc("p", 2, "2026-10-01T09:05:00Z", [
      para("a", "Keep"),
      para("b", "New text", [para("b1", "child"), para("b2", "new child")]),
    ]);
    const c = diffRevisions(before, after);
    expect(c.kinds).toEqual(["edited"]);
    expect({ added: c.added, removed: c.removed, changed: c.changed }).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
    });
    expect(c.excerpt).toBe("New text"); // first changed/added block in document order
    expect(c.blockId).toBe("b"); // where the edit happened
  });

  it("recognises rename, move, trash and restore", () => {
    const base = doc("p", 1, "2026-10-01T09:00:00Z", [para("a", "x")]);
    expect(
      diffRevisions(base, { ...base, revision: 2, title: "New" }).kinds,
    ).toEqual(["renamed"]);
    expect(
      diffRevisions(base, { ...base, revision: 2, title: "New" }).titleFrom,
    ).toBe("Page");
    expect(
      diffRevisions(base, { ...base, revision: 2, parentId: "q" }).kinds,
    ).toEqual(["moved"]);
    const trashed = { ...base, revision: 2, deletedAt: "2026-10-01T10:00:00Z" };
    expect(diffRevisions(base, trashed).kinds).toEqual(["deleted"]);
    expect(diffRevisions(trashed, { ...base, revision: 3 }).kinds).toEqual([
      "restored",
    ]);
  });
});

describe("groupChanges", () => {
  const ev = (
    id: string,
    revision: number,
    at: string,
    over: Partial<RevisionChange> = {},
  ): RevisionChange => ({
    id,
    revision,
    at,
    title: id,
    kinds: ["edited"],
    added: 1,
    removed: 0,
    changed: 0,
    ...over,
  });
  it("merges a page's edits within the window into one sitting and keeps others apart", () => {
    const groups = groupChanges([
      ev("a", 5, "2026-10-01T10:50:00Z"),
      ev("b", 2, "2026-10-01T10:40:00Z"),
      ev("a", 4, "2026-10-01T10:30:00Z"),
      ev("a", 3, "2026-10-01T10:10:00Z", {
        kinds: ["renamed"],
        titleFrom: "Old",
      }),
      ev("a", 2, "2026-10-01T08:00:00Z"), // more than 30 minutes earlier: new sitting
    ]);
    expect(
      groups.map((g) => [g.id, g.edits, g.fromRevision, g.toRevision]),
    ).toEqual([
      ["a", 3, 3, 5],
      ["b", 1, 2, 2],
      ["a", 1, 2, 2],
    ]);
    expect(groups[0].kinds).toEqual(["renamed", "edited"]);
    expect(groups[0].titleFrom).toBe("Old");
    expect(groups[0].added).toBe(3);
    expect(groups[0].from).toBe("2026-10-01T10:10:00Z");
  });

  it("points a sitting at its newest edited block", () => {
    const groups = groupChanges([
      ev("a", 3, "2026-10-01T10:20:00Z", { kinds: ["renamed"] }), // newest: no block
      ev("a", 2, "2026-10-01T10:10:00Z", { blockId: "late" }),
      ev("a", 1, "2026-10-01T10:00:00Z", { blockId: "early" }),
    ]);
    expect(groups[0].blockId).toBe("late");
  });
});

describe("ChangeFeed", () => {
  // two pages, revisions interleaved in time; p2 rev 2 snapshot missing
  const store = new Map<string, Document>();
  const put = (d: Document) => store.set(`${d.id}:${d.revision}`, d);
  put(
    doc("p1", 1, "2026-10-01T08:00:00Z", [para("a", "one")], {
      title: "First",
    }),
  );
  put(
    doc("p1", 2, "2026-10-01T12:00:00Z", [para("a", "one"), para("b", "two")], {
      title: "First",
    }),
  );
  put(
    doc(
      "p1",
      3,
      "2026-10-02T09:00:00Z",
      [para("a", "one!"), para("b", "two")],
      { title: "First" },
    ),
  );
  put(doc("p2", 1, "2026-10-01T10:00:00Z", [], { title: "Second" }));
  put(
    doc("p2", 3, "2026-10-02T08:00:00Z", [para("c", "three")], {
      title: "Second",
    }),
  );
  let reads = 0;
  const feed = new ChangeFeed({
    heads: () => [store.get("p1:3")!, store.get("p2:3")!],
    read: async (id, revision) => {
      reads++;
      return store.get(`${id}:${revision}`) ?? null;
    },
    isDeleted: () => false,
  });

  it("merges all pages newest first and survives a missing snapshot", async () => {
    const page = await feed.page(10);
    expect(page.changes.map((g) => `${g.id}@${g.toRevision}`)).toEqual([
      "p1@3",
      "p2@3",
      "p1@2",
      "p2@1",
      "p1@1",
    ]);
    const p2 = page.changes[1];
    expect(p2.kinds).toEqual(["edited"]); // predecessor missing: no block counts
    expect(p2.added).toBe(0);
    expect(page.changes[0].changed).toBe(1);
    expect(page.next).toBeNull();
  });

  it("pages with a cursor and reuses cached snapshots", async () => {
    const first = await feed.page(2);
    expect(first.changes.map((g) => `${g.id}@${g.toRevision}`)).toEqual([
      "p1@3",
      "p2@3",
    ]);
    expect(first.next).toBe("2026-10-02T08:00:00Z");
    const before = reads;
    const second = await feed.page(10, first.next!);
    expect(second.changes.map((g) => `${g.id}@${g.toRevision}`)).toEqual([
      "p1@2",
      "p2@1",
      "p1@1",
    ]);
    expect(reads - before).toBeLessThanOrEqual(4);
  });
});
