import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATUSES,
  addNote,
  column,
  createIssue,
  matches,
  moveIssue,
  parseAuthor,
  patchIssue,
  rankBetween,
  type Issue,
} from "../../packages/issues/model";
import { applyLocalMove, dropTarget } from "../../apps/web/issues/board-order";
import { parseIssueHash } from "../../apps/web/issues/issues-route";

let n = 0;
const clock = (now = "2026-10-22T10:00:00.000Z") => ({
  now,
  id: () => `note-${++n}`,
});

function seed(count: number, status = "backlog"): Issue[] {
  const issues: Issue[] = [];
  for (let i = 1; i <= count; i++)
    issues.push(
      createIssue(
        issues,
        DEFAULT_STATUSES,
        i,
        { title: `Issue ${i}`, status },
        "me",
        clock(),
      ),
    );
  return issues;
}

const apply = (issues: Issue[], changed: Issue[]) => {
  const map = new Map(changed.map((i) => [i.number, i]));
  return issues.map((i) => map.get(i.number) ?? i);
};

describe("issue model", () => {
  it("creates at the end of the first column with a created note", () => {
    const issues = seed(3);
    expect(column(issues, "backlog").map((i) => i.number)).toEqual([1, 2, 3]);
    expect(issues[0]).toMatchObject({
      status: "backlog",
      version: 1,
      closedAt: null,
      labels: [],
    });
    expect(issues[0].notes).toEqual([
      expect.objectContaining({ kind: "created", author: "me" }),
    ]);
  });

  it("rejects bad input: empty title, unknown status, commas in labels", () => {
    expect(() =>
      createIssue([], DEFAULT_STATUSES, 1, { title: " " }, "me", clock()),
    ).toThrow(/title/);
    expect(() =>
      createIssue(
        [],
        DEFAULT_STATUSES,
        1,
        { title: "x", status: "nope" },
        "me",
        clock(),
      ),
    ).toThrow(/Unknown status/);
    expect(() =>
      createIssue(
        [],
        DEFAULT_STATUSES,
        1,
        { title: "x", labels: ["a,b"] },
        "me",
        clock(),
      ),
    ).toThrow(/commas/);
  });

  it("moves across columns with a status note and closes in the last column", () => {
    let issues = seed(2);
    const [moved] = moveIssue(
      issues,
      DEFAULT_STATUSES,
      1,
      { status: "done" },
      "codex",
      clock("2026-10-22T11:00:00.000Z"),
    );
    expect(moved).toMatchObject({
      status: "done",
      version: 2,
      closedAt: "2026-10-22T11:00:00.000Z",
    });
    expect(moved.notes.at(-1)).toMatchObject({
      kind: "status",
      author: "codex",
      text: "Backlog → Done",
      from: "backlog",
      to: "done",
    });
    issues = apply(issues, [moved]);
    const [back] = moveIssue(
      issues,
      DEFAULT_STATUSES,
      1,
      { status: "doing" },
      "me",
      clock(),
    );
    expect(back.closedAt).toBeNull();
  });

  it("reorders inside a column without a note, and a no-op move changes nothing", () => {
    let issues = seed(3);
    const changed = moveIssue(
      issues,
      DEFAULT_STATUSES,
      3,
      { status: "backlog", before: 1 },
      "me",
      clock(),
    );
    issues = apply(issues, changed);
    expect(column(issues, "backlog").map((i) => i.number)).toEqual([3, 1, 2]);
    expect(changed[0].notes).toHaveLength(1);
    expect(
      moveIssue(
        issues,
        DEFAULT_STATUSES,
        3,
        { status: "backlog", before: 1 },
        "me",
        clock(),
      ),
    ).toEqual([]);
    expect(() =>
      moveIssue(
        issues,
        DEFAULT_STATUSES,
        3,
        { status: "done", before: 1 },
        "me",
        clock(),
      ),
    ).toThrow(/not in the done column/);
  });

  it("renumbers a column when repeated moves exhaust the gap", () => {
    let issues = seed(3);
    for (let i = 0; i < 80; i++) {
      // alternate 2 and 3 into the slot right after #1
      const mover = i % 2 ? 2 : 3;
      const target = column(issues, "backlog")
        .filter((x) => x.number !== mover)
        .at(1)!.number;
      issues = apply(
        issues,
        moveIssue(
          issues,
          DEFAULT_STATUSES,
          mover,
          { status: "backlog", before: target },
          "me",
          clock(),
        ),
      );
      const ranks = column(issues, "backlog").map((x) => x.rank);
      expect(new Set(ranks).size).toBe(3);
    }
    expect(rankBetween(1, 1 + 1e-12)).toBeNull();
    expect(rankBetween(undefined, undefined)).toBe(1);
    expect(rankBetween(undefined, 4)).toBe(3);
    expect(rankBetween(2, 3)).toBe(2.5);
  });

  it("patches fields once per version, moving to the end of a new status", () => {
    const issues = seed(2);
    const [edited] = patchIssue(
      issues,
      DEFAULT_STATUSES,
      1,
      { title: "Renamed", labels: ["bug", "bug", "ui"], status: "doing" },
      "me",
      clock(),
    );
    expect(edited).toMatchObject({
      title: "Renamed",
      labels: ["bug", "ui"],
      status: "doing",
      version: 2,
    });
    expect(
      patchIssue(
        issues,
        DEFAULT_STATUSES,
        2,
        { title: "Issue 2" },
        "me",
        clock(),
      ),
    ).toEqual([]);
  });

  it("appends notes and keeps the author", () => {
    const issues = seed(1);
    const next = addNote(
      issues,
      1,
      { text: "  half done  " },
      "claude",
      clock(),
    );
    expect(next.notes.at(-1)).toMatchObject({
      kind: "note",
      text: "half done",
      author: "claude",
    });
    expect(() => addNote(issues, 1, { text: " " }, "me", clock())).toThrow();
    expect(() => addNote(issues, 9, { text: "x" }, "me", clock())).toThrow(
      /#9 not found/,
    );
  });

  it("filters by status, label and text", () => {
    const one = createIssue(
      [],
      DEFAULT_STATUSES,
      7,
      { title: "Paste bug", body: "lists break", labels: ["Bug"] },
      "me",
      clock(),
    );
    expect(matches(one, { label: "bug" })).toBe(true);
    expect(matches(one, { q: "LISTS" })).toBe(true);
    expect(matches(one, { q: "#7" })).toBe(true);
    expect(matches(one, { status: "done" })).toBe(false);
  });

  it("parses the author header", () => {
    expect(parseAuthor(undefined)).toBe("me");
    expect(parseAuthor(" codex ")).toBe("codex");
    expect(() => parseAuthor("a b")).toThrow();
  });
});

describe("board helpers", () => {
  it("finds the drop position from the pointer", () => {
    const cards = [
      { number: 1, top: 0, height: 40 },
      { number: 2, top: 50, height: 40 },
      { number: 3, top: 100, height: 40 },
    ];
    expect(dropTarget(cards, 3, 10)).toBe(1);
    expect(dropTarget(cards, 3, 60)).toBe(2);
    expect(dropTarget(cards, 1, 30)).toBe(2);
    expect(dropTarget(cards, 1, 200)).toBeNull();
  });

  it("applies an optimistic move", () => {
    const issues = seed(3).map((i) => ({
      ...i,
      noteCount: 1,
      lastNote: null,
    }));
    const next = applyLocalMove(issues, 3, "backlog", 1);
    expect(
      next
        .filter((i) => i.status === "backlog")
        .sort((a, b) => a.rank - b.rank)
        .map((i) => i.number),
    ).toEqual([3, 1, 2]);
    expect(applyLocalMove(issues, 1, "done", null)[0]).toMatchObject({
      status: "done",
      rank: 1,
    });
  });

  it("parses issue routes", () => {
    expect(parseIssueHash("#/issues")).toEqual({ number: null });
    expect(parseIssueHash("#/issues/12")).toEqual({ number: 12 });
    expect(parseIssueHash("#/page/abc")).toBeNull();
    expect(parseIssueHash("#/issues/x")).toBeNull();
  });
});
