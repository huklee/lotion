import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../apps/server/app";
import { Repository } from "../../packages/persistence/repository";
let dir: string, app: Awaited<ReturnType<typeof createApp>>;
it("rejects DNS-rebinding Host headers", async () => {
  expect(
    (
      await app.inject({
        url: "/api/tree",
        headers: { host: "attacker.example" },
      })
    ).statusCode,
  ).toBe(403);
});
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-api-"));
  app = await createApp(await new Repository(dir).init());
});
afterEach(async () => {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
});
it("creates/saves/loads through HTTP with required preconditions", async () => {
  const create = await app.inject({
    method: "POST",
    url: "/api/documents",
    payload: { title: "API", mutationId: crypto.randomUUID() },
  });
  expect(create.statusCode).toBe(201);
  const doc = create.json();
  expect(
    (
      await app.inject({
        method: "PUT",
        url: `/api/documents/${doc.id}/content`,
        payload: {
          title: "Updated",
          blocks: doc.blocks,
          mutationId: crypto.randomUUID(),
        },
      })
    ).statusCode,
  ).toBe(428);
  const save = await app.inject({
    method: "PUT",
    url: `/api/documents/${doc.id}/content`,
    headers: { "if-match": "1" },
    payload: {
      title: "Updated",
      blocks: doc.blocks,
      mutationId: crypto.randomUUID(),
    },
  });
  expect(save.statusCode).toBe(200);
  expect(
    (await app.inject({ url: `/api/documents/${doc.id}` })).json().title,
  ).toBe("Updated");
});
it("creates parent links and copies child pages through HTTP", async () => {
  const parent = (
    await app.inject({
      method: "POST",
      url: "/api/documents",
      payload: { title: "Parent", mutationId: crypto.randomUUID() },
    })
  ).json();
  const child = (
    await app.inject({
      method: "POST",
      url: "/api/documents",
      payload: {
        title: "Child",
        parentId: parent.id,
        linkParent: true,
        mutationId: crypto.randomUUID(),
      },
    })
  ).json();
  const copied = await app.inject({
    method: "POST",
    url: `/api/documents/${child.id}/copy`,
    headers: { "if-match": "1" },
    payload: { mutationId: crypto.randomUUID() },
  });
  expect(copied.statusCode).toBe(201);
  expect(copied.json()).toMatchObject({
    title: "Child (copy)",
    parentId: parent.id,
  });
  const updatedParent = (
    await app.inject({ url: `/api/documents/${parent.id}` })
  ).json();
  expect(JSON.stringify(updatedParent.blocks)).toContain(`#/page/${child.id}`);
  expect(JSON.stringify(updatedParent.blocks)).toContain(
    `#/page/${copied.json().id}`,
  );
});
it("searches indexed titles and block content with bounded input", async () => {
  const create = await app.inject({
    method: "POST",
    url: "/api/documents",
    payload: { title: "Indexed API page", mutationId: crypto.randomUUID() },
  });
  const doc = create.json();
  await app.inject({
    method: "PUT",
    url: `/api/documents/${doc.id}/content`,
    headers: { "if-match": "1" },
    payload: {
      title: doc.title,
      blocks: [
        {
          id: "api-search-block",
          type: "paragraph",
          content: [
            { type: "text", text: "Backend content needle", styles: {} },
          ],
        },
      ],
      mutationId: crypto.randomUUID(),
    },
  });

  const response = await app.inject({
    url: "/api/search?q=content%20needle&limit=10",
  });
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.json().results[0]).toMatchObject({
    documentId: doc.id,
    blockId: "api-search-block",
    field: "content",
  });
  expect(
    (
      await app.inject({
        url: `/api/search?q=content%20needle&exclude=${doc.id}`,
      })
    ).json().total,
  ).toBe(0);
  expect((await app.inject({ url: "/api/search?q=" })).statusCode).toBe(400);
  expect(
    (await app.inject({ url: "/api/search?q=x&limit=51" })).statusCode,
  ).toBe(400);
});
it("rejects cross-origin mutations", async () =>
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/documents",
        headers: { origin: "https://evil.example" },
        payload: { mutationId: crypto.randomUUID() },
      })
    ).statusCode,
  ).toBe(403));
it("protects both documents and assets with the workspace token", async () => {
  await app.close();
  app = await createApp(await new Repository(dir).init(), {
    token: "test-secret",
  });
  expect((await app.inject({ url: "/api/tree" })).statusCode).toBe(401);
  expect((await app.inject({ url: "/api/assets/x" })).statusCode).toBe(401);
  expect(
    (
      await app.inject({
        url: "/api/tree",
        headers: { authorization: "Bearer test-secret" },
      })
    ).statusCode,
  ).toBe(200);
});
it("rejects script URLs in stored blocks", async () => {
  const doc = (
    await app.inject({
      method: "POST",
      url: "/api/documents",
      payload: { mutationId: crypto.randomUUID() },
    })
  ).json();
  const response = await app.inject({
    method: "PUT",
    url: `/api/documents/${doc.id}/content`,
    headers: { "if-match": "1" },
    payload: {
      title: "Bad",
      blocks: [
        { id: "x", type: "image", props: { url: "javascript:alert(1)" } },
      ],
      mutationId: crypto.randomUUID(),
    },
  });
  expect(response.statusCode).toBe(400);
});

it("lists recent changes across pages: create, edit, rename, move, trash, restore", async () => {
  const post = (url: string, payload: object, revision?: number) =>
    app.inject({
      method: "POST",
      url,
      headers: revision ? { "if-match": String(revision) } : {},
      payload: { mutationId: crypto.randomUUID(), ...payload },
    });
  const a = (await post("/api/documents", { title: "Alpha" })).json();
  const b = (await post("/api/documents", { title: "Beta" })).json();
  const saved = await app.inject({
    method: "PUT",
    url: `/api/documents/${a.id}/content`,
    headers: { "if-match": "1" },
    payload: {
      title: "Alpha renamed",
      blocks: [
        {
          id: "blk-1",
          type: "paragraph",
          content: [{ type: "text", text: "First line", styles: {} }],
        },
      ],
      mutationId: crypto.randomUUID(),
    },
  });
  expect(saved.statusCode).toBe(200);
  const moved = await post(
    `/api/documents/${b.id}/move`,
    {
      parentId: a.id,
      treeTag: (await app.inject({ url: "/api/tree" })).json().tag,
    },
    1,
  );
  expect(moved.statusCode).toBe(200);
  const trashed = await post(`/api/documents/${b.id}/trash`, {}, 2);
  expect(trashed.statusCode).toBe(200);

  const res = await app.inject({ url: "/api/changes?limit=10" });
  expect(res.statusCode).toBe(200);
  const { changes } = res.json() as { changes: any[] };
  const forA = changes.find((c) => c.id === a.id);
  const forB = changes.find((c) => c.id === b.id);
  // everything happened within the grouping window → one sitting per page
  expect(forA.kinds).toEqual(
    expect.arrayContaining(["created", "renamed", "edited"]),
  );
  expect(forA.title).toBe("Alpha renamed");
  expect(forA.titleFrom).toBe("Alpha");
  // moving Beta under Alpha adds Beta's page link to Alpha: the newest excerpt shows it
  expect(forA.excerpt).toContain("Beta");
  expect(forA.edits).toBe(3);
  expect(forA.added).toBeGreaterThanOrEqual(2); // new page's default block, the saved line, the link
  expect(forB.kinds).toEqual(
    expect.arrayContaining(["created", "moved", "deleted"]),
  );
  expect(forB.deletedNow).toBe(true);

  const restored = await post(`/api/documents/${b.id}/restore`, {}, 3);
  expect(restored.statusCode).toBe(200);
  const again = (await app.inject({ url: "/api/changes" })).json() as {
    changes: any[];
  };
  const b2 = again.changes.find((c) => c.id === b.id);
  expect(b2.kinds).toContain("restored");
  expect(b2.deletedNow).toBe(false);

  expect((await app.inject({ url: "/api/changes?limit=0" })).statusCode).toBe(
    400,
  );
  expect(
    (await app.inject({ url: "/api/changes?before=yesterday" })).statusCode,
  ).toBe(400);
});
