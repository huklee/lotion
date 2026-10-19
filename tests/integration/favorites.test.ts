import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../apps/server/app";
import { FavoritesStore } from "../../apps/server/favorites";
import { Repository } from "../../packages/persistence/repository";

let dir: string;
let app: Awaited<ReturnType<typeof createApp>>;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-fav-"));
  app = await createApp(await new Repository(dir).init(), {
    favorites: new FavoritesStore(dir),
  });
});
afterEach(async () => {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
});

it("adds in order without duplicates, removes, persists, and rejects bad ids", async () => {
  for (const id of ["a", "b", "a"])
    await app.inject({ method: "PUT", url: `/api/favorites/${id}` });
  expect((await app.inject({ url: "/api/favorites" })).json()).toEqual({
    ids: ["a", "b"],
  });
  expect(
    (await app.inject({ method: "DELETE", url: "/api/favorites/a" })).json(),
  ).toEqual({ ids: ["b"] });
  expect(await new FavoritesStore(dir).list()).toEqual(["b"]);
  expect(
    (await app.inject({ method: "PUT", url: "/api/favorites/bad%20id" }))
      .statusCode,
  ).toBe(400);
});

it("concurrent adds from two devices both survive", async () => {
  await Promise.all(
    ["x", "y", "z"].map((id) =>
      app.inject({ method: "PUT", url: `/api/favorites/${id}` }),
    ),
  );
  expect(
    (
      (await app.inject({ url: "/api/favorites" })).json().ids as string[]
    ).sort(),
  ).toEqual(["x", "y", "z"]);
});
