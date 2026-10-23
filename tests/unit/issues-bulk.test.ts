import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATUSES,
  bulkIssues,
  column,
  createIssue,
  type Issue,
} from "../../packages/issues/model";
import { parseNumbers } from "../../apps/cli/issues-client";
import { parseLabelEdits } from "../../apps/web/issues/BulkBar";
import { boardKey } from "../../apps/web/issues/issue-keys";

const clock = { now: "2026-10-23T01:00:00.000Z", id: () => "n" };
function seed(): Issue[] {
  const issues: Issue[] = [];
  for (const [title, status, labels] of [
    ["A", "backlog", ["bug"]],
    ["B", "backlog", []],
    ["C", "todo", ["UI"]],
    ["D", "done", []],
  ] as const)
    issues.push(
      createIssue(
        issues,
        DEFAULT_STATUSES,
        issues.length + 1,
        { title, status, labels: [...labels] },
        "me",
        clock,
      ),
    );
  return issues;
}

describe("bulk changes", () => {
  it("moves several issues keeping their board order, with status notes", () => {
    const { issues, changed } = bulkIssues(
      seed(),
      DEFAULT_STATUSES,
      { numbers: [3, 1, 2], status: "doing" },
      "codex",
      clock,
    );
    expect(changed).toEqual([1, 2, 3]);
    expect(column(issues, "doing").map((i) => i.number)).toEqual([1, 2, 3]);
    expect(issues[0].notes.at(-1)).toMatchObject({
      kind: "status",
      author: "codex",
      text: "Backlog → In progress",
    });
  });

  it("sets priority, adds and removes labels, archives; unchanged issues are skipped", () => {
    let { issues, changed } = bulkIssues(
      seed(),
      DEFAULT_STATUSES,
      {
        numbers: [1, 2, 3],
        priority: "high",
        addLabels: ["Sprint", "bug"],
        removeLabels: ["ui"],
      },
      "me",
      clock,
    );
    expect(changed).toEqual([1, 2, 3]);
    expect(issues.slice(0, 3).map((i) => [i.priority, i.labels])).toEqual([
      ["high", ["bug", "Sprint"]],
      ["high", ["Sprint", "bug"]],
      ["high", ["Sprint", "bug"]],
    ]);
    expect(issues[0].version).toBe(2);
    ({ issues, changed } = bulkIssues(
      issues,
      DEFAULT_STATUSES,
      { numbers: [1, 4], archived: true },
      "me",
      clock,
    ));
    expect(changed).toEqual([1, 4]);
    expect(issues[3].archivedAt).toBe(clock.now);
    ({ changed } = bulkIssues(
      issues,
      DEFAULT_STATUSES,
      { numbers: [1, 4], archived: true },
      "me",
      clock,
    ));
    expect(changed).toEqual([]);
  });

  it("deletes alone, and validates input", () => {
    const { issues, deleted } = bulkIssues(
      seed(),
      DEFAULT_STATUSES,
      { numbers: [2, 4, 2], delete: true },
      "me",
      clock,
    );
    expect(deleted).toEqual([2, 4]);
    expect(issues.map((i) => i.number)).toEqual([1, 3]);
    const run = (input: any) =>
      bulkIssues(seed(), DEFAULT_STATUSES, input, "me", clock);
    expect(() => run({ numbers: [1], delete: true, status: "done" })).toThrow(
      /delete alone/,
    );
    expect(() => run({ numbers: [1] })).toThrow(/one change/);
    expect(() => run({ numbers: [] })).toThrow();
    expect(() => run({ numbers: [9], priority: "low" })).toThrow(
      /#9 not found/,
    );
    expect(() => run({ numbers: [1], status: "nope" })).toThrow(
      /Unknown status/,
    );
  });
});

describe("helpers", () => {
  it("parses issue number lists and label edits", () => {
    expect(parseNumbers("3, #5 8-10")).toEqual([3, 5, 8, 9, 10]);
    expect(parseNumbers("10-8")).toEqual([8, 9, 10]);
    expect(() => parseNumbers("x")).toThrow();
    expect(parseLabelEdits("+bug -ui idea, -old")).toEqual({
      add: ["bug", "idea"],
      remove: ["ui", "old"],
    });
  });

  it("maps the selection keys", () => {
    const cols = [{ status: "backlog", numbers: [1, 2] }];
    expect(boardKey({ key: "v" }, cols, 1)).toEqual({
      type: "select",
      number: 1,
    });
    expect(boardKey({ key: "V" }, cols, null)).toEqual({ type: "selectAll" });
    expect(boardKey({ key: "a" }, cols, 2)).toEqual({
      type: "archive",
      number: 2,
    });
    expect(boardKey({ key: "Delete" }, cols, 2)).toEqual({
      type: "delete",
      number: 2,
    });
    expect(boardKey({ key: "Backspace" }, cols, 2)).toEqual({
      type: "delete",
      number: 2,
    });
  });
});
