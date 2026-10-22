import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../apps/server/app";
import { IssueStore } from "../../apps/server/issues";
import { NotificationService } from "../../apps/server/notifications";
import { Repository } from "../../packages/persistence/repository";
import { run } from "../../apps/cli/lotion";
import {
  diffBoards,
  editLabels,
  issueClient,
  workingStatus,
} from "../../apps/cli/issues-client";
import { createMcpServer, serve, TOOLS } from "../../apps/mcp/issues-mcp";
import { DEFAULT_STATUSES } from "../../packages/issues/model";

let dir: string;
let address: string;
let app: Awaited<ReturnType<typeof createApp>>;
let notifications: NotificationService;
const TOKEN = "agents-test-token";
const env = () => ({ LOTION_URL: address, LOTION_TOKEN: TOKEN });

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-agents-"));
  notifications = new NotificationService(dir);
  app = await createApp(await new Repository(dir).init(), {
    token: TOKEN,
    issues: new IssueStore(dir),
    notifications,
  });
  address = await app.listen({ host: "127.0.0.1", port: 0 });
});
afterEach(async () => {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
});

async function cli(args: string[], stdin = "", signal?: AbortSignal) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, {
    env: env(),
    fetch,
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    stdin: () => stdin,
    signal,
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("client helpers", () => {
  it("edits labels, picks the working status, and describes board changes", () => {
    expect(editLabels(["bug", "UI"], ["+idea", "-ui", "bug"])).toEqual([
      "bug",
      "idea",
    ]);
    expect(editLabels([], ["a,b, ,+c"])).toEqual(["a", "b", "c"]);
    expect(workingStatus(DEFAULT_STATUSES)).toBe("doing");
    expect(
      workingStatus([
        { key: "open", name: "Open", color: "gray" },
        { key: "wip", name: "WIP", color: "blue" },
        { key: "closed", name: "Closed", color: "green" },
      ]),
    ).toBe("wip");
    const base = {
      seq: 1,
      statuses: DEFAULT_STATUSES,
      issues: [
        {
          number: 1,
          title: "A",
          status: "backlog",
          version: 1,
          noteCount: 1,
          lastNote: null,
        },
        {
          number: 2,
          title: "B",
          status: "todo",
          version: 1,
          noteCount: 1,
          lastNote: null,
        },
      ],
    } as any;
    const next = {
      ...base,
      seq: 2,
      issues: [
        {
          ...base.issues[0],
          status: "done",
          version: 3,
          updatedBy: "codex",
          noteCount: 3,
          lastNote: { kind: "note", author: "codex", text: "done\nmore" },
        },
        { number: 3, title: "C", status: "backlog", version: 1, noteCount: 1 },
      ],
    } as any;
    expect(diffBoards(base, next)).toEqual([
      "#1 Backlog → Done by codex: A",
      "#1 note by codex: done",
      "#3 created in Backlog: C",
      "#2 deleted: B",
    ]);
  });
});

describe("CLI agent commands", () => {
  it("edit, label, claim, close, reopen, search, rm", async () => {
    await cli(["issue", "new", "Fix", "paste", "--label", "bug"]);
    let r = await cli([
      "issue",
      "edit",
      "1",
      "--title",
      "Fix paste in lists",
      "--priority",
      "high",
    ]);
    expect(r).toMatchObject({ code: 0, out: "Updated #1  Fix paste in lists" });
    r = await cli(["issue", "label", "1", "+ui", "-bug", "+idea"]);
    expect(r.out).toBe("#1 labels: ui, idea");

    r = await cli(["issue", "claim", "1", "--as", "codex"]);
    expect(r.out).toBe("#1 claimed by codex (In progress)");
    const claimed = await (
      await fetch(`${address}/api/issues/1`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      })
    ).json();
    expect(claimed).toMatchObject({ status: "doing", updatedBy: "codex" });
    expect(claimed.notes.at(-1)).toMatchObject({
      author: "codex",
      text: "Claimed by codex",
    });

    expect((await cli(["issue", "close", "1"])).out).toBe("#1 → Done");
    expect((await cli(["issue", "reopen", "1"])).out).toBe("#1 → Backlog");
    r = await cli(["issue", "search", "lists", "--json"]);
    expect(JSON.parse(r.out).map((i: any) => i.number)).toEqual([1]);
    r = await cli(["issue", "show", "1"]);
    expect(r.out).toContain("Priority: high");
    expect(r.out).toContain("by cli");
    expect((await cli(["issue", "rm", "1"])).out).toBe("Deleted #1");
    expect((await cli(["issue", "show", "1"])).code).toBe(1);
    expect((await cli(["issue", "edit", "1"])).err).toContain("edit needs");
  });

  it("watch prints changes until stopped", async () => {
    const stop = new AbortController();
    const watching = cli(
      ["issue", "watch", "--interval", "0.2"],
      "",
      stop.signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const api = issueClient({ env: env(), fetch, author: "claude" });
    await api.create({ title: "Watched" });
    await api.move(1, "done");
    await api.note(1, "verified");
    await new Promise((resolve) => setTimeout(resolve, 700));
    stop.abort();
    const r = await watching;
    expect(r.code).toBe(0);
    expect(r.out).toContain("Watching 0 issues");
    expect(r.out).toMatch(/#1 (created in (Backlog|Done)|Backlog → Done)/);
    expect(r.out).toContain("#1 note by claude: verified");
  });
});

describe("MCP server", () => {
  const rpc = async (
    handle: (m: any) => Promise<any>,
    method: string,
    params?: unknown,
    id: number = 1,
  ) => handle({ jsonrpc: "2.0", id, method, params });
  const text = (response: any) => JSON.parse(response.result.content[0].text);

  it("initializes, lists tools and runs them against the server", async () => {
    const { handle } = createMcpServer(
      issueClient({ env: env(), fetch, author: "claude" }),
      "claude",
      "0.47.0",
    );
    const init = await rpc(handle, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(init.result).toMatchObject({
      protocolVersion: "2025-03-26",
      serverInfo: { name: "lotion-issues", version: "0.47.0" },
      capabilities: { tools: {} },
    });
    expect(
      await handle({ jsonrpc: "2.0", method: "notifications/initialized" }),
    ).toBeNull();
    const tools = (await rpc(handle, "tools/list")).result.tools;
    expect(tools.map((t: any) => t.name)).toEqual(TOOLS.map((t) => t.name));

    const call = (name: string, args: unknown) =>
      rpc(handle, "tools/call", { name, arguments: args });
    const created = text(
      await call("create_issue", {
        title: "MCP issue",
        labels: ["agent"],
        status: "Todo",
        priority: "urgent",
      }),
    );
    expect(created).toMatchObject({
      number: 1,
      status: "todo",
      priority: "urgent",
    });
    expect(text(await call("claim_issue", { number: 1 }))).toMatchObject({
      status: "doing",
      updatedBy: "claude",
    });
    text(await call("add_note", { number: 1, text: "half way" }));
    const updated = text(
      await call("update_issue", {
        number: 1,
        add_labels: ["mcp"],
        remove_labels: ["agent"],
        body: "details",
      }),
    );
    expect(updated).toMatchObject({ labels: ["mcp"], body: "details" });
    const closed = text(
      await call("close_issue", { number: 1, note: "shipped" }),
    );
    expect(closed.status).toBe("done");
    expect(closed.notes.map((n: any) => n.text)).toEqual([
      "Created",
      "Todo → In progress",
      "Claimed by claude",
      "half way",
      "In progress → Done",
      "shipped",
    ]);
    const list = text(await call("list_issues", { status: "done" }));
    expect(list.issues.map((i: any) => i.number)).toEqual([1]);

    // tool errors are results with isError, not protocol errors
    const bad = await call("move_issue", { number: 1, status: "nowhere" });
    expect(bad.result.isError).toBe(true);
    expect(bad.result.content[0].text).toContain('Unknown status "nowhere"');
    const missing = await call("get_issue", { number: 99 });
    expect(missing.result.isError).toBe(true);
    expect((await rpc(handle, "nope")).error.code).toBe(-32601);
  });

  it("speaks newline-delimited JSON-RPC", async () => {
    const { handle } = createMcpServer(
      issueClient({ env: env(), fetch, author: "claude" }),
      "claude",
      "0.47.0",
    );
    const lines: string[] = [];
    async function* input() {
      yield '{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n';
      yield '{"jsonrpc":"2.0","id":2,"method":"tools/list"}\nnot json\n';
    }
    await serve(input(), (line) => lines.push(line), handle);
    expect(lines.map((l) => JSON.parse(l).id)).toEqual([1, 2, null]);
    expect(JSON.parse(lines[2]).error.code).toBe(-32700);
  });
});

describe("notifications for agent changes", () => {
  it("records agent changes (not your own) with the issue number", async () => {
    const me = issueClient({ env: env(), fetch, author: "me" });
    const codex = issueClient({ env: env(), fetch, author: "codex" });
    await me.create({ title: "Mine" });
    await me.move(1, "doing");
    await codex.create({ title: "Theirs" });
    await codex.move(2, "done");
    await codex.note(2, "all green");
    await codex.patch(2, { title: "Theirs, renamed" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const { items } = await notifications.list(20);
    expect(
      items.map((n: any) => [n.kind, n.issue, n.detail]).reverse(),
    ).toEqual([
      ["issue.changed", 2, "codex created it in Backlog"],
      ["issue.changed", 2, "codex moved it to Done"],
      ["issue.changed", 2, "codex noted: all green"],
      ["issue.changed", 2, "codex edited it"],
    ]);
  });
});

describe("stage 4: links, archive, settings, export", () => {
  it("API and CLI", async () => {
    const api = issueClient({ env: env(), fetch, author: "me" });
    await api.create({ title: "Linked", links: ["page-1"] });
    await api.create({ title: "Done one", status: "done", labels: ["bug"] });
    let r = await cli(["issue", "link", "2", "https://x/#/page/page-1"]);
    expect(r.out).toBe("#2 pages: page-1");
    expect(
      (await api.board({ page: "page-1" })).issues.map((i) => i.number),
    ).toEqual([1, 2]);
    r = await cli(["issue", "unlink", "2", "page-1"]);
    expect(r.out).toBe("#2 pages: (none)");

    // archive the Done column: hidden from the board, listed with --archived
    const auth = {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    };
    const archived = await (
      await fetch(`${address}/api/issues/archive`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ status: "done" }),
      })
    ).json();
    expect(archived).toEqual({ archived: 1 });
    expect((await api.board()).issues.map((i) => i.number)).toEqual([1]);
    r = await cli(["issue", "ls", "--archived", "--json"]);
    expect(JSON.parse(r.out).map((i: any) => i.number)).toEqual([1, 2]);
    expect((await cli(["issue", "unarchive", "2"])).out).toBe(
      "#2 back on the board",
    );
    expect((await cli(["issue", "archive", "2"])).out).toBe("#2 archived");

    // statuses and labels
    const statuses = await (
      await fetch(`${address}/api/issues/config`, {
        method: "PUT",
        headers: auth,
        body: JSON.stringify({
          statuses: [
            { key: "backlog", name: "Inbox", color: "gray" },
            { key: "doing", name: "Doing", color: "blue" },
            { key: "done", name: "Done", color: "green" },
          ],
        }),
      })
    ).json();
    expect(statuses.statuses.map((s: any) => s.name)).toEqual([
      "Inbox",
      "Doing",
      "Done",
    ]);
    const refused = await fetch(`${address}/api/issues/config`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({
        statuses: [
          { key: "doing", name: "Doing", color: "blue" },
          { key: "done", name: "Done", color: "green" },
        ],
      }),
    });
    expect(refused.status).toBe(400);
    const renamed = await (
      await fetch(`${address}/api/issues/labels`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ from: "bug", to: "defect" }),
      })
    ).json();
    expect(renamed).toEqual({ changed: 1 });

    // export
    r = await cli(["issue", "export"]);
    expect(r.out).toContain("## Inbox (1)");
    expect(r.out).toContain("_labels: defect · archived_");
    const json = JSON.parse(
      (await cli(["issue", "export", "--format", "json"])).out,
    );
    expect(json.issues).toHaveLength(2);
    const download = await fetch(`${address}/api/issues/export?format=md`, {
      headers: auth,
    });
    expect(download.headers.get("content-disposition")).toMatch(
      /attachment; filename="lotion-issues-\d{4}-\d{2}-\d{2}\.md"/,
    );
  });
});
