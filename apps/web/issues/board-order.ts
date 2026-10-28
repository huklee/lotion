import {
  focusState,
  type IssueStatus,
  type IssueSummary,
} from "../../../packages/issues/model";

/** Issues of one status in board order. */
export function columnIssues(issues: IssueSummary[], status: string) {
  return issues
    .filter((i) => i.status === status)
    .sort((a, b) => a.rank - b.rank || a.number - b.number);
}

/**
 * A column as shown on the board: issues in focus first — a deadline within
 * 24 h (or past), soonest first, then Focus now set by hand, in board order —
 * then the rest in board order. Ranks are untouched: moves still place an
 * issue by rank (see applyLocalMove), and it leaves the top once its focus ends.
 */
export function boardColumn(
  issues: IssueSummary[],
  status: string,
  statuses: IssueStatus[],
  now: number,
) {
  const group = new Map(
    issues.map((i) => {
      const { reason } = focusState(i, statuses, now);
      return [i.number, reason === "due" ? 0 : reason === "manual" ? 1 : 2];
    }),
  );
  const deadline = (i: IssueSummary) =>
    group.get(i.number) === 0 && i.due ? Date.parse(i.due) : 0;
  return columnIssues(issues, status).sort(
    (a, b) =>
      group.get(a.number)! - group.get(b.number)! || deadline(a) - deadline(b),
  );
}

/**
 * Where a dragged card lands: the issue it goes before (null = end of column),
 * from the pointer's Y and the midpoints of the other cards in the column.
 */
export function dropTarget(
  cards: { number: number; top: number; height: number }[],
  dragged: number,
  pointerY: number,
): number | null {
  for (const card of cards) {
    if (card.number === dragged) continue;
    if (pointerY < card.top + card.height / 2) return card.number;
  }
  return null;
}

/** The board after a local (optimistic) move, before the server answers. */
export function applyLocalMove(
  issues: IssueSummary[],
  number: number,
  status: string,
  before: number | null,
): IssueSummary[] {
  const others = columnIssues(issues, status).filter(
    (i) => i.number !== number,
  );
  const index =
    before === null
      ? others.length
      : others.findIndex((i) => i.number === before);
  const prev = others[index - 1]?.rank;
  const next = others[index]?.rank;
  const rank =
    prev === undefined && next === undefined
      ? 1
      : prev === undefined
        ? next! - 1
        : next === undefined
          ? prev + 1
          : (prev + next) / 2;
  return issues.map((i) => (i.number === number ? { ...i, status, rank } : i));
}

const LABEL_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
];
/** A stable color per label name. */
export function labelColor(label: string) {
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return LABEL_COLORS[hash % LABEL_COLORS.length];
}
