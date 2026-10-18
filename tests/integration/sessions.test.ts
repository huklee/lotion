import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../apps/server/app";
import { SessionStore, readCookie } from "../../apps/server/sessions";
import { Repository } from "../../packages/persistence/repository";

const TOKEN = "secret-token-123";
let dir: string;
let app: Awaited<ReturnType<typeof createApp>>;
let clock: number;
const host = { host: "lotion.example" };

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-sessions-"));
  clock = Date.UTC(2026, 9, 18);
  app = await createApp(await new Repository(dir).init(), {
    token: TOKEN,
    sessions: new SessionStore(dir, () => clock),
  });
});
afterEach(async () => {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
});

async function login() {
  const r = await app.inject({
    method: "POST",
    url: "/api/session",
    headers: { ...host, authorization: `Bearer ${TOKEN}` },
  });
  expect(r.statusCode).toBe(200);
  const cookie = String(r.headers["set-cookie"]);
  expect(cookie).toMatch(
    /lotion_session=[\w-]{40,}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=7776000; Secure/,
  );
  return `lotion_session=${readCookie(cookie, "lotion_session")}`;
}

it("asks for the token once: a session cookie then authenticates every request", async () => {
  expect(
    (await app.inject({ url: "/api/tree", headers: host })).statusCode,
  ).toBe(401);
  const cookie = await login();
  expect(
    (await app.inject({ url: "/api/tree", headers: { ...host, cookie } }))
      .statusCode,
  ).toBe(200);
  // a forged or unknown cookie does not
  expect(
    (
      await app.inject({
        url: "/api/tree",
        headers: { ...host, cookie: "lotion_session=forged" },
      })
    ).statusCode,
  ).toBe(401);
  // a session cannot mint another session without the token
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/session",
        headers: { ...host, cookie },
      })
    ).statusCode,
  ).toBe(401);
  // only hashes are stored
  const stored = await fs.readFile(path.join(dir, "sessions.json"), "utf8");
  expect(stored).not.toContain(cookie.split("=")[1]);
  expect((await fs.stat(path.join(dir, "sessions.json"))).mode & 0o777).toBe(
    0o600,
  );
});

it("sessions survive a restart, slide with use, expire after 90 idle days, and can sign out", async () => {
  const cookie = await login();
  // a new store on the same folder (server restart) still knows the session
  const reopened = new SessionStore(dir, () => clock);
  expect(await reopened.verify(readCookie(cookie, "lotion_session"))).toBe(
    true,
  );
  clock += 80 * 86_400_000; // used on day 80 → still valid, expiry slides
  expect(
    (await app.inject({ url: "/api/tree", headers: { ...host, cookie } }))
      .statusCode,
  ).toBe(200);
  clock += 80 * 86_400_000; // 80 more days since last use
  expect(
    (await app.inject({ url: "/api/tree", headers: { ...host, cookie } }))
      .statusCode,
  ).toBe(200);
  clock += 91 * 86_400_000; // idle too long
  expect(
    (await app.inject({ url: "/api/tree", headers: { ...host, cookie } }))
      .statusCode,
  ).toBe(401);
  const fresh = await login();
  const out = await app.inject({
    method: "DELETE",
    url: "/api/session",
    headers: { ...host, cookie: fresh },
  });
  expect(String(out.headers["set-cookie"])).toContain("Max-Age=0");
  expect(
    (
      await app.inject({
        url: "/api/tree",
        headers: { ...host, cookie: fresh },
      })
    ).statusCode,
  ).toBe(401);
});
