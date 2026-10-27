import { readFileSync } from "node:fs";
import type {
  Issue,
  IssueBoard,
  IssueStatus,
  IssueSummary,
} from "../../packages/issues/model";

/**
 * The issue API over HTTP, shared by the `lotion issue` CLI and the MCP
 * server (ADR-026). Configured from LOTION_URL and LOTION_TOKEN(_FILE).
 */

export class LotionError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

export type ClientOptions = {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  author: string;
};

export type IssueInput = {
  title?: string;
  body?: string;
  status?: string;
  labels?: string[];
  priority?: string;
  links?: string[];
  archived?: boolean;
  focus?: boolean;
  due?: string | null;
};

export function issueClient({ env, fetch, author }: ClientOptions) {
  const base = (env.LOTION_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
  let token = env.LOTION_TOKEN;
  if (!token && env.LOTION_TOKEN_FILE)
    token = readFileSync(env.LOTION_TOKEN_FILE, "utf8").trim();
  async function call<T>(
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const all: Record<string, string> = {
      "X-Lotion-Author": author,
      ...headers,
    };
    if (token) all.Authorization = `Bearer ${token}`;
    if (body !== undefined) all["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await fetch(base + url, {
        method,
        headers: all,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new LotionError(
        `Cannot reach Lotion at ${base} (${(error as Error).message})`,
      );
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new LotionError(
        response.status === 401
          ? "The server needs a token: set LOTION_TOKEN or LOTION_TOKEN_FILE"
          : `${data.error ?? response.statusText} (HTTP ${response.status})`,
        response.status,
      );
    return data as T;
  }
  const query = (filter: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(filter))
      if (value) q.set(key, value);
    return q.size ? `?${q}` : "";
  };
  return {
    board: (filter: Record<string, string | undefined> = {}) =>
      call<IssueBoard>("GET", `/api/issues${query(filter)}`),
    seq: () => call<{ seq: number }>("GET", "/api/issues/seq"),
    get: (n: number) => call<Issue>("GET", `/api/issues/${n}`),
    create: (input: IssueInput) => call<Issue>("POST", "/api/issues", input),
    patch: (n: number, input: IssueInput, version?: number) =>
      call<Issue>(
        "PATCH",
        `/api/issues/${n}`,
        input,
        version === undefined ? {} : { "If-Match": `"${version}"` },
      ),
    move: (n: number, status: string, before?: number | null) =>
      call<Issue>("POST", `/api/issues/${n}/move`, {
        status,
        ...(before === undefined ? {} : { before }),
      }),
    note: (n: number, text: string) =>
      call<Issue>("POST", `/api/issues/${n}/notes`, { text }),
    exportText: async (format: "md" | "json") => {
      const headers: Record<string, string> = { "X-Lotion-Author": author };
      if (token) headers.Authorization = `Bearer ${token}`;
      let response: Response;
      try {
        response = await fetch(`${base}/api/issues/export?format=${format}`, {
          headers,
        });
      } catch (error) {
        throw new LotionError(
          `Cannot reach Lotion at ${base} (${(error as Error).message})`,
        );
      }
      if (!response.ok)
        throw new LotionError(
          `Export failed (HTTP ${response.status})`,
          response.status,
        );
      return response.text();
    },
    bulk: (input: {
      numbers: number[];
      status?: string;
      priority?: string;
      addLabels?: string[];
      removeLabels?: string[];
      archived?: boolean;
      focus?: boolean;
      due?: string | null;
      delete?: true;
    }) =>
      call<{ changed: number[]; deleted: number[] }>(
        "POST",
        "/api/issues/bulk",
        input,
      ),
    remove: (n: number) =>
      call<{ deleted: number }>("DELETE", `/api/issues/${n}`),
  };
}

export type IssueClient = ReturnType<typeof issueClient>;

/**
 * A deadline from the command line, in local time: "2026-10-30" (end of that
 * day), "2026-10-30 18:00", an ISO date-time, "+2d" / "+5h" / "+30m", or
 * "none" to clear it.
 */
export function parseDue(text: string, now = new Date()): string | null {
  const value = text.trim();
  if (/^(none|clear|-)$/i.test(value)) return null;
  const rel = /^\+(\d+)\s*([dhm])$/i.exec(value);
  if (rel) {
    const unit = { d: 86400000, h: 3600000, m: 60000 }[
      rel[2].toLowerCase() as "d" | "h" | "m"
    ];
    return new Date(now.getTime() + Number(rel[1]) * unit).toISOString();
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day)
    return new Date(
      Number(day[1]),
      Number(day[2]) - 1,
      Number(day[3]),
      23,
      59,
    ).toISOString();
  const local = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(value);
  if (local)
    return new Date(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
    ).toISOString();
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed))
    throw new LotionError(
      `Not a deadline: "${text}". Use 2026-10-30, "2026-10-30 18:00", +2d or none`,
      400,
    );
  return new Date(parsed).toISOString();
}

/** "3,5,8-10" or "#3 #5" → [3, 5, 8, 9, 10]. */
export function parseNumbers(text: string): number[] {
  const out: number[] = [];
  for (const part of text.split(/[\s,]+/).filter(Boolean)) {
    const range = /^#?(\d+)-#?(\d+)$/.exec(part);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
      if (b - a > 500) throw new LotionError(`Range ${part} is too long`, 400);
      for (let n = a; n <= b; n++) out.push(n);
      continue;
    }
    const n = Number(part.replace(/^#/, ""));
    if (!Number.isSafeInteger(n) || n < 1)
      throw new LotionError(`Not an issue number: ${part}`, 400);
    out.push(n);
  }
  return [...new Set(out)];
}

/** A status by key or name, case-insensitive. */
export function resolveStatus(statuses: IssueStatus[], value: string): string {
  const v = value.trim().toLowerCase();
  const found = statuses.find(
    (s) => s.key.toLowerCase() === v || s.name.toLowerCase() === v,
  );
  if (!found)
    throw new LotionError(
      `Unknown status "${value}". Use one of: ${statuses.map((s) => s.key).join(", ")}`,
      400,
    );
  return found.key;
}

/** Where `claim` puts an issue: "doing" if it exists, else the column before the last. */
export function workingStatus(statuses: IssueStatus[]): string {
  return (
    statuses.find((s) => s.key === "doing")?.key ??
    statuses[Math.max(0, statuses.length - 2)].key
  );
}

/** Applies `+label` / `-label` / `label` edits to a label list. */
export function editLabels(labels: string[], edits: string[]): string[] {
  let next = [...labels];
  for (const raw of edits)
    for (const part of raw.split(",")) {
      const edit = part.trim();
      if (!edit) continue;
      if (edit.startsWith("-")) {
        const name = edit.slice(1).toLowerCase();
        next = next.filter((l) => l.toLowerCase() !== name);
      } else {
        const name = edit.replace(/^\+/, "");
        if (!next.some((l) => l.toLowerCase() === name.toLowerCase()))
          next.push(name);
      }
    }
  return next;
}

/**
 * What changed between two board snapshots, as readable lines (for `watch`).
 * Created, moved, re-titled, newly noted and deleted issues.
 */
export function diffBoards(prev: IssueBoard, next: IssueBoard): string[] {
  const name = (key: string) =>
    next.statuses.find((s) => s.key === key)?.name ?? key;
  const before = new Map(prev.issues.map((i) => [i.number, i]));
  const lines: string[] = [];
  const by = (i: IssueSummary) => (i.updatedBy ? ` by ${i.updatedBy}` : "");
  for (const issue of [...next.issues].sort((a, b) => a.number - b.number)) {
    const old = before.get(issue.number);
    before.delete(issue.number);
    if (!old) {
      lines.push(
        `#${issue.number} created in ${name(issue.status)}${by(issue)}: ${issue.title}`,
      );
    } else if (old.version !== issue.version) {
      if (old.status !== issue.status)
        lines.push(
          `#${issue.number} ${name(old.status)} → ${name(issue.status)}${by(issue)}: ${issue.title}`,
        );
      if (old.title !== issue.title)
        lines.push(`#${issue.number} renamed${by(issue)}: ${issue.title}`);
    } else continue;
    if (
      issue.noteCount > (old?.noteCount ?? 1) &&
      issue.lastNote?.kind === "note"
    )
      lines.push(
        `#${issue.number} note by ${issue.lastNote.author}: ${issue.lastNote.text.split("\n")[0].slice(0, 120)}`,
      );
  }
  for (const gone of before.values())
    lines.push(`#${gone.number} deleted: ${gone.title}`);
  return lines;
}
