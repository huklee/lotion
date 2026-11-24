import { MessageSquare } from "lucide-react";
import {
  PRIORITY_NAMES,
  dueLabel,
  type FocusState,
  type IssueSummary,
} from "../../../packages/issues/model";
import { pillStyle } from "../database-ui";
import { labelColor } from "./board-order";
import { cardClassName, dueClassName, focusTitle } from "./issue-card-state";

export const PRIORITY_COLOR: Record<string, string> = {
  low: "gray",
  medium: "yellow",
  high: "orange",
  urgent: "red",
};

export type IssueCardProps = {
  issue: IssueSummary;
  focus: FocusState;
  /** This card's hint label while hints are shown, and the letters typed. */
  hint?: { label: string; typed: string };
  /** Whether any card is selected (the checkbox state is then announced). */
  selecting: boolean;
  selected: boolean;
  open: boolean;
  focused: boolean;
  dragging: boolean;
  /** Show the drop line above this card. */
  dropBefore: boolean;
  onFocus: (number: number) => void;
  onOpen: (number: number) => void;
  onToggleSelect: (number: number) => void;
  onSelectRange: (number: number) => void;
  onDragStart: (issue: IssueSummary) => void;
  onDragEnd: () => void;
};

/** One card on the board: a link to the issue, draggable and selectable. */
export function IssueCard({
  issue,
  focus,
  hint,
  selecting,
  selected,
  open,
  focused,
  dragging,
  dropBefore,
  onFocus,
  onOpen,
  onToggleSelect,
  onSelectRange,
  onDragStart,
  onDragEnd,
}: IssueCardProps) {
  const n = issue.number;
  return (
    <div>
      {dropBefore && <div className="issue-drop-line" aria-hidden="true" />}
      <a
        aria-selected={selecting ? selected : undefined}
        className={cardClassName(
          { selected, open, dragging, focused, archived: !!issue.archivedAt },
          focus,
        )}
        data-focus={focus.reason ?? undefined}
        title={focusTitle(focus)}
        href={`#/issues/${n}`}
        data-issue={n}
        draggable
        onFocus={() => onFocus(n)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/x-lotion-issue", String(n));
          onDragStart(issue);
        }}
        onDragEnd={onDragEnd}
        onClick={(event) => {
          event.preventDefault();
          if (event.metaKey || event.ctrlKey) return onToggleSelect(n);
          if (event.shiftKey) return onSelectRange(n);
          onOpen(n);
        }}
      >
        {hint && hint.label.startsWith(hint.typed) && (
          <span className="issue-hint" data-hint={hint.label}>
            <b>{hint.typed}</b>
            {hint.label.slice(hint.typed.length)}
          </span>
        )}
        <span
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select #${n}`}
          className="issue-select"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.shiftKey) onSelectRange(n);
            else onToggleSelect(n);
          }}
        >
          {selected ? "✓" : ""}
        </span>
        <span className="issue-card-title">{issue.title}</span>
        <span className="issue-card-meta">
          <span className="issue-number">#{n}</span>
          {issue.priority && issue.priority !== "none" && (
            <span
              className="issue-label issue-priority"
              style={pillStyle(PRIORITY_COLOR[issue.priority])}
            >
              {PRIORITY_NAMES[issue.priority]}
            </span>
          )}
          {issue.labels.map((label) => (
            <span
              key={label}
              className="issue-label"
              style={pillStyle(labelColor(label))}
            >
              {label}
            </span>
          ))}
          {focus.dueIn !== null && (
            <span
              className={dueClassName(focus)}
              title={`Due ${new Date(issue.due!).toLocaleString()}`}
            >
              {focus.overdue ? "Overdue " : "Due "}
              {dueLabel(focus.dueIn).replace(/ overdue$/, "")}
            </span>
          )}
          {issue.updatedBy && issue.updatedBy !== "me" && (
            <span
              className="issue-author"
              title={`Last changed by ${issue.updatedBy}`}
            >
              {issue.updatedBy}
            </span>
          )}
          {issue.noteCount > 1 && (
            <span
              className="issue-notes-count"
              title={`${issue.noteCount - 1} notes`}
            >
              <MessageSquare size={12} aria-hidden="true" />
              {issue.noteCount - 1}
            </span>
          )}
        </span>
      </a>
    </div>
  );
}
