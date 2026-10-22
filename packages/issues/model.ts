import { z } from "zod";

/**
 * Personal issue tracker domain (ADR-026): issues with a status column, an
 * order inside the column and an append-only thread of status notes. Pure —
 * no storage, network or browser access.
 */

export type IssueStatus = { key: string; name: string; color: string };

export const DEFAULT_STATUSES: IssueStatus[] = [
  { key: "backlog", name: "Backlog", color: "gray" },
  { key: "todo", name: "Todo", color: "yellow" },
  { key: "doing", name: "In progress", color: "blue" },
  { key: "done", name: "Done", color: "green" },
];

export const PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
export type IssuePriority = (typeof PRIORITIES)[number];
export const PRIORITY_NAMES: Record<IssuePriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export type NoteKind = "created" | "status" | "note";

export type IssueNote = {
  id: string;
  at: string;
  author: string;
  kind: NoteKind;
  text: string;
  from?: string;
  to?: string;
};

export type Issue = {
  number: number;
  title: string;
  body: string;
  status: string;
  labels: string[];
  priority: IssuePriority;
  /** Lotion pages this issue is about (page ids). */
  links: string[];
  /** The block an issue was made from ("Create issue" in the block menu). */
  source?: { pageId: string; blockId: string };
  /** Archived issues are hidden from the board unless asked for. */
  archivedAt: string | null;
  /** Position inside the status column, ascending. */
  rank: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  /** Bumped by every change; PATCH may require it (If-Match). */
  version: number;
  /** Who made the latest change (an older file may not have it). */
  updatedBy?: string;
  notes: IssueNote[];
};

/** An issue without its thread, as the board lists it. */
export type IssueSummary = Omit<Issue, "notes"> & {
  noteCount: number;
  lastNote: IssueNote | null;
};

export type IssueBoard = {
  seq: number;
  statuses: IssueStatus[];
  issues: IssueSummary[];
};

export const MAX_ISSUES = 10_000;
export const MAX_NOTES = 1_000;

const label = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((s) => !/[,\n]/.test(s), "Labels cannot contain commas");
const labels = z
  .array(label)
  .max(20)
  .transform((list) => [...new Set(list)]);

const pageId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/, "Invalid page id");
const links = z
  .array(pageId)
  .max(50)
  .transform((list) => [...new Set(list)]);

export const createIssueSchema = z
  .object({
    title: z.string().trim().min(1, "A title is required").max(300),
    body: z.string().max(100_000).default(""),
    status: z.string().max(40).optional(),
    labels: labels.default([]),
    priority: z.enum(PRIORITIES).default("none"),
    links: links.default([]),
    source: z.object({ pageId, blockId: pageId }).strict().optional(),
  })
  .strict();

export const patchIssueSchema = z
  .object({
    title: z.string().trim().min(1, "A title is required").max(300),
    body: z.string().max(100_000),
    status: z.string().max(40),
    labels,
    priority: z.enum(PRIORITIES),
    links,
    archived: z.boolean(),
  })
  .partial()
  .strict();

export const moveIssueSchema = z
  .object({
    status: z.string().max(40),
    /** Place before this issue (same column); absent or null = at the end. */
    before: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const noteSchema = z
  .object({ text: z.string().trim().min(1, "A note is empty").max(20_000) })
  .strict();

const AUTHOR = /^[A-Za-z0-9_.-]{1,32}$/;
/** Who made a change: the X-Lotion-Author header, "me" when absent. */
export function parseAuthor(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "me";
  if (!AUTHOR.test(text))
    throw new IssueError(400, "Author must be 1-32 letters, digits, _ . -");
  return text;
}

export class IssueError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function statusOf(statuses: IssueStatus[], key: string): IssueStatus {
  const found = statuses.find((s) => s.key === key);
  if (!found) throw new IssueError(400, `Unknown status: ${key}`);
  return found;
}

const isDone = (statuses: IssueStatus[], key: string) =>
  key === statuses.at(-1)?.key;

/** Issues of one column in board order. */
export function column(issues: Issue[], status: string): Issue[] {
  return issues
    .filter((i) => i.status === status)
    .sort((a, b) => a.rank - b.rank || a.number - b.number);
}

/**
 * A rank between two neighbours (either may be missing). Returns null when the
 * gap is too small to split, so the caller renumbers the column first.
 */
export function rankBetween(
  prev: number | undefined,
  next: number | undefined,
): number | null {
  if (prev === undefined && next === undefined) return 1;
  if (prev === undefined) return (next as number) - 1;
  if (next === undefined) return prev + 1;
  const mid = (prev + next) / 2;
  return mid > prev && mid < next && next - prev > 1e-9 ? mid : null;
}

type Clock = { now: string; id: () => string };

function note(
  clock: Clock,
  author: string,
  kind: NoteKind,
  text: string,
  extra: Partial<IssueNote> = {},
): IssueNote {
  return { id: clock.id(), at: clock.now, author, kind, text, ...extra };
}

/** A new issue at the end of its column. */
export function createIssue(
  issues: Issue[],
  statuses: IssueStatus[],
  number: number,
  input: z.input<typeof createIssueSchema>,
  author: string,
  clock: Clock,
): Issue {
  const data = createIssueSchema.parse(input);
  const status = statusOf(statuses, data.status ?? statuses[0].key).key;
  const last = column(issues, status).at(-1);
  return {
    number,
    title: data.title,
    body: data.body,
    status,
    labels: data.labels,
    priority: data.priority,
    links: data.links,
    ...(data.source ? { source: data.source } : {}),
    archivedAt: null,
    rank: rankBetween(last?.rank, undefined) as number,
    createdAt: clock.now,
    updatedAt: clock.now,
    closedAt: isDone(statuses, status) ? clock.now : null,
    version: 1,
    updatedBy: author,
    notes: [note(clock, author, "created", "Created")],
  };
}

/**
 * Moves an issue to a column position. Returns every issue whose rank or status
 * changed (the moved one first); a status change adds a status note.
 */
export function moveIssue(
  issues: Issue[],
  statuses: IssueStatus[],
  number: number,
  input: z.input<typeof moveIssueSchema>,
  author: string,
  clock: Clock,
): Issue[] {
  const { status, before } = moveIssueSchema.parse(input);
  statusOf(statuses, status);
  const issue = find(issues, number);
  if (before === number) return [];
  const others = column(issues, status).filter((i) => i.number !== number);
  let index = others.length;
  if (before !== undefined && before !== null) {
    index = others.findIndex((i) => i.number === before);
    if (index < 0)
      throw new IssueError(400, `#${before} is not in the ${status} column`);
  }
  if (
    issue.status === status &&
    column(issues, status).findIndex((i) => i.number === number) === index
  )
    return [];
  const changed = new Map<number, Issue>();
  let rank = rankBetween(others[index - 1]?.rank, others[index]?.rank);
  if (rank === null) {
    // too many moves into one gap: renumber the column 1, 2, 3, ...
    const neighbours = others.map((other, i) => {
      if (other.rank === i + 1) return other;
      const renumbered = {
        ...other,
        rank: i + 1,
        version: other.version + 1,
      };
      changed.set(other.number, renumbered);
      return renumbered;
    });
    rank = rankBetween(
      neighbours[index - 1]?.rank,
      neighbours[index]?.rank,
    ) as number;
  }
  const statusChanged = issue.status !== status;
  if (!statusChanged && issue.rank === rank) return [...changed.values()];
  const moved = touch(
    issue,
    clock,
    {
      status,
      rank,
      closedAt: statusChanged
        ? isDone(statuses, status)
          ? clock.now
          : null
        : issue.closedAt,
      notes: statusChanged
        ? [
            ...issue.notes,
            note(
              clock,
              author,
              "status",
              `${statusOf(statuses, issue.status).name} → ${statusOf(statuses, status).name}`,
              { from: issue.status, to: status },
            ),
          ].slice(-MAX_NOTES)
        : issue.notes,
    },
    author,
  );
  return [moved, ...changed.values()];
}

/** Title, body, labels, priority and (moved to the end of the column) status changes. */
export function patchIssue(
  issues: Issue[],
  statuses: IssueStatus[],
  number: number,
  input: z.input<typeof patchIssueSchema>,
  author: string,
  clock: Clock,
): Issue[] {
  const data = patchIssueSchema.parse(input);
  const issue = find(issues, number);
  let result = [issue];
  if (data.status !== undefined && data.status !== issue.status)
    result = moveIssue(
      issues,
      statuses,
      number,
      { status: data.status },
      author,
      clock,
    );
  const [moved, ...rest] = result;
  const next = { ...moved };
  let edited = false;
  for (const key of ["title", "body"] as const)
    if (data[key] !== undefined && data[key] !== next[key]) {
      next[key] = data[key];
      edited = true;
    }
  if (data.priority !== undefined && data.priority !== next.priority) {
    next.priority = data.priority;
    edited = true;
  }
  if (
    data.labels !== undefined &&
    data.labels.join("\n") !== next.labels.join("\n")
  ) {
    next.labels = data.labels;
    edited = true;
  }
  if (
    data.links !== undefined &&
    data.links.join("\n") !== (next.links ?? []).join("\n")
  ) {
    next.links = data.links;
    edited = true;
  }
  if (data.archived !== undefined && data.archived !== !!next.archivedAt) {
    next.archivedAt = data.archived ? clock.now : null;
    edited = true;
  }
  if (!edited) return moved === issue ? [] : result;
  return [
    moved === issue
      ? touch(next, clock, {}, author)
      : { ...next, updatedBy: author },
    ...rest,
  ];
}

export function addNote(
  issues: Issue[],
  number: number,
  input: z.input<typeof noteSchema>,
  author: string,
  clock: Clock,
): Issue {
  const { text } = noteSchema.parse(input);
  const issue = find(issues, number);
  return touch(
    issue,
    clock,
    {
      notes: [...issue.notes, note(clock, author, "note", text)].slice(
        -MAX_NOTES,
      ),
    },
    author,
  );
}

export function find(issues: Issue[], number: number): Issue {
  const issue = issues.find((i) => i.number === number);
  if (!issue) throw new IssueError(404, `Issue #${number} not found`);
  return issue;
}

function touch(
  issue: Issue,
  clock: Clock,
  changes: Partial<Issue>,
  author: string,
): Issue {
  return {
    ...issue,
    ...changes,
    updatedAt: clock.now,
    updatedBy: author,
    version: issue.version + 1,
  };
}

export function summarize(issue: Issue): IssueSummary {
  const { notes, ...rest } = issue;
  return { ...rest, noteCount: notes.length, lastNote: notes.at(-1) ?? null };
}

export type IssueFilter = {
  status?: string;
  label?: string;
  priority?: string;
  q?: string;
  /** Issues linked to (or made from) this page. */
  page?: string;
  /** "include" lists archived issues too, "only" lists just them; default hides them. */
  archived?: "include" | "only";
};

/** Older issues.json files lack priority, links and archivedAt. */
export function normalizeIssue(issue: Issue): Issue {
  return {
    ...issue,
    priority: PRIORITIES.includes(issue.priority) ? issue.priority : "none",
    links: Array.isArray(issue.links) ? issue.links : [],
    archivedAt: issue.archivedAt ?? null,
  };
}

/** Case-insensitive filter used by the list API and the CLI. */
export function matches(issue: Issue, filter: IssueFilter): boolean {
  if (filter.status && issue.status !== filter.status) return false;
  if (
    filter.archived === "only"
      ? !issue.archivedAt
      : !filter.archived && issue.archivedAt
  )
    return false;
  if (
    filter.page &&
    !(issue.links ?? []).includes(filter.page) &&
    issue.source?.pageId !== filter.page
  )
    return false;
  if (filter.priority && (issue.priority ?? "none") !== filter.priority)
    return false;
  if (
    filter.label &&
    !issue.labels.some((l) => l.toLowerCase() === filter.label!.toLowerCase())
  )
    return false;
  if (filter.q) {
    const q = filter.q.toLowerCase();
    if (
      !issue.title.toLowerCase().includes(q) &&
      !issue.body.toLowerCase().includes(q) &&
      `#${issue.number}` !== q
    )
      return false;
  }
  return true;
}

const STATUS_KEY = /^[a-z0-9_-]{1,40}$/;
export const STATUS_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

export const statusesSchema = z
  .array(
    z
      .object({
        key: z.string().regex(STATUS_KEY, "Status keys are a-z, 0-9, _ and -"),
        name: z.string().trim().min(1).max(40),
        color: z.enum(STATUS_COLORS),
      })
      .strict(),
  )
  .min(2, "A board needs at least two statuses")
  .max(12);

/**
 * New board columns (rename, recolour, reorder, add, remove). A status that
 * still has issues cannot be removed; the last one is the "closed" column.
 */
export function setStatuses(issues: Issue[], input: unknown): IssueStatus[] {
  const next = statusesSchema.parse(input);
  const keys = new Set(next.map((s) => s.key));
  if (keys.size !== next.length)
    throw new IssueError(400, "Status keys must be unique");
  const used = [...new Set(issues.map((i) => i.status))].filter(
    (key) => !keys.has(key),
  );
  if (used.length)
    throw new IssueError(
      400,
      `Move the issues out of ${used.join(", ")} before removing it`,
    );
  return next;
}

/** Renames a label on every issue, or removes it when `to` is null. */
export function renameLabel(
  issues: Issue[],
  from: string,
  to: string | null,
  author: string,
  clock: Clock,
): Issue[] {
  const target = to === null ? null : label.parse(to);
  const key = from.trim().toLowerCase();
  const changed: Issue[] = [];
  for (const issue of issues) {
    if (!issue.labels.some((l) => l.toLowerCase() === key)) continue;
    const labels = [
      ...new Set(
        issue.labels.flatMap((l) =>
          l.toLowerCase() === key ? (target === null ? [] : [target]) : [l],
        ),
      ),
    ];
    changed.push(touch(issue, clock, { labels }, author));
  }
  return changed;
}

/** Archives every unarchived issue of one column. */
export function archiveColumn(
  issues: Issue[],
  status: string,
  author: string,
  clock: Clock,
): Issue[] {
  return issues
    .filter((i) => i.status === status && !i.archivedAt)
    .map((i) => touch(i, clock, { archivedAt: clock.now }, author));
}

/** A Markdown document of the board: one section per status, notes included. */
export function issuesToMarkdown(
  issues: Issue[],
  statuses: IssueStatus[],
  now: string,
): string {
  const lines = [
    `# Issues`,
    "",
    `Exported ${now.slice(0, 16).replace("T", " ")}`,
    "",
  ];
  for (const status of statuses) {
    const items = column(issues, status.key);
    if (!items.length) continue;
    lines.push(`## ${status.name} (${items.length})`, "");
    for (const i of items) {
      const tags = [
        i.priority !== "none" ? `priority: ${i.priority}` : "",
        i.labels.length ? `labels: ${i.labels.join(", ")}` : "",
        i.archivedAt ? "archived" : "",
      ].filter(Boolean);
      lines.push(`### #${i.number} ${i.title}`, "");
      if (tags.length) lines.push(`_${tags.join(" · ")}_`, "");
      if (i.body.trim()) lines.push(i.body.trim(), "");
      for (const n of i.notes)
        lines.push(
          `- ${n.at.slice(0, 16).replace("T", " ")} **${n.author}**${n.kind === "note" ? "" : ` (${n.kind})`}: ${n.text.replaceAll("\n", " ")}`,
        );
      lines.push("");
    }
  }
  return lines.join("\n");
}
