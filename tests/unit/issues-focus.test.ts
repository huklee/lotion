import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATUSES,
  bulkIssues,
  createIssue,
  dueLabel,
  focusState,
  moveIssue,
  normalizeIssue,
  patchIssue,
} from "../../packages/issues/model";
import { parseDue } from "../../apps/cli/issues-client";
import { boardKey } from "../../apps/web/issues/issue-keys";

const NOW = Date.parse("2026-10-27T09:00:00.000Z");
const clock = { now: new Date(NOW).toISOString(), id: () => "n" };
const H = 3600_000;
const make = (input: any = {}) =>
  createIssue([], DEFAULT_STATUSES, 1, { title: "x", ...input }, "me", clock);

describe("focus state", () => {
  it("is on when set by hand or due within 24 h, never when done", () => {
    expect(focusState(make(), DEFAULT_STATUSES, NOW)).toMatchObject({
      focused: false,
      reason: null,
    });
    expect(
      focusState(make({ focus: true }), DEFAULT_STATUSES, NOW),
    ).toMatchObject({
      focused: true,
      reason: "manual",
    });
    const soon = make({ due: new Date(NOW + 5 * H).toISOString() });
    expect(focusState(soon, DEFAULT_STATUSES, NOW)).toMatchObject({
      focused: true,
      reason: "due",
      overdue: false,
    });
    // both: the deadline wins (shown red), and manual focus is still reported
    const both = make({
      focus: true,
      due: new Date(NOW + 5 * H).toISOString(),
    });
    expect(focusState(both, DEFAULT_STATUSES, NOW)).toMatchObject({
      focused: true,
      reason: "due",
      manual: true,
    });
    const manualFar = make({
      focus: true,
      due: new Date(NOW + 48 * H).toISOString(),
    });
    expect(focusState(manualFar, DEFAULT_STATUSES, NOW)).toMatchObject({
      reason: "manual",
      manual: true,
    });
    const later = make({ due: new Date(NOW + 25 * H).toISOString() });
    expect(focusState(later, DEFAULT_STATUSES, NOW).focused).toBe(false);
    // the same issue comes into focus as time passes
    expect(focusState(later, DEFAULT_STATUSES, NOW + 2 * H).focused).toBe(true);
    const late = make({ due: new Date(NOW - 3 * H).toISOString() });
    expect(focusState(late, DEFAULT_STATUSES, NOW)).toMatchObject({
      focused: true,
      overdue: true,
    });
    const done = make({
      status: "done",
      focus: true,
      due: new Date(NOW).toISOString(),
    });
    expect(focusState(done, DEFAULT_STATUSES, NOW)).toMatchObject({
      focused: false,
      overdue: false,
    });
  });

  it("labels deadlines", () => {
    expect(dueLabel(5 * H)).toBe("in 5h");
    expect(dueLabel(30 * 60_000)).toBe("in 30m");
    expect(dueLabel(72 * H)).toBe("in 3d");
    expect(dueLabel(-3 * H)).toBe("3h overdue");
  });
});

describe("focus and deadline changes", () => {
  it("patches focus and due, and clears focus when the issue is done", () => {
    const issue = make();
    const [focused] = patchIssue(
      [issue],
      DEFAULT_STATUSES,
      1,
      { focus: true },
      "me",
      clock,
    );
    expect(focused.focusedAt).toBe(clock.now);
    const [dated] = patchIssue(
      [focused],
      DEFAULT_STATUSES,
      1,
      { due: "2026-10-30T18:00:00+09:00" },
      "me",
      clock,
    );
    expect(dated.due).toBe("2026-10-30T09:00:00.000Z");
    const [cleared] = patchIssue(
      [dated],
      DEFAULT_STATUSES,
      1,
      { due: null },
      "me",
      clock,
    );
    expect(cleared.due).toBeNull();
    expect(() =>
      patchIssue(
        [issue],
        DEFAULT_STATUSES,
        1,
        { due: "tomorrow" },
        "me",
        clock,
      ),
    ).toThrow(/ISO date-time/);
    const [done] = moveIssue(
      [focused],
      DEFAULT_STATUSES,
      1,
      { status: "done" },
      "me",
      clock,
    );
    expect(done.focusedAt).toBeNull();
    // focus cannot be set on a done issue
    expect(
      patchIssue([done], DEFAULT_STATUSES, 1, { focus: true }, "me", clock),
    ).toEqual([]);
  });

  it("sets focus and deadlines in bulk; old data reads as unset", () => {
    const a = make();
    const b = { ...make(), number: 2 };
    const { issues, changed } = bulkIssues(
      [a, b],
      DEFAULT_STATUSES,
      { numbers: [1, 2], focus: true, due: "2026-11-01T00:00:00Z" },
      "me",
      clock,
    );
    expect(changed).toEqual([1, 2]);
    expect(
      issues.every((i) => i.focusedAt && i.due === "2026-11-01T00:00:00.000Z"),
    ).toBe(true);
    const { focusedAt: _f, due: _d, ...old } = a;
    expect(normalizeIssue(old as any)).toMatchObject({
      focusedAt: null,
      due: null,
    });
  });
});

describe("helpers", () => {
  it("parses deadlines from the command line in local time", () => {
    const now = new Date(2026, 9, 27, 9, 0);
    expect(parseDue("2026-10-30", now)).toBe(
      new Date(2026, 9, 30, 23, 59).toISOString(),
    );
    expect(parseDue("2026-10-30 18:00", now)).toBe(
      new Date(2026, 9, 30, 18, 0).toISOString(),
    );
    expect(parseDue("+2d", now)).toBe(
      new Date(now.getTime() + 48 * H).toISOString(),
    );
    expect(parseDue("+5h", now)).toBe(
      new Date(now.getTime() + 5 * H).toISOString(),
    );
    expect(parseDue("none", now)).toBeNull();
    expect(parseDue("2026-10-30T09:00:00Z", now)).toBe(
      "2026-10-30T09:00:00.000Z",
    );
    expect(() => parseDue("someday", now)).toThrow(/Not a deadline/);
  });

  it("maps n to Focus now", () => {
    expect(
      boardKey({ key: "n" }, [{ status: "backlog", numbers: [1] }], 1),
    ).toEqual({
      type: "focusNow",
      number: 1,
    });
  });
});
