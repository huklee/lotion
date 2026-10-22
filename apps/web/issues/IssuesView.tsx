import { useEffect, useRef, useState, type DragEvent } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { pillStyle } from "../database-ui";
import type { IssueSummary } from "../../../packages/issues/model";
import { issuesApi, useIssueBoard } from "./issues-api";
import {
  applyLocalMove,
  columnIssues,
  dropTarget,
  labelColor,
} from "./board-order";
import { goToIssues } from "./issues-route";
import { IssuePanel } from "./IssuePanel";
import "./issues.css";

const STATUS_COLOR: Record<string, string> = {
  gray: "gray",
  yellow: "yellow",
  blue: "blue",
  green: "green",
};

export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** The issue board: one column per status, cards dragged between them. */
export function IssuesView({
  openNumber,
  onError,
}: {
  openNumber: number | null;
  onError: (error: unknown) => void;
}) {
  const { board, setBoard, reload } = useIssueBoard(onError);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [drag, setDrag] = useState<{
    number: number;
    status: string;
    before: number | null;
  } | null>(null);
  const columns = useRef(new Map<string, HTMLDivElement>());

  // c: new issue in the first column (when not typing)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "c" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target) ||
        document.querySelector('[role="dialog"][aria-modal="true"]') ||
        !board
      )
        return;
      event.preventDefault();
      setAdding(board.statuses[0].key);
      setDraft("");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [board]);

  if (!board)
    return (
      <section className="issues-view">
        <p className="issues-empty">Loading issues…</p>
      </section>
    );

  const create = async (status: string) => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    try {
      await issuesApi.create({ title, status });
      await reload();
    } catch (error) {
      setDraft(title);
      onError(error);
    }
  };

  const targetFor = (status: string, number: number, y: number) => {
    const column = columns.current.get(status);
    const cards = [
      ...(column?.querySelectorAll<HTMLElement>("[data-issue]") ?? []),
    ].map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        number: Number(el.dataset.issue),
        top: rect.top,
        height: rect.height,
      };
    });
    return dropTarget(cards, number, y);
  };

  const onDragOver = (event: DragEvent, status: string) => {
    if (!drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const before = targetFor(status, drag.number, event.clientY);
    if (drag.status !== status || drag.before !== before)
      setDrag({ ...drag, status, before });
  };

  const onDrop = async (event: DragEvent, status: string) => {
    event.preventDefault();
    const number =
      drag?.number ?? Number(event.dataTransfer.getData("text/x-lotion-issue"));
    if (!number) return;
    const before = targetFor(status, number, event.clientY);
    setDrag(null);
    const previous = board;
    setBoard({
      ...board,
      issues: applyLocalMove(board.issues, number, status, before),
    });
    try {
      await issuesApi.move(number, status, before);
    } catch (error) {
      setBoard(previous);
      onError(error);
    }
    await reload();
  };

  const card = (issue: IssueSummary) => (
    <div key={issue.number}>
      {drag?.before === issue.number && drag.number !== issue.number && (
        <div className="issue-drop-line" aria-hidden="true" />
      )}
      <a
        className={`issue-card${openNumber === issue.number ? " open" : ""}${drag?.number === issue.number ? " dragging" : ""}`}
        href={`#/issues/${issue.number}`}
        data-issue={issue.number}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "text/x-lotion-issue",
            String(issue.number),
          );
          setDrag({ number: issue.number, status: issue.status, before: null });
        }}
        onDragEnd={() => setDrag(null)}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) return;
          event.preventDefault();
          goToIssues(issue.number);
        }}
      >
        <span className="issue-card-title">{issue.title}</span>
        <span className="issue-card-meta">
          <span className="issue-number">#{issue.number}</span>
          {issue.labels.map((label) => (
            <span
              key={label}
              className="issue-label"
              style={pillStyle(labelColor(label))}
            >
              {label}
            </span>
          ))}
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

  return (
    <section className={`issues-view${openNumber ? " with-panel" : ""}`}>
      <div className="issues-main">
        <header className="issues-header">
          <h1>Issues</h1>
          <span className="issues-count">{board.issues.length}</span>
          <button
            className="issues-new"
            onClick={() => {
              setAdding(board.statuses[0].key);
              setDraft("");
            }}
          >
            <Plus size={15} />
            New issue <kbd>c</kbd>
          </button>
        </header>
        <div className="issues-board" role="list" aria-label="Issue board">
          {board.statuses.map((status) => {
            const items = columnIssues(board.issues, status.key);
            return (
              <div
                key={status.key}
                role="listitem"
                aria-label={status.name}
                className={`issues-column${drag?.status === status.key ? " drop" : ""}`}
                data-status={status.key}
                ref={(el) => {
                  if (el) columns.current.set(status.key, el);
                  else columns.current.delete(status.key);
                }}
                onDragOver={(event) => onDragOver(event, status.key)}
                onDrop={(event) => void onDrop(event, status.key)}
              >
                <div className="issues-column-head">
                  <span
                    className="issue-status-pill"
                    style={pillStyle(STATUS_COLOR[status.color] ?? "gray")}
                  >
                    {status.name}
                  </span>
                  <span className="issues-column-count">{items.length}</span>
                  <button
                    className="issues-column-add"
                    aria-label={`New issue in ${status.name}`}
                    onClick={() => {
                      setAdding(status.key);
                      setDraft("");
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {adding === status.key && (
                  <form
                    className="issue-new-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void create(status.key);
                    }}
                  >
                    <input
                      autoFocus
                      aria-label={`New issue title in ${status.name}`}
                      placeholder="Issue title, Enter to add"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setAdding(null);
                        }
                      }}
                      onBlur={() => {
                        if (!draft.trim()) setAdding(null);
                      }}
                    />
                  </form>
                )}
                <div className="issues-cards">
                  {items.map(card)}
                  {drag?.status === status.key && drag.before === null && (
                    <div className="issue-drop-line" aria-hidden="true" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {openNumber !== null && (
        <IssuePanel
          key={openNumber}
          number={openNumber}
          statuses={board.statuses}
          seq={board.seq}
          onChanged={reload}
          onClose={() => goToIssues(null)}
          onError={onError}
        />
      )}
    </section>
  );
}
