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
  /** Set when a written note was changed afterwards. */
  editedAt?: string;
  editedBy?: string;
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
  /** "Focus now": set by hand, cleared when the issue reaches the last column. */
  focusedAt: string | null;
  /** Deadline (ISO date-time). Within 24 h of it the issue is in focus too. */
  due: string | null;
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

const dueSchema = z
  .string()
  .datetime({ offset: true, message: "Deadline must be an ISO date-time" });
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
    focus: z.boolean().optional(),
    due: dueSchema.nullable().optional(),
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
    focus: z.boolean(),
    due: dueSchema.nullable(),
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
    focusedAt: data.focus ? clock.now : null,
    due: data.due ? new Date(data.due).toISOString() : null,
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
      // done: no longer something to focus on
      focusedAt:
        statusChanged && isDone(statuses, status)
          ? null
          : (issue.focusedAt ?? null),
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
  if (data.focus !== undefined && data.focus !== !!next.focusedAt) {
    next.focusedAt =
      data.focus && !isDone(statuses, next.status) ? clock.now : null;
    edited = next.focusedAt !== (moved.focusedAt ?? null) || edited;
  }
  if (data.due !== undefined) {
    const due = data.due ? new Date(data.due).toISOString() : null;
    if (due !== (next.due ?? null)) {
      next.due = due;
      edited = true;
    }
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

/** A written note (not an automatic created/status entry) of one issue. */
function writtenNote(issue: Issue, id: string): IssueNote {
  const found = issue.notes.find((n) => n.id === id);
  if (!found)
    throw new IssueError(404, `Note ${id} not found on #${issue.number}`);
  if (found.kind !== "note")
    throw new IssueError(400, "Automatic notes cannot be changed");
  return found;
}

/** Changes the text of a written note; it is marked as edited. */
export function editNote(
  issues: Issue[],
  number: number,
  id: string,
  input: z.input<typeof noteSchema>,
  author: string,
  clock: Clock,
): Issue {
  const { text } = noteSchema.parse(input);
  const issue = find(issues, number);
  const target = writtenNote(issue, id);
  if (target.text === text) return issue;
  return touch(
    issue,
    clock,
    {
      notes: issue.notes.map((n) =>
        n.id === id ? { ...n, text, editedAt: clock.now, editedBy: author } : n,
      ),
    },
    author,
  );
}

/** Removes a written note. */
export function deleteNote(
  issues: Issue[],
  number: number,
  id: string,
  author: string,
  clock: Clock,
): Issue {
  const issue = find(issues, number);
  writtenNote(issue, id);
  return touch(
    issue,
    clock,
    { notes: issue.notes.filter((n) => n.id !== id) },
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
    focusedAt: issue.focusedAt ?? null,
    due: issue.due ?? null,
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

export const bulkSchema = z
  .object({
    numbers: z.array(z.number().int().positive()).min(1).max(500),
    status: z.string().max(40).optional(),
    priority: z.enum(PRIORITIES).optional(),
    addLabels: labels.optional(),
    removeLabels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    archived: z.boolean().optional(),
    focus: z.boolean().optional(),
    due: dueSchema.nullable().optional(),
    delete: z.literal(true).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.delete
        ? b.status === undefined &&
          b.priority === undefined &&
          !b.addLabels &&
          !b.removeLabels &&
          b.archived === undefined &&
          b.focus === undefined &&
          b.due === undefined
        : b.status !== undefined ||
          b.priority !== undefined ||
          !!b.addLabels?.length ||
          !!b.removeLabels?.length ||
          b.archived !== undefined ||
          b.focus !== undefined ||
          b.due !== undefined,
    "Give one change (status, priority, labels, archived, focus, due) or delete alone",
  );

/**
 * One change applied to several issues at once (the board's selection, or an
 * agent). Status changes keep the issues' board order and add status notes.
 * Returns the full new issue list plus what changed and what was deleted.
 */
export function bulkIssues(
  issues: Issue[],
  statuses: IssueStatus[],
  input: z.input<typeof bulkSchema>,
  author: string,
  clock: Clock,
): { issues: Issue[]; changed: number[]; deleted: number[] } {
  const data = bulkSchema.parse(input);
  const wanted = [...new Set(data.numbers)];
  for (const n of wanted) find(issues, n);
  if (data.delete) {
    const gone = new Set(wanted);
    return {
      issues: issues.filter((i) => !gone.has(i.number)),
      changed: [],
      deleted: wanted,
    };
  }
  if (data.status !== undefined) statusOf(statuses, data.status);
  // board order: by column, then rank, so moved issues keep their order
  const order = new Map(
    statuses.flatMap((s) => column(issues, s.key)).map((i, k) => [i.number, k]),
  );
  wanted.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  let list = issues;
  const replace = (changed: Issue[]) => {
    const byNumber = new Map(changed.map((i) => [i.number, i]));
    list = list.map((i) => byNumber.get(i.number) ?? i);
  };
  const changed = new Set<number>();
  for (const n of wanted) {
    if (data.status !== undefined && find(list, n).status !== data.status) {
      const moved = moveIssue(
        list,
        statuses,
        n,
        { status: data.status },
        author,
        clock,
      );
      replace(moved);
      if (moved.length) changed.add(n);
    }
    const issue = find(list, n);
    const fields: Partial<Issue> = {};
    if (data.priority !== undefined && data.priority !== issue.priority)
      fields.priority = data.priority;
    if (data.addLabels?.length || data.removeLabels?.length) {
      const drop = new Set(
        (data.removeLabels ?? []).map((l) => l.toLowerCase()),
      );
      const next = [
        ...new Set([
          ...issue.labels.filter((l) => !drop.has(l.toLowerCase())),
          ...(data.addLabels ?? []).filter(
            (l) =>
              !drop.has(l.toLowerCase()) &&
              !issue.labels.some((x) => x.toLowerCase() === l.toLowerCase()),
          ),
        ]),
      ].slice(0, 20);
      if (next.join("\n") !== issue.labels.join("\n")) fields.labels = next;
    }
    if (data.archived !== undefined && data.archived !== !!issue.archivedAt)
      fields.archivedAt = data.archived ? clock.now : null;
    if (data.focus !== undefined) {
      const focusedAt =
        data.focus && !isDone(statuses, issue.status)
          ? (issue.focusedAt ?? clock.now)
          : null;
      if (focusedAt !== (issue.focusedAt ?? null)) fields.focusedAt = focusedAt;
    }
    if (data.due !== undefined) {
      const due = data.due ? new Date(data.due).toISOString() : null;
      if (due !== (issue.due ?? null)) fields.due = due;
    }
    if (Object.keys(fields).length) {
      replace([touch(issue, clock, fields, author)]);
      changed.add(n);
    }
  }
  return {
    issues: list,
    changed: [...changed].sort((a, b) => a - b),
    deleted: [],
  };
}

export const DUE_SOON_MS = 24 * 60 * 60 * 1000;

export type FocusState = {
  /** Shown with the Focus now effect. */
  focused: boolean;
  /** Why: set by hand, or the deadline is within 24 h (or past). */
  reason: "manual" | "due" | null;
  /** Focus now was also set by hand (the deadline may still decide the colour). */
  manual: boolean;
  /** Milliseconds left until the deadline (negative when overdue). */
  dueIn: number | null;
  overdue: boolean;
};

/**
 * Whether an issue is "in focus" right now: Focus now was set by hand, or its
 * deadline is less than 24 hours away (or past) — never once it is done. When
 * both apply the reason is "due": the deadline decides (shown in red).
 */
export function focusState(
  issue: Pick<Issue, "status" | "focusedAt" | "due">,
  statuses: IssueStatus[],
  now: number,
): FocusState {
  const done = isDone(statuses, issue.status);
  const dueIn = issue.due ? Date.parse(issue.due) - now : null;
  const overdue = !done && dueIn !== null && dueIn < 0;
  const manual = !!issue.focusedAt;
  if (done)
    return {
      focused: false,
      reason: null,
      manual: false,
      dueIn,
      overdue: false,
    };
  // a deadline within 24 h (or past) wins over Focus now set by hand
  if (dueIn !== null && dueIn <= DUE_SOON_MS)
    return { focused: true, reason: "due", manual, dueIn, overdue };
  if (manual)
    return { focused: true, reason: "manual", manual, dueIn, overdue };
  return { focused: false, reason: null, manual, dueIn, overdue };
}

/** "in 5h", "in 3d", "2h ago" for a deadline. */
export function dueLabel(dueIn: number): string {
  const abs = Math.abs(dueIn);
  const minutes = Math.round(abs / 60000);
  const text =
    minutes < 60
      ? `${Math.max(1, minutes)}m`
      : minutes < 48 * 60
        ? `${Math.round(minutes / 60)}h`
        : `${Math.round(minutes / 1440)}d`;
  return dueIn < 0 ? `${text} overdue` : `in ${text}`;
}
