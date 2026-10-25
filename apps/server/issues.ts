import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_STATUSES,
  IssueError,
  MAX_ISSUES,
  addNote,
  deleteNote,
  editNote,
  bulkIssues,
  archiveColumn,
  issuesToMarkdown,
  renameLabel,
  setStatuses,
  statusOf,
  createIssue,
  find,
  matches,
  normalizeIssue,
  moveIssue,
  patchIssue,
  summarize,
  type Issue,
  type IssueBoard,
  type IssueFilter,
  type IssueStatus,
} from "../../packages/issues/model";

type State = {
  version: 1;
  /** Next issue number; numbers are never reused. */
  next: number;
  /** Bumped by every change, so open boards can poll for it. */
  seq: number;
  statuses: IssueStatus[];
  issues: Issue[];
};

/**
 * The workspace issue tracker (ADR-026), stored in issues.json. Each change is
 * applied to one issue at a time in a queue and written atomically, so the
 * browser board and agents using the CLI never overwrite each other.
 */
export class IssueStore {
  private file: string;
  private state: State | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    dataDir: string,
    private now: () => Date = () => new Date(),
  ) {
    this.file = path.join(dataDir, "issues.json");
  }

  private async load(): Promise<State> {
    if (this.state) return this.state;
    try {
      const data = JSON.parse(await readFile(this.file, "utf8"));
      const issues: Issue[] = Array.isArray(data?.issues)
        ? data.issues.map(normalizeIssue)
        : [];
      this.state = {
        version: 1,
        next: Math.max(
          Number(data?.next) || 1,
          ...issues.map((i) => i.number + 1),
        ),
        seq: Number(data?.seq) || 0,
        statuses:
          Array.isArray(data?.statuses) && data.statuses.length
            ? data.statuses
            : DEFAULT_STATUSES,
        issues,
      };
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
      this.state = {
        version: 1,
        next: 1,
        seq: 0,
        statuses: DEFAULT_STATUSES,
        issues: [],
      };
    }
    return this.state;
  }

  private change<T>(edit: (state: State) => { state: State; result: T }) {
    const run = this.queue.then(async () => {
      const current = await this.load();
      const { state, result } = edit(current);
      if (state !== current) {
        const next = { ...state, seq: current.seq + 1 };
        const temp = `${this.file}.${randomUUID()}.tmp`;
        await writeFile(temp, JSON.stringify(next));
        await rename(temp, this.file);
        this.state = next;
      }
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private clock() {
    return { now: this.now().toISOString(), id: () => randomUUID() };
  }

  private static replace(state: State, changed: Issue[]): State {
    if (!changed.length) return state;
    const byNumber = new Map(changed.map((i) => [i.number, i]));
    return {
      ...state,
      issues: state.issues.map((i) => byNumber.get(i.number) ?? i),
    };
  }

  async board(filter: IssueFilter = {}): Promise<IssueBoard> {
    await this.queue;
    const state = await this.load();
    return {
      seq: state.seq,
      statuses: state.statuses,
      issues: state.issues.filter((i) => matches(i, filter)).map(summarize),
    };
  }

  async seq(): Promise<number> {
    await this.queue;
    return (await this.load()).seq;
  }

  async get(number: number): Promise<Issue> {
    await this.queue;
    return find((await this.load()).issues, number);
  }

  create(input: unknown, author: string) {
    return this.change((state) => {
      if (state.issues.length >= MAX_ISSUES)
        throw new IssueError(400, `At most ${MAX_ISSUES} issues`);
      const issue = createIssue(
        state.issues,
        state.statuses,
        state.next,
        input as any,
        author,
        this.clock(),
      );
      return {
        state: {
          ...state,
          next: state.next + 1,
          issues: [...state.issues, issue],
        },
        result: issue,
      };
    });
  }

  /** `expected` is the If-Match version; a stale one is refused with 409. */
  patch(number: number, input: unknown, author: string, expected?: number) {
    return this.change((state) => {
      const current = find(state.issues, number);
      if (expected !== undefined && expected !== current.version)
        throw new IssueError(
          409,
          `Issue #${number} changed since it was loaded (version ${current.version})`,
        );
      const changed = patchIssue(
        state.issues,
        state.statuses,
        number,
        input as any,
        author,
        this.clock(),
      );
      return {
        state: IssueStore.replace(state, changed),
        result: changed[0] ?? current,
      };
    });
  }

  move(number: number, input: unknown, author: string) {
    return this.change((state) => {
      const changed = moveIssue(
        state.issues,
        state.statuses,
        number,
        input as any,
        author,
        this.clock(),
      );
      const next = IssueStore.replace(state, changed);
      return { state: next, result: find(next.issues, number) };
    });
  }

  note(number: number, input: unknown, author: string) {
    return this.change((state) => {
      const issue = addNote(
        state.issues,
        number,
        input as any,
        author,
        this.clock(),
      );
      return { state: IssueStore.replace(state, [issue]), result: issue };
    });
  }

  /** Board columns (rename, recolour, reorder, add, remove empty ones). */
  setStatuses(input: unknown) {
    return this.change((state) => {
      const statuses = setStatuses(state.issues, input);
      return { state: { ...state, statuses }, result: statuses };
    });
  }

  renameLabel(from: string, to: string | null, author: string) {
    return this.change((state) => {
      const changed = renameLabel(state.issues, from, to, author, this.clock());
      return {
        state: IssueStore.replace(state, changed),
        result: { changed: changed.length },
      };
    });
  }

  archiveColumn(status: string, author: string) {
    return this.change((state) => {
      statusOf(state.statuses, status);
      const changed = archiveColumn(state.issues, status, author, this.clock());
      return {
        state: IssueStore.replace(state, changed),
        result: { archived: changed.length },
      };
    });
  }

  async export(format: "json" | "md") {
    await this.queue;
    const state = await this.load();
    return format === "json"
      ? JSON.stringify(
          { statuses: state.statuses, issues: state.issues },
          null,
          2,
        )
      : issuesToMarkdown(
          state.issues,
          state.statuses,
          this.now().toISOString(),
        );
  }

  /** One change to many issues, saved as one write. */
  bulk(input: unknown, author: string) {
    return this.change((state) => {
      const result = bulkIssues(
        state.issues,
        state.statuses,
        input as any,
        author,
        this.clock(),
      );
      if (!result.changed.length && !result.deleted.length)
        return { state, result: { changed: [], deleted: [] } };
      return {
        state: { ...state, issues: result.issues },
        result: { changed: result.changed, deleted: result.deleted },
      };
    });
  }

  editNote(number: number, id: string, input: unknown, author: string) {
    return this.change((state) => {
      const before = find(state.issues, number);
      const issue = editNote(
        state.issues,
        number,
        id,
        input as any,
        author,
        this.clock(),
      );
      return {
        state: issue === before ? state : IssueStore.replace(state, [issue]),
        result: issue,
      };
    });
  }

  deleteNote(number: number, id: string, author: string) {
    return this.change((state) => {
      const issue = deleteNote(state.issues, number, id, author, this.clock());
      return { state: IssueStore.replace(state, [issue]), result: issue };
    });
  }

  remove(number: number) {
    return this.change((state) => {
      find(state.issues, number);
      return {
        state: {
          ...state,
          issues: state.issues.filter((i) => i.number !== number),
        },
        result: { deleted: number },
      };
    });
  }
}
