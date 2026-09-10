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
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "yestion-api-"));
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
