import { focusState, type IssueBoard } from "../../../packages/issues/model";
import { boardStats } from "./issue-card-state";

/** Open issues, in progress, in focus, and done in the last 7 days. */
export function IssueStats({ board, now }: { board: IssueBoard; now: number }) {
  const { open, doing, inFocus, doneThisWeek } = boardStats(
    board,
    (issue) => focusState(issue, board.statuses, now).focused,
    Date.now() - 7 * 86400_000,
  );
  return (
    <span className="issues-stats" aria-label="Board summary">
      {open} open{doing ? ` · ${doing} in progress` : ""}
      {inFocus ? ` · ${inFocus} in focus` : ""} · {doneThisWeek} done this week
    </span>
  );
}
