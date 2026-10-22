import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../apps/server/app";
import { IssueStore } from "../../apps/server/issues";
import { Repository } from "../../packages/persistence/repository";
import { run } from "../../apps/cli/lotion";

let dir: string;
let app: Awaited<ReturnType<typeof createApp>>;
const TOKEN = "issue-test-token";
const auth = { authorization: `Bearer ${TOKEN}` };

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-issues-"));
  app = await createApp(await new Repository(dir).init(), {
    token: TOKEN,
    issues: new IssueStore(dir),
  });
});
afterEach(async () => {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
});

const call = (
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) =>
  app.inject({
    method,
    url,
    payload: payload as any,
    headers: { ...auth, ...headers },
  });

describe("issues API", () => {
  it("needs the workspace token", async () => {
    expect((await app.inject({ url: "/api/issues" })).statusCode).toBe(401);
  });

  it("creates, lists, moves, notes, patches and deletes; persists to issues.json", async () => {
    const created = await call("POST", "/api/issues", {
      title: "Paste bug",
      labels: ["bug"],
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      number: 1,
      status: "backlog",
      version: 1,
    });
    await call("POST", "/api/issues", { title: "Second", status: "todo" });

    const board = (await call("GET", "/api/issues")).json();
    expect(board.statuses.map((s: any) => s.key)).toEqual([
      "backlog",
      "todo",
      "doing",
      "done",
    ]);
    expect(board.issues).toHaveLength(2);
    expect(board.issues[0]).not.toHaveProperty("notes");
    expect(board.issues[0].noteCount).toBe(1);
    expect(
      (await call("GET", "/api/issues?label=BUG")).json().issues,
    ).toHaveLength(1);

    const seq = (await call("GET", "/api/issues/seq")).json().seq;
    const moved = (
      await call(
        "POST",
        "/api/issues/1/move",
        { status: "doing" },
        { "x-lotion-author": "codex" },
      )
    ).json();
    expect(moved.status).toBe("doing");
    expect(moved.notes.at(-1)).toMatchObject({
      kind: "status",
      author: "codex",
      text: "Backlog → In progress",
    });
    expect((await call("GET", "/api/issues/seq")).json().seq).toBe(seq + 1);

    const noted = await call("POST", "/api/issues/1/notes", {
      text: "원인 찾음",
    });
    expect(noted.statusCode).toBe(201);
    expect(noted.json().notes.at(-1)).toMatchObject({
      author: "me",
      text: "원인 찾음",
    });

    // If-Match: a stale version is refused, a current one applies
    const stale = await call(
      "PATCH",
      "/api/issues/1",
      { title: "Renamed" },
      { "if-match": '"1"' },
    );
    expect(stale.statusCode).toBe(409);
    const version = (await call("GET", "/api/issues/1")).json().version;
    const patched = await call(
      "PATCH",
      "/api/issues/1",
      { title: "Renamed", body: "**steps**" },
      { "if-match": `"${version}"` },
    );
    expect(patched.json()).toMatchObject({
      title: "Renamed",
      body: "**steps**",
      version: version + 1,
    });

    const saved = JSON.parse(
      await fs.readFile(path.join(dir, "issues.json"), "utf8"),
    );
    expect(saved.issues.map((i: any) => i.title)).toEqual([
      "Renamed",
      "Second",
    ]);
    expect(saved.next).toBe(3);

    expect((await call("DELETE", "/api/issues/2")).json()).toEqual({
      deleted: 2,
    });
    expect((await call("GET", "/api/issues/2")).statusCode).toBe(404);
    // numbers are never reused
    expect(
      (await call("POST", "/api/issues", { title: "Third" })).json().number,
    ).toBe(3);
  });

  it("validates input", async () => {
    expect((await call("POST", "/api/issues", { title: "" })).statusCode).toBe(
      400,
    );
    expect(
      (await call("POST", "/api/issues", { title: "x", extra: 1 })).statusCode,
    ).toBe(400);
    await call("POST", "/api/issues", { title: "x" });
    expect(
      (await call("POST", "/api/issues/1/move", { status: "nope" })).statusCode,
    ).toBe(400);
    expect((await call("GET", "/api/issues/abc")).statusCode).toBe(400);
    expect(
      (
        await call(
          "POST",
          "/api/issues/1/notes",
          { text: "x" },
          { "x-lotion-author": "bad author" },
        )
      ).statusCode,
    ).toBe(400);
  });

  it("concurrent changes from the board and agents all survive", async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        call("POST", "/api/issues", { title: `Issue ${i}` }),
      ),
    );
    await Promise.all([
      call("POST", "/api/issues/1/notes", { text: "a" }),
      call("POST", "/api/issues/1/notes", { text: "b" }),
      call("POST", "/api/issues/1/move", { status: "done" }),
      call("POST", "/api/issues/2/move", { status: "done" }),
    ]);
    const board = (await call("GET", "/api/issues")).json();
    expect(new Set(board.issues.map((i: any) => i.number)).size).toBe(12);
    const one = (await call("GET", "/api/issues/1")).json();
    expect(one.status).toBe("done");
    expect(
      one.notes.filter((n: any) => n.kind === "note").map((n: any) => n.text),
    ).toEqual(expect.arrayContaining(["a", "b"]));
    const reloaded = await new IssueStore(dir).board();
    expect(reloaded.issues).toHaveLength(12);
  });
});

describe("lotion issue CLI", () => {
  let address = "";
  beforeEach(async () => {
    address = await app.listen({ host: "127.0.0.1", port: 0 });
  });
  async function cli(args: string, stdin = "") {
    const out: string[] = [];
    const err: string[] = [];
    const code = await run(
      args.match(/"[^"]*"|\S+/g)!.map((a) => a.replace(/^"|"$/g, "")),
      {
        env: { LOTION_URL: address, LOTION_TOKEN: TOKEN },
        fetch,
        out: (t) => out.push(t),
        err: (t) => err.push(t),
        stdin: () => stdin,
      },
    );
    return { code, out: out.join("\n"), err: err.join("\n") };
  }

  it("creates, lists, moves and notes, with --json for agents", async () => {
    let r = await cli('issue new "Fix paste" --label bug,ui --as codex');
    expect(r).toMatchObject({ code: 0, out: "Created #1  Fix paste" });
    r = await cli('issue new "Write docs" --status Todo --json');
    expect(JSON.parse(r.out)).toMatchObject({ number: 2, status: "todo" });

    r = await cli("issue ls");
    expect(r.out).toContain("Backlog (backlog) — 1");
    expect(r.out).toContain("#1  Fix paste  [bug, ui]");
    expect(r.out).toContain("Todo (todo) — 1");

    r = await cli('issue move 1 "in progress" --as claude');
    expect(r).toMatchObject({ code: 0, out: "#1 → In progress" });
    r = await cli("issue note 1 - --as claude", "found the cause\nnext: fix");
    expect(r.code).toBe(0);

    r = await cli("issue show #1");
    expect(r.out).toContain("#1  Fix paste");
    expect(r.out).toContain("Status: In progress   Labels: bug, ui");
    expect(r.out).toContain("claude  [status] Backlog → In progress");
    expect(r.out).toContain("claude  found the cause");

    r = await cli("issue ls --status doing --json");
    expect(JSON.parse(r.out).map((i: any) => i.number)).toEqual([1]);
  });

  it("reports errors with a non-zero exit code", async () => {
    let r = await cli("issue move 1 nowhere");
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/Unknown status|not found/);
    r = await cli("issue show 99");
    expect(r).toMatchObject({ code: 1 });
    expect(r.err).toContain("Issue #99 not found (HTTP 404)");
    r = await cli("issue frobnicate");
    expect(r.err).toContain("Unknown issue command");
    r = await cli("--help");
    expect(r.out).toContain("Usage: lotion issue");
  });
});
