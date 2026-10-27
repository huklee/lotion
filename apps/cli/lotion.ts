import {
  dueLabel,
  focusState,
  type Issue,
  type IssueBoard,
  type IssueNote,
  type IssueStatus,
} from "../../packages/issues/model";
import {
  LotionError,
  diffBoards,
  editLabels,
  issueClient,
  parseDue,
  parseNumbers,
  resolveStatus,
  workingStatus,
  type IssueInput,
} from "./issues-client";

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
  /** Stops `watch` (Ctrl+C in a terminal). */
  signal?: AbortSignal;
};

export const USAGE = `Usage: lotion issue <command> [options]

Read
  ls                       List issues by status
      --status <s>         Only this status (key or name)
      --label <l>          Only issues with this label
      --priority <p>       Only this priority (none, low, medium, high, urgent)
      -q <text>            Title/body search
      --archived           Include archived issues
      --focus              Only issues in focus (Focus now, or due within 24 h)
  search <text>            Same as ls -q <text>
  show <n>                 One issue with its notes
  watch                    Print changes as they happen (Ctrl+C stops)
      --interval <sec>     Poll interval (default 3)

Change
  new <title>              Create an issue
      --body <text|->      Body (Markdown); "-" reads stdin
      --status <s>         Start in this status (default: first column)
      --label <a,b>        Labels, comma separated
      --priority <p>       none, low, medium, high or urgent
      --due <when>         Deadline: 2026-10-30, "2026-10-30 18:00", +2d, +5h
  edit <n>                 Change --title, --body, --label (replaces), --priority or --due (none clears)
  focus <n…> / unfocus <n…>
                           Turn Focus now on / off
  label <n> <+a|-b>...     Add (+) or remove (-) labels
  move <n> <status>        Move to a status column
      --before <m>         Place before issue #m (default: end of column)
  claim <n>                Move to In progress and note who took it
  close <n> / reopen <n>   Move to the last / first column
  note <n> <text|->        Add a status note; "-" reads stdin
  archive <n> / unarchive <n>
                           Hide from / return to the board
  link <n> <page-id>       Link a Lotion page (unlink <n> <page-id> removes it)
  rm <n>                   Delete an issue and its notes
  bulk <n,n,a-b>           One change to several issues:
      --status <s> --priority <p> --label <+a,-b> --due <when> --focus | --unfocus
      --archive | --unarchive | --delete
  export                   Print the whole board (--format md or json)

Options
  --json                   Print JSON (API objects)
  --as <name>              Author shown on notes (default: $LOTION_AUTHOR or "cli")
  -h, --help               This help

Environment
  LOTION_URL               Server (default http://127.0.0.1:3001)
  LOTION_TOKEN             Workspace token, or LOTION_TOKEN_FILE with its path`;

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
  "title",
  "interval",
  "format",
  "due",
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
    // "+label" / "-label" arguments of `label` are values, not options
    const match = /^--?([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (
      !match ||
      arg === "-" ||
      (arg.startsWith("-") &&
        !arg.startsWith("--") &&
        !["q", "h"].includes(match[1]))
    ) {
      args.push(arg);
      continue;
    }
    const name = match[1] === "h" ? "help" : match[1];
    if (VALUE_FLAGS.has(name)) {
      const value = match[2] ?? argv[++i];
      if (value === undefined) throw new CliError(`--${name} needs a value`);
      flags.set(name, value);
    } else if (
      [
        "json",
        "help",
        "archived",
        "archive",
        "unarchive",
        "delete",
        "focus",
        "unfocus",
      ].includes(name)
    )
      flags.set(name, true);
    else throw new CliError(`Unknown option: ${arg}`);
  }
  return { args, flags };
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

/** "⚑ " for issues in focus, and the deadline after the title. */
function focusMark(
  i: Pick<Issue, "status" | "focusedAt" | "due">,
  statuses: IssueStatus[],
) {
  return focusState(i, statuses, Date.now()).focused ? "⚑ " : "";
}
function dueText(
  i: Pick<Issue, "status" | "focusedAt" | "due">,
  statuses: IssueStatus[],
) {
  const state = focusState(i, statuses, Date.now());
  return state.dueIn === null ? "" : `  (due ${dueLabel(state.dueIn)})`;
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
        `  #${i.number}  ${focusMark(i, board.statuses)}${i.title}${i.priority && i.priority !== "none" ? `  !${i.priority}` : ""}${i.labels.length ? `  [${i.labels.join(", ")}]` : ""}${dueText(i, board.statuses)}${i.noteCount > 1 ? `  · ${i.noteCount - 1} note${i.noteCount > 2 ? "s" : ""}` : ""}`,
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
    ...(issue.due || issue.focusedAt
      ? [
          `${focusState(issue, statuses, Date.now()).focused ? "Focus now" : ""}${issue.due ? `${focusState(issue, statuses, Date.now()).focused ? "   " : ""}Due ${time(new Date(issue.due).toISOString())} (${dueLabel(Date.parse(issue.due) - Date.now())})` : ""}`,
        ]
      : []),
    `Created ${time(issue.createdAt)}   Updated ${time(issue.updatedAt)}${issue.updatedBy ? ` by ${issue.updatedBy}` : ""}`,
    ...(issue.body.trim() ? ["", issue.body.trim()] : []),
    "",
    "Notes",
    ...issue.notes.map(formatNote),
  ].join("\n");
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

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
    const api = issueClient({ env: io.env, fetch: io.fetch, author });
    const json = flags.has("json");
    const text = (value: string | true | undefined) => {
      if (value === "-") return io.stdin?.() ?? "";
      return typeof value === "string" ? value : undefined;
    };
    const flag = (name: string) => {
      const value = flags.get(name);
      return typeof value === "string" ? value : undefined;
    };
    const print = (value: unknown, human: () => string) =>
      io.out(json ? JSON.stringify(value, null, 2) : human());
    const statusName = (statuses: IssueStatus[], key: string) =>
      statuses.find((s) => s.key === key)?.name ?? key;
    const moved = async (
      n: number,
      status: string,
      statuses: IssueStatus[],
    ) => {
      const issue = await api.move(n, status);
      print(
        issue,
        () => `#${issue.number} → ${statusName(statuses, issue.status)}`,
      );
      return issue;
    };

    switch (command) {
      case "ls":
      case "list":
      case "search": {
        const all = await api.board();
        const status = flag("status");
        const q =
          command === "search" ? rest.join(" ") || flag("q") : flag("q");
        if (command === "search" && !q) throw new CliError("search needs text");
        const result = await api.board({
          status: status ? resolveStatus(all.statuses, status) : undefined,
          label: flag("label"),
          priority: flag("priority")?.toLowerCase(),
          q,
          archived: flags.has("archived") ? "include" : undefined,
        });
        if (flags.has("focus"))
          result.issues = result.issues.filter(
            (i) => focusState(i, result.statuses, Date.now()).focused,
          );
        print(json ? result.issues : result, () => formatBoard(result));
        return 0;
      }
      case "show": {
        const [issue, all] = await Promise.all([
          api.get(number(rest[0])),
          api.board(),
        ]);
        print(issue, () => formatIssue(issue, all.statuses));
        return 0;
      }
      case "new":
      case "create": {
        const title = rest.join(" ").trim();
        if (!title) throw new CliError("new needs a title");
        const input: IssueInput = { title };
        const body = text(flags.get("body"));
        if (body !== undefined) input.body = body;
        const status = flag("status");
        if (status)
          input.status = resolveStatus((await api.board()).statuses, status);
        const priority = flag("priority");
        if (priority) input.priority = priority.toLowerCase();
        const labels = flag("label");
        if (labels !== undefined) input.labels = editLabels([], [labels]);
        const due = flag("due");
        if (due !== undefined) input.due = parseDue(due);
        if (flags.has("focus")) input.focus = true;
        const issue = await api.create(input);
        print(issue, () => `Created #${issue.number}  ${issue.title}`);
        return 0;
      }
      case "edit": {
        const n = number(rest[0]);
        const input: IssueInput = {};
        const title = flag("title");
        if (title !== undefined) input.title = title;
        const body = text(flags.get("body"));
        if (body !== undefined) input.body = body;
        const labels = flag("label");
        if (labels !== undefined) input.labels = editLabels([], [labels]);
        const priority = flag("priority");
        if (priority) input.priority = priority.toLowerCase();
        if (flag("status")) {
          const all = await api.board();
          input.status = resolveStatus(all.statuses, flag("status")!);
        }
        const due = flag("due");
        if (due !== undefined) input.due = parseDue(due);
        if (flags.has("focus")) input.focus = true;
        if (flags.has("unfocus")) input.focus = false;
        if (!Object.keys(input).length)
          throw new CliError(
            "edit needs --title, --body, --label, --priority, --status, --due or --focus",
          );
        const issue = await api.patch(n, input);
        print(issue, () => `Updated #${issue.number}  ${issue.title}`);
        return 0;
      }
      case "label": {
        const n = number(rest[0]);
        if (!rest.length || rest.length < 2)
          throw new CliError("label needs +name or -name");
        // read-modify-write with the version; retry once if someone else wrote
        for (let attempt = 0; ; attempt++) {
          const current = await api.get(n);
          try {
            const issue = await api.patch(
              n,
              { labels: editLabels(current.labels, rest.slice(1)) },
              current.version,
            );
            print(
              issue,
              () =>
                `#${issue.number} labels: ${issue.labels.join(", ") || "(none)"}`,
            );
            return 0;
          } catch (error) {
            if (
              !(error instanceof LotionError && error.status === 409) ||
              attempt
            )
              throw error;
          }
        }
      }
      case "move": {
        const n = number(rest[0]);
        if (!rest[1]) throw new CliError("move needs a status");
        const all = await api.board();
        const status = resolveStatus(all.statuses, rest.slice(1).join(" "));
        const before = flag("before");
        const issue = await api.move(
          n,
          status,
          before === undefined ? undefined : number(before),
        );
        print(
          issue,
          () => `#${issue.number} → ${statusName(all.statuses, issue.status)}`,
        );
        return 0;
      }
      case "close":
      case "reopen": {
        const n = number(rest[0]);
        const { statuses } = await api.board();
        await moved(
          n,
          (command === "close" ? statuses.at(-1)! : statuses[0]).key,
          statuses,
        );
        return 0;
      }
      case "claim": {
        const n = number(rest[0]);
        const { statuses } = await api.board();
        const status = workingStatus(statuses);
        const current = await api.get(n);
        if (current.status !== status) await api.move(n, status);
        const issue = await api.note(n, `Claimed by ${author}`);
        print(
          issue,
          () =>
            `#${issue.number} claimed by ${author} (${statusName(statuses, issue.status)})`,
        );
        return 0;
      }
      case "note": {
        const n = number(rest[0]);
        const body = text(rest.slice(1).join(" ") || undefined);
        if (!body?.trim()) throw new CliError("note needs text");
        const issue = await api.note(n, body);
        print(issue, () => `Noted on #${issue.number}`);
        return 0;
      }
      case "archive":
      case "unarchive": {
        const n = number(rest[0]);
        const issue = await api.patch(n, { archived: command === "archive" });
        print(
          issue,
          () =>
            `#${issue.number} ${issue.archivedAt ? "archived" : "back on the board"}`,
        );
        return 0;
      }
      case "link":
      case "unlink": {
        const n = number(rest[0]);
        const page = rest[1]?.replace(/^.*#\/page\//, "").replace(/#.*$/, "");
        if (!page) throw new CliError(`${command} needs a page id or link`);
        const current = await api.get(n);
        const links =
          command === "link"
            ? [...new Set([...(current.links ?? []), page])]
            : (current.links ?? []).filter((l) => l !== page);
        const issue = await api.patch(n, { links }, current.version);
        print(
          issue,
          () => `#${issue.number} pages: ${issue.links.join(", ") || "(none)"}`,
        );
        return 0;
      }
      case "export": {
        const format = flag("format") === "json" ? "json" : "md";
        io.out(await api.exportText(format));
        return 0;
      }
      case "focus":
      case "unfocus": {
        if (!rest.length) throw new CliError(`${command} needs issue numbers`);
        const numbers = parseNumbers(rest.join(" "));
        const result = await api.bulk({ numbers, focus: command === "focus" });
        print(result, () =>
          result.changed.length
            ? `${command === "focus" ? "Focus now on" : "Focus now off"}: ${result.changed.map((n) => `#${n}`).join(", ")}`
            : "Nothing to change",
        );
        return 0;
      }
      case "bulk": {
        if (!rest.length) throw new CliError("bulk needs issue numbers");
        const numbers = parseNumbers(rest.join(" "));
        const input: Parameters<typeof api.bulk>[0] = { numbers };
        const status = flag("status");
        if (status)
          input.status = resolveStatus((await api.board()).statuses, status);
        const priority = flag("priority");
        if (priority) input.priority = priority.toLowerCase();
        const labels = flag("label");
        if (labels) {
          const parts = labels
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean);
          const add = parts
            .filter((l) => !l.startsWith("-"))
            .map((l) => l.replace(/^\+/, ""));
          const remove = parts
            .filter((l) => l.startsWith("-"))
            .map((l) => l.slice(1));
          if (add.length) input.addLabels = add;
          if (remove.length) input.removeLabels = remove;
        }
        const due = flag("due");
        if (due !== undefined) input.due = parseDue(due);
        if (flags.has("focus")) input.focus = true;
        if (flags.has("unfocus")) input.focus = false;
        if (flags.has("archive")) input.archived = true;
        if (flags.has("unarchive")) input.archived = false;
        if (flags.has("delete")) input.delete = true;
        const result = await api.bulk(input);
        print(result, () =>
          result.deleted.length
            ? `Deleted ${result.deleted.map((n) => `#${n}`).join(", ")}`
            : result.changed.length
              ? `Changed ${result.changed.map((n) => `#${n}`).join(", ")}`
              : "Nothing to change",
        );
        return 0;
      }
      case "rm":
      case "delete": {
        const n = number(rest[0]);
        const result = await api.remove(n);
        print(result, () => `Deleted #${n}`);
        return 0;
      }
      case "watch": {
        const interval = Math.max(0.2, Number(flag("interval") ?? 3)) * 1000;
        let board = await api.board();
        let seq = board.seq;
        if (!json)
          io.out(`Watching ${board.issues.length} issues (Ctrl+C stops)…`);
        while (!io.signal?.aborted) {
          await sleep(interval, io.signal);
          if (io.signal?.aborted) break;
          try {
            const current = await api.seq();
            if (current.seq === seq) continue;
            const next = await api.board();
            for (const line of diffBoards(board, next))
              io.out(
                json
                  ? JSON.stringify({
                      at: new Date().toISOString(),
                      event: line,
                    })
                  : `${time(new Date().toISOString())}  ${line}`,
              );
            board = next;
            seq = next.seq;
          } catch (error) {
            io.err(String((error as Error).message));
          }
        }
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
    io.err(String((error as Error)?.message ?? error));
    return 1;
  }
}
