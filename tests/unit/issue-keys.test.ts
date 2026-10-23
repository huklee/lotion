import { describe, expect, it } from "vitest";
import {
  boardKey,
  hintLabels,
  matchHint,
  type BoardColumns,
} from "../../apps/web/issues/issue-keys";
import {
  DEFAULT_STATUSES,
  createIssue,
  matches,
  normalizeIssue,
  patchIssue,
} from "../../packages/issues/model";

const columns: BoardColumns = [
  { status: "backlog", numbers: [1, 2, 3] },
  { status: "todo", numbers: [] },
  { status: "doing", numbers: [4, 5] },
  { status: "done", numbers: [6] },
];
const key = (k: string, focused: number | null, extra = {}) =>
  boardKey({ key: k, ...extra }, columns, focused);

describe("board keys", () => {
  it("starts at the first card and moves with j/k and arrows", () => {
    expect(key("j", null)).toEqual({ type: "focus", number: 1 });
    expect(key("j", 1)).toEqual({ type: "focus", number: 2 });
    expect(key("ArrowDown", 2)).toEqual({ type: "focus", number: 3 });
    expect(key("j", 3)).toBeNull();
    expect(key("k", 2)).toEqual({ type: "focus", number: 1 });
    expect(key("k", 1)).toBeNull();
  });

  it("h/l skip empty columns and keep the row where possible", () => {
    expect(key("l", 2)).toEqual({ type: "focus", number: 5 });
    expect(key("l", 3)).toEqual({ type: "focus", number: 5 });
    expect(key("l", 5)).toEqual({ type: "focus", number: 6 });
    expect(key("h", 4)).toEqual({ type: "focus", number: 1 });
    expect(key("h", 1)).toBeNull();
  });

  it("⇧J/⇧K reorder and ⇧H/⇧L move to the adjacent column", () => {
    expect(key("J", 1)).toEqual({
      type: "move",
      number: 1,
      status: "backlog",
      before: 3,
    });
    expect(key("J", 2)).toEqual({
      type: "move",
      number: 2,
      status: "backlog",
      before: null,
    });
    expect(key("J", 3)).toBeNull();
    expect(key("K", 3)).toEqual({
      type: "move",
      number: 3,
      status: "backlog",
      before: 2,
    });
    expect(key("K", 1)).toBeNull();
    // an empty neighbour column still takes the card
    expect(key("L", 2)).toEqual({
      type: "move",
      number: 2,
      status: "todo",
      before: null,
    });
    expect(key("H", 5)).toEqual({
      type: "move",
      number: 5,
      status: "todo",
      before: null,
    });
    expect(key("H", 1)).toBeNull();
    expect(key("L", 6)).toBeNull();
  });

  it("x marks done, and from done back to the first column", () => {
    expect(key("x", 4)).toEqual({
      type: "move",
      number: 4,
      status: "done",
      before: null,
    });
    expect(key("x", 6)).toEqual({
      type: "move",
      number: 6,
      status: "backlog",
      before: null,
    });
  });

  it("open, edit, note, new, filter, hints and help", () => {
    expect(key("o", 4)).toEqual({ type: "open", number: 4 });
    expect(key("Enter", 4)).toEqual({ type: "open", number: 4 });
    expect(key("e", 4)).toEqual({ type: "edit", number: 4 });
    expect(key("m", 4)).toEqual({ type: "note", number: 4 });
    expect(key("d", 4)).toEqual({ type: "description", number: 4 });
    expect(key("s", 4)).toEqual({ type: "status", number: 4 });
    expect(key("p", 4)).toEqual({ type: "priority", number: 4 });
    expect(key("t", 4)).toEqual({ type: "labels", number: 4 });
    expect(key("s", null)).toBeNull();
    expect(key("c", 4)).toEqual({ type: "new", status: "doing" });
    expect(key("c", null)).toEqual({ type: "new", status: "backlog" });
    expect(key("/", null)).toEqual({ type: "filter" });
    expect(key("f", null)).toEqual({ type: "hints" });
    expect(key("?", null)).toEqual({ type: "help" });
    expect(key("o", null)).toBeNull();
  });

  it("ignores keys with modifiers", () => {
    expect(key("j", 1, { meta: true })).toBeNull();
    expect(key("c", 1, { ctrl: true })).toBeNull();
    expect(key("f", 1, { alt: true })).toBeNull();
  });
});

describe("hints", () => {
  it("uses single letters, then two letters for every target", () => {
    expect(hintLabels(3)).toEqual(["a", "s", "d"]);
    const many = hintLabels(30);
    expect(many).toHaveLength(30);
    expect(many.every((l) => l.length === 2)).toBe(true);
    expect(new Set(many).size).toBe(30);
  });

  it("matches typed letters", () => {
    const labels = hintLabels(30);
    expect(matchHint(labels, "a")).toEqual({ remaining: 26 });
    expect(matchHint(labels, labels[3])).toEqual({ chosen: 3 });
    expect(matchHint(["a", "s"], "z")).toBeNull();
  });
});

describe("priority", () => {
  const clock = { now: "2026-10-22T00:00:00.000Z", id: () => "n" };
  it("defaults to none, can be set and filtered, and old data is normalised", () => {
    const issue = createIssue(
      [],
      DEFAULT_STATUSES,
      1,
      { title: "x" },
      "me",
      clock,
    );
    expect(issue.priority).toBe("none");
    const [high] = patchIssue(
      [issue],
      DEFAULT_STATUSES,
      1,
      { priority: "high" },
      "me",
      clock,
    );
    expect(high).toMatchObject({ priority: "high", version: 2 });
    expect(matches(high, { priority: "high" })).toBe(true);
    expect(matches(high, { priority: "low" })).toBe(false);
    expect(() =>
      createIssue(
        [],
        DEFAULT_STATUSES,
        2,
        { title: "x", priority: "huge" as never },
        "me",
        clock,
      ),
    ).toThrow();
    const { priority: _drop, ...old } = issue;
    expect(normalizeIssue(old as never).priority).toBe("none");
  });
});
