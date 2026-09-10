import { expect, it } from "vitest";
import { mergeContent } from "../../apps/web/merge-content";
import { SaveCoordinator } from "../../apps/web/save-coordinator";
import type { Document } from "../../packages/document-schema/index";
const base = {
  title: "Base",
  blocks: [
    { id: "a", type: "paragraph", content: [] },
    { id: "b", type: "paragraph", content: [] },
  ],
};
const doc = {
  ...base,
  id: "doc",
  revision: 1,
  schemaVersion: 1,
  parentId: null,
  position: "a0",
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
} as Document;
it("merges separate blocks but refuses overlapping edits and reorder collisions", () => {
  const local = structuredClone(base),
    remote = structuredClone(base);
  local.blocks[0].type = "quote";
  remote.blocks[1].type = "heading";
  expect(
    mergeContent(base, local, remote).content.blocks.map((b) => b.type),
  ).toEqual(["quote", "heading"]);
  remote.blocks[0].type = "heading";
  expect(mergeContent(base, local, remote).conflicts).toEqual(["block a"]);
  remote.blocks.reverse();
  expect(mergeContent(base, local, remote).conflicts).toContain("blocks");
});
it("legacy stale recovery always explains the conflict and can use server after archiving", async () => {
  const archives: unknown[] = [];
  const c = new SaveCoordinator(
    { ...doc, revision: 2 },
    {
      checkpoint: async () => {},
      changed: () => {},
      load: async () => ({ ...doc, revision: 2 }),
      archive: async (d) => {
        archives.push(d);
      },
      save: async (revision, content) => ({
        ...doc,
        ...content,
        revision: revision + 1,
      }),
    },
  );
  try {
    c.recover({
      content: { ...base, title: "Recovered" },
      revision: 1,
      generation: 2,
    });
    expect(c.error).toContain("older revision");
    await c.review();
    expect(c.status).toBe("Conflict");
    await c.resolve("server");
    expect(c.status).toBe("Saved");
    expect(c.content.title).toBe("Base");
    expect((archives[0] as any).content.title).toBe("Recovered");
  } finally {
    c.dispose();
  }
});
it("conflict resolution replaces rejected mutation and uses reviewed revision", async () => {
  const calls: any[] = [];
  const c = new SaveCoordinator(doc, {
    checkpoint: async () => {},
    changed: () => {},
    load: async () => ({ ...doc, title: "Remote", revision: 2 }),
    save: async (revision, content, id) => {
      calls.push({ revision, content, id });
      if (revision === 1)
        throw Object.assign(new Error("Conflict"), { status: 412 });
      return { ...doc, ...content, revision: 3 };
    },
  });
  try {
    c.edit({ ...base, title: "Local" });
    await c.flush();
    expect(c.status).toBe("Conflict");
    await c.resolve("local");
    expect(c.status).toBe("Saved");
    expect(calls[1].revision).toBe(2);
    expect(calls[1].id).not.toBe(calls[0].id);
    expect(calls[1].content.title).toBe("Local");
  } finally {
    c.dispose();
  }
});
it("automatically rebases independent title and body changes after a 412", async () => {
  const remote = {
    ...doc,
    revision: 2,
    blocks: [
      { id: "a", type: "quote", content: [] },
      { id: "b", type: "paragraph", content: [] },
    ],
  };
  const c = new SaveCoordinator(doc, {
    checkpoint: async () => {},
    changed: () => {},
    load: async () => remote,
    save: async (revision, content) => {
      if (revision === 1)
        throw Object.assign(new Error("Conflict"), { status: 412 });
      return { ...remote, ...content, revision: 3 };
    },
  });
  try {
    c.edit({ ...base, title: "Local" });
    await c.flush();
    expect(c.status).toBe("Saved");
    expect(c.content.title).toBe("Local");
    expect(c.content.blocks[0].type).toBe("quote");
  } finally {
    c.dispose();
  }
});
it("preserves conflict state if archiving fails", async () => {
  const c = new SaveCoordinator(doc, {
    checkpoint: async () => {},
    changed: () => {},
    load: async () => ({ ...doc, revision: 2, title: "Remote" }),
    archive: async () => {
      throw new Error("Quota exceeded");
    },
    save: async () => {
      throw new Error("Must not save");
    },
  });
  try {
    c.recover({
      content: { ...base, title: "Local" },
      revision: 0,
      generation: 1,
    });
    await c.review();
    await expect(c.resolve("server")).rejects.toThrow("Quota exceeded");
    expect(c.content.title).toBe("Local");
    expect(c.status).toBe("Conflict");
  } finally {
    c.dispose();
  }
});
it("requires another review when a writer changes the server during resolution", async () => {
  let revision = 2;
  const c = new SaveCoordinator(doc, {
    checkpoint: async () => {},
    changed: () => {},
    load: async () => ({ ...doc, title: `Remote ${revision}`, revision }),
    save: async () => {
      throw Object.assign(new Error("Changed again"), { status: 412 });
    },
  });
  try {
    c.edit({ ...base, title: "Local" });
    await c.flush();
    revision = 3;
    await c.resolve("local");
    expect(c.status).toBe("Conflict");
    expect(c.content.title).toBe("Local");
    await c.review();
    expect(c.remote?.revision).toBe(3);
  } finally {
    c.dispose();
  }
});
