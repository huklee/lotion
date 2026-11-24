import { describe, expect, it } from "vitest";
import {
  boardStats,
  cardClassName,
  dueClassName,
  focusTitle,
} from "../../apps/web/issues/issue-card-state";
import type { FocusState, IssueBoard } from "../../packages/issues/model";

const calm: FocusState = {
  focused: false,
  reason: null,
  manual: false,
  dueIn: null,
  overdue: false,
};
const flags = {
  selected: false,
  open: false,
  dragging: false,
  focused: false,
  archived: false,
};

describe("issue card state", () => {
  it("lists the card's classes in a fixed order", () => {
    expect(cardClassName(flags, calm)).toBe("issue-card");
    expect(
      cardClassName(
        {
          selected: true,
          open: true,
          dragging: true,
          focused: true,
          archived: true,
        },
        { ...calm, focused: true, reason: "due", dueIn: -1, overdue: true },
      ),
    ).toBe(
      "issue-card selected open dragging focused focus-now overdue archived",
    );
  });

  it("explains why a card is in focus", () => {
    expect(focusTitle(calm)).toBeUndefined();
    expect(focusTitle({ ...calm, focused: true, reason: "manual" })).toBe(
      "Focus now",
    );
    expect(
      focusTitle({ ...calm, focused: true, reason: "due", dueIn: 60_000 }),
    ).toBe("In focus: the deadline is within 24 hours");
    expect(
      focusTitle({
        ...calm,
        focused: true,
        reason: "due",
        dueIn: -1,
        overdue: true,
      }),
    ).toBe("In focus: the deadline has passed");
  });

  it("marks deadlines overdue, soon or plain", () => {
    expect(dueClassName({ ...calm, dueIn: -5, overdue: true })).toBe(
      "issue-due overdue",
    );
    expect(dueClassName({ ...calm, dueIn: 3_600_000 })).toBe("issue-due soon");
    expect(dueClassName({ ...calm, dueIn: 3 * 86_400_000 })).toBe("issue-due");
  });

  it("counts open, in progress, in focus and done this week", () => {
    const week = Date.parse("2026-11-17T00:00:00Z");
    const issue = (n: number, status: string, extra = {}) =>
      ({
        number: n,
        status,
        archivedAt: null,
        closedAt: null,
        ...extra,
      }) as never;
    const board = {
      seq: 1,
      statuses: [{ key: "todo" }, { key: "doing" }, { key: "done" }],
      issues: [
        issue(1, "todo"),
        issue(2, "doing"),
        issue(3, "done", { closedAt: "2026-11-20T00:00:00Z" }),
        issue(4, "done", { closedAt: "2026-11-01T00:00:00Z" }),
        issue(5, "todo", { archivedAt: "2026-11-20T00:00:00Z" }),
      ],
    } as unknown as IssueBoard;
    expect(boardStats(board, (i) => i.number === 2, week)).toEqual({
      open: 2,
      doing: 1,
      inFocus: 1,
      doneThisWeek: 1,
    });
  });
});
