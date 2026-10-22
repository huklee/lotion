import { readFileSync } from "node:fs";
import type {
  Issue,
  IssueBoard,
  IssueNote,
  IssueStatus,
} from "../../packages/issues/model";

/**
 * `lotion issue …` — the issue tracker for people and agents (ADR-026).
 * Talks to a running Lotion server over its HTTP API; `--json` prints the raw
 * API objects for scripts and agents.
 */

export type CliIO = {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  out: (text: string) => void;
  err: (text: string) => void;
  stdin?: () => string;
};

export const USAGE = `Usage: lotion issue <command> [options]

Commands
  ls                     List issues by status
      --status <s>       Only this status (key or name)
      --label <l>        Only issues with this label
      --priority <p>     Only this priority (none, low, medium, high, urgent)
      -q <text>          Title/body search
  show <n>               One issue with its notes
  new <title>            Create an issue
      --body <text|->    Body (Markdown); "-" reads stdin
      --status <s>       Start in this status (default: first column)
      --label <a,b>      Labels, comma separated
      --priority <p>     none, low, medium, high or urgent
  move <n> <status>      Move to a status column
      --before <m>       Place before issue #m (default: end of column)
  note <n> <text|->      Add a status note; "-" reads stdin

Options
  --json                 Print JSON (API objects)
  --as <name>            Author shown on notes (default: $LOTION_AUTHOR or "cli")
  -h, --help             This help

Environment
  LOTION_URL             Server (default http://127.0.0.1:3001)
  LOTION_TOKEN           Workspace token, or LOTION_TOKEN_FILE with its path`;

class CliError extends Error {}

type Parsed = { args: string[]; flags: Map<string, string | true> };

const VALUE_FLAGS = new Set([
  "status",
  "label",
  "q",
  "body",
  "before",
  "as",
  "priority",
]);

export function parseArgs(argv: string[]): Parsed {
  const args: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      args.push(...argv.slice(i + 1));
      break;
    }
    const match = /^--?([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match || arg === "-") {
      args.push(arg);
      continue;
    }
    const name = match[1] === "h" ? "help" : match[1];
    if (VALUE_FLAGS.has(name)) {
      const value = match[2] ?? argv[++i];
      if (value === undefined) throw new CliError(`--${name} needs a value`);
      flags.set(name, value);
    } else if (["json", "help"].includes(name)) flags.set(name, true);
    else throw new CliError(`Unknown option: ${arg}`);
  }
  return { args, flags };
}

function client(io: CliIO, author: string) {
  const base = (io.env.LOTION_URL || "http://127.0.0.1:3001").replace(
    /\/+$/,
    "",
  );
  let token = io.env.LOTION_TOKEN;
  if (!token && io.env.LOTION_TOKEN_FILE)
    token = readFileSync(io.env.LOTION_TOKEN_FILE, "utf8").trim();
  return async <T>(method: string, url: string, body?: unknown) => {
    const headers: Record<string, string> = { "X-Lotion-Author": author };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await io.fetch(base + url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new CliError(
        `Cannot reach Lotion at ${base} (${(error as Error).message})`,
      );
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new CliError(
        response.status === 401
          ? "The server needs a token: set LOTION_TOKEN or LOTION_TOKEN_FILE"
          : `${data.error ?? response.statusText} (HTTP ${response.status})`,
      );
    return data as T;
  };
}

export function resolveStatus(statuses: IssueStatus[], value: string): string {
  const v = value.trim().toLowerCase();
  const found = statuses.find(
    (s) => s.key.toLowerCase() === v || s.name.toLowerCase() === v,
  );
  if (!found)
    throw new CliError(
      `Unknown status "${value}". Use one of: ${statuses.map((s) => s.key).join(", ")}`,
    );
  return found.key;
}

function number(value: string | undefined): number {
  const n = Number(String(value ?? "").replace(/^#/, ""));
  if (!Number.isSafeInteger(n) || n < 1)
    throw new CliError(`Expected an issue number, got "${value ?? ""}"`);
  return n;
}

const time = (iso: string) => iso.slice(0, 16).replace("T", " ");

function formatNote(note: IssueNote) {
  return `  ${time(note.at)}  ${note.author}  ${note.kind === "note" ? "" : `[${note.kind}] `}${note.text.replaceAll("\n", "\n    ")}`;
}

export function formatBoard(board: IssueBoard): string {
  const lines: string[] = [];
  for (const status of board.statuses) {
    const items = board.issues
      .filter((i) => i.status === status.key)
      .sort((a, b) => a.rank - b.rank);
    if (!items.length) continue;
    lines.push(`${status.name} (${status.key}) — ${items.length}`);
    for (const i of items)
      lines.push(
        `  #${i.number}  ${i.title}${i.priority && i.priority !== "none" ? `  !${i.priority}` : ""}${i.labels.length ? `  [${i.labels.join(", ")}]` : ""}${i.noteCount > 1 ? `  · ${i.noteCount - 1} note${i.noteCount > 2 ? "s" : ""}` : ""}`,
      );
  }
  return lines.length ? lines.join("\n") : "No issues.";
}

export function formatIssue(issue: Issue, statuses: IssueStatus[]): string {
  const status =
    statuses.find((s) => s.key === issue.status)?.name ?? issue.status;
  return [
    `#${issue.number}  ${issue.title}`,
    `Status: ${status}${issue.priority && issue.priority !== "none" ? `   Priority: ${issue.priority}` : ""}${issue.labels.length ? `   Labels: ${issue.labels.join(", ")}` : ""}`,
    `Created ${time(issue.createdAt)}   Updated ${time(issue.updatedAt)}`,
    ...(issue.body.trim() ? ["", issue.body.trim()] : []),
    "",
    "Notes",
    ...issue.notes.map(formatNote),
  ].join("\n");
}

export async function run(argv: string[], io: CliIO): Promise<number> {
  try {
    const { args, flags } = parseArgs(argv);
    const [group, command, ...rest] = args;
    if (flags.has("help") || !group || group === "help") {
      io.out(USAGE);
      return 0;
    }
    if (group !== "issue" && group !== "issues")
      throw new CliError(
        `Unknown command "${group}". Try: lotion issue --help`,
      );
    const author = String(flags.get("as") ?? io.env.LOTION_AUTHOR ?? "cli");
    const call = client(io, author);
    const json = flags.has("json");
    const text = (value: string | true | undefined) => {
      if (value === "-") return io.stdin?.() ?? "";
      return typeof value === "string" ? value : undefined;
    };
    const board = () => call<IssueBoard>("GET", "/api/issues");
    const print = (value: unknown, human: () => string) =>
      io.out(json ? JSON.stringify(value, null, 2) : human());

    switch (command) {
      case "ls":
      case "list": {
        const all = await board();
        const status = flags.get("status");
        const query = new URLSearchParams();
        if (typeof status === "string")
          query.set("status", resolveStatus(all.statuses, status));
        for (const key of ["label", "q", "priority"] as const) {
          const value = flags.get(key);
          if (typeof value === "string") query.set(key, value);
        }
        const result = query.size
          ? await call<IssueBoard>("GET", `/api/issues?${query}`)
          : all;
        print(json ? result.issues : result, () => formatBoard(result));
        return 0;
      }
      case "show": {
        const [issue, all] = await Promise.all([
          call<Issue>("GET", `/api/issues/${number(rest[0])}`),
          board(),
        ]);
        print(issue, () => formatIssue(issue, all.statuses));
        return 0;
      }
      case "new":
      case "create": {
        const title = rest.join(" ").trim();
        if (!title) throw new CliError("new needs a title");
        const body: Record<string, unknown> = { title };
        const b = text(flags.get("body"));
        if (b !== undefined) body.body = b;
        const status = flags.get("status");
        if (typeof status === "string")
          body.status = resolveStatus((await board()).statuses, status);
        const priority = flags.get("priority");
        if (typeof priority === "string")
          body.priority = priority.toLowerCase();
        const labels = flags.get("label");
        if (typeof labels === "string")
          body.labels = labels
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean);
        const issue = await call<Issue>("POST", "/api/issues", body);
        print(issue, () => `Created #${issue.number}  ${issue.title}`);
        return 0;
      }
      case "move": {
        const n = number(rest[0]);
        if (!rest[1]) throw new CliError("move needs a status");
        const all = await board();
        const status = resolveStatus(all.statuses, rest.slice(1).join(" "));
        const before = flags.get("before");
        const issue = await call<Issue>("POST", `/api/issues/${n}/move`, {
          status,
          ...(typeof before === "string" ? { before: number(before) } : {}),
        });
        print(
          issue,
          () =>
            `#${issue.number} → ${all.statuses.find((s) => s.key === issue.status)?.name ?? issue.status}`,
        );
        return 0;
      }
      case "note": {
        const n = number(rest[0]);
        const body = text(rest.slice(1).join(" ") || undefined);
        if (!body?.trim()) throw new CliError("note needs text");
        const issue = await call<Issue>("POST", `/api/issues/${n}/notes`, {
          text: body,
        });
        print(issue, () => `Noted on #${issue.number}`);
        return 0;
      }
      default:
        throw new CliError(
          command
            ? `Unknown issue command "${command}". Try: lotion issue --help`
            : USAGE,
        );
    }
  } catch (error) {
    if (error instanceof CliError) {
      io.err(error.message);
      return 1;
    }
    io.err(String((error as Error)?.message ?? error));
    return 1;
  }
}
