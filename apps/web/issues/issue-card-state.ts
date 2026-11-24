import type { FocusState, IssueBoard } from "../../../packages/issues/model";
import { DUE_SOON_MS } from "../../../packages/issues/model";

/**
 * How an issue card looks, as plain values: its classes, its tooltip and the
 * board's summary counts. Pure, so it is tested without a browser.
 */

export type CardFlags = {
  selected: boolean;
  open: boolean;
  dragging: boolean;
  focused: boolean;
  archived: boolean;
};

export function cardClassName(flags: CardFlags, focus: FocusState): string {
  return [
    "issue-card",
    flags.selected && "selected",
    flags.open && "open",
    flags.dragging && "dragging",
    flags.focused && "focused",
    focus.focused && "focus-now",
    focus.overdue && "overdue",
    flags.archived && "archived",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The card's tooltip: why it is in focus, if it is. */
export function focusTitle(focus: FocusState): string | undefined {
  if (focus.reason === "manual") return "Focus now";
  if (focus.reason === "due")
    return focus.overdue
      ? "In focus: the deadline has passed"
      : "In focus: the deadline is within 24 hours";
  return undefined;
}

/** The deadline badge's class: overdue, soon (within 24 h) or plain. */
export function dueClassName(focus: FocusState): string {
  if (focus.overdue) return "issue-due overdue";
  if (focus.dueIn !== null && focus.dueIn <= DUE_SOON_MS)
    return "issue-due soon";
  return "issue-due";
}

export type BoardStats = {
  open: number;
  doing: number;
  inFocus: number;
  doneThisWeek: number;
};

/**
 * Open issues, in progress, in focus, and closed since `weekStart`.
 * `isFocused` decides focus for one issue (see `focusState`).
 */
export function boardStats(
  board: IssueBoard,
  isFocused: (issue: IssueBoard["issues"][number]) => boolean,
  weekStart: number,
): BoardStats {
  const last = board.statuses.at(-1)?.key;
  const live = board.issues.filter((i) => !i.archivedAt);
  return {
    open: live.filter((i) => i.status !== last).length,
    doing: live.filter((i) => i.status === "doing").length,
    inFocus: live.filter(isFocused).length,
    doneThisWeek: board.issues.filter(
      (i) => i.closedAt && Date.parse(i.closedAt) >= weekStart,
    ).length,
  };
}
