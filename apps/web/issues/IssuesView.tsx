import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { MessageSquare, MoreHorizontal, Plus, X } from "lucide-react";
import type { TreeNode } from "../../../packages/document-schema/index";
import { IssueSettings } from "./IssueSettings";
import { pillStyle } from "../database-ui";
import {
  PRIORITIES,
  PRIORITY_NAMES,
  matches,
  type IssueBoard,
  type IssueSummary,
} from "../../../packages/issues/model";
import { issuesApi, useIssueBoard } from "./issues-api";
import {
  applyLocalMove,
  columnIssues,
  dropTarget,
  labelColor,
} from "./board-order";
import {
  BOARD_SHORTCUTS,
  boardKey,
  hintLabels,
  matchHint,
  type BoardColumns,
} from "./issue-keys";
import { goToIssues } from "./issues-route";
import { IssuePanel, type PanelFocus } from "./IssuePanel";
import "./issues.css";

const STATUS_COLOR: Record<string, string> = {
  gray: "gray",
  yellow: "yellow",
  blue: "blue",
  green: "green",
};

export const PRIORITY_COLOR: Record<string, string> = {
  low: "gray",
  medium: "yellow",
  high: "orange",
  urgent: "red",
};

export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const modalOpen = () =>
  !!document.querySelector('[role="dialog"][aria-modal="true"]');

/** Open issues, in progress, and done in the last 7 days. */
function IssueStats({ board }: { board: IssueBoard }) {
  const last = board.statuses.at(-1)?.key;
  const live = board.issues.filter((i) => !i.archivedAt);
  const open = live.filter((i) => i.status !== last).length;
  const doing = live.filter((i) => i.status === "doing").length;
  const week = Date.now() - 7 * 86400_000;
  const done = board.issues.filter(
    (i) => i.closedAt && Date.parse(i.closedAt) >= week,
  ).length;
  return (
    <span className="issues-stats" aria-label="Board summary">
      {open} open{doing ? ` · ${doing} in progress` : ""} · {done} done this
      week
    </span>
  );
}

/** The issue board: one column per status, cards dragged between them. */
export function IssuesView({
  openNumber,
  onError,
  pages = [],
  openPage,
  onPagesChanged,
}: {
  openNumber: number | null;
  onError: (error: unknown) => void;
  pages?: TreeNode[];
  openPage?: (id: string, blockId?: string) => void;
  onPagesChanged?: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState(false);
  const { board, setBoard, reload } = useIssueBoard(onError, showArchived);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [drag, setDrag] = useState<{
    number: number;
    status: string;
    before: number | null;
  } | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [hints, setHints] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [filter, setFilter] = useState({ q: "", label: "", priority: "" });
  const [panelFocus, setPanelFocus] = useState<PanelFocus | null>(null);
  const columns = useRef(new Map<string, HTMLDivElement>());
  const filterInput = useRef<HTMLInputElement>(null);
  const wantFocus = useRef(false);
  const [focusTick, setFocusTick] = useState(0);

  const visible = useMemo(
    () =>
      (board?.issues ?? []).filter((i) =>
        matches(
          { ...i, notes: [] },
          {
            q: filter.q.trim() || undefined,
            label: filter.label || undefined,
            priority: filter.priority || undefined,
            archived: showArchived ? "include" : undefined,
          },
        ),
      ),
    [board, filter, showArchived],
  );
  const layout: BoardColumns = useMemo(
    () =>
      (board?.statuses ?? []).map((s) => ({
        status: s.key,
        numbers: columnIssues(visible, s.key).map((i) => i.number),
      })),
    [board, visible],
  );
  const hintOrder = useMemo(() => layout.flatMap((c) => c.numbers), [layout]);
  const labels = useMemo(() => hintLabels(hintOrder.length), [hintOrder]);
  const allLabels = useMemo(
    () =>
      [...new Set((board?.issues ?? []).flatMap((i) => i.labels))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [board],
  );

  // keyboard focus follows the focused card only when a key asked for it
  useEffect(() => {
    if (!wantFocus.current || focused === null) return;
    const el = document.querySelector<HTMLElement>(
      `.issue-card[data-issue="${focused}"]`,
    );
    if (el) {
      wantFocus.current = false;
      el.focus();
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [focused, layout, focusTick]);

  const focusCard = (number: number) => {
    wantFocus.current = true;
    setFocused(number);
    setFocusTick((tick) => tick + 1);
  };

  const move = useCallback(
    async (number: number, status: string, before: number | null) => {
      if (!board) return;
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
    },
    [board, setBoard, reload, onError],
  );

  // the board's keys run in the capture phase so Escape for hints and help is
  // handled before the issue panel's own Escape (which closes the panel)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!board || isTyping(event.target) || modalOpen()) return;
      if (hints !== null) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") return setHints(null);
        if (event.key === "Backspace") return setHints(hints.slice(0, -1));
        if (!/^[a-z]$/i.test(event.key)) return;
        const typed = hints + event.key.toLowerCase();
        const match = matchHint(labels, typed);
        if (!match) return setHints(null);
        if ("chosen" in match) {
          setHints(null);
          const number = hintOrder[match.chosen];
          focusCard(number);
          goToIssues(number);
        } else setHints(typed);
        return;
      }
      if (help && (event.key === "Escape" || event.key === "?")) {
        event.preventDefault();
        event.stopPropagation();
        setHelp(false);
        return;
      }
      const action = boardKey(
        {
          key: event.key,
          shift: event.shiftKey,
          meta: event.metaKey,
          ctrl: event.ctrlKey,
          alt: event.altKey,
        },
        layout,
        focused !== null && hintOrder.includes(focused) ? focused : null,
      );
      if (!action) return;
      // Enter on a focused link already opens it; let o / Enter share one path
      event.preventDefault();
      switch (action.type) {
        case "help":
          setHelp(true);
          break;
        case "filter":
          filterInput.current?.focus();
          filterInput.current?.select();
          break;
        case "hints":
          if (hintOrder.length) setHints("");
          break;
        case "new":
          setAdding(action.status);
          setDraft("");
          break;
        case "focus":
          focusCard(action.number);
          break;
        case "move":
          // moving a focused card's DOM node blurs it: focus it again once the
          // board has settled
          wantFocus.current = true;
          void move(action.number, action.status, action.before).then(() =>
            focusCard(action.number),
          );
          break;
        case "open":
          goToIssues(action.number);
          break;
        case "edit":
        case "note":
          goToIssues(action.number);
          setPanelFocus({
            field: action.type === "edit" ? "title" : "note",
            at: Date.now(),
          });
          break;
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [board, hints, help, labels, hintOrder, layout, focused, move]);

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
    await move(number, status, before);
  };

  const filtered = !!(filter.q.trim() || filter.label || filter.priority);

  const card = (issue: IssueSummary) => {
    const hint =
      hints !== null ? labels[hintOrder.indexOf(issue.number)] : undefined;
    return (
      <div key={issue.number}>
        {drag?.before === issue.number && drag.number !== issue.number && (
          <div className="issue-drop-line" aria-hidden="true" />
        )}
        <a
          className={`issue-card${openNumber === issue.number ? " open" : ""}${drag?.number === issue.number ? " dragging" : ""}${focused === issue.number ? " focused" : ""}`}
          href={`#/issues/${issue.number}`}
          data-issue={issue.number}
          draggable
          onFocus={() => setFocused(issue.number)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "text/x-lotion-issue",
              String(issue.number),
            );
            setDrag({
              number: issue.number,
              status: issue.status,
              before: null,
            });
          }}
          onDragEnd={() => setDrag(null)}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            setFocused(issue.number);
            goToIssues(issue.number);
          }}
        >
          {hint !== undefined && hint.startsWith(hints ?? "") && (
            <span className="issue-hint" data-hint={hint}>
              <b>{hints}</b>
              {hint.slice((hints ?? "").length)}
            </span>
          )}
          <span className="issue-card-title">{issue.title}</span>
          <span className="issue-card-meta">
            <span className="issue-number">#{issue.number}</span>
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
  };

  return (
    <section className={`issues-view${openNumber ? " with-panel" : ""}`}>
      <div className="issues-main">
        <header className="issues-header">
          <h1>Issues</h1>
          <span className="issues-count">
            {filtered
              ? `${visible.length} of ${board.issues.length}`
              : board.issues.length}
          </span>
          <IssueStats board={board} />
          <div className="issues-menu-wrap">
            <button
              className="issues-help"
              aria-label="Board menu"
              aria-expanded={menu}
              title="Board menu"
              onClick={() => setMenu((open) => !open)}
            >
              <MoreHorizontal size={15} />
            </button>
            {menu && (
              <div className="issues-menu" role="menu" aria-label="Board menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    setSettings(true);
                  }}
                >
                  Board settings…
                </button>
                <button
                  role="menuitemcheckbox"
                  aria-checked={showArchived}
                  onClick={() => {
                    setMenu(false);
                    setShowArchived((v) => !v);
                  }}
                >
                  {showArchived ? "Hide archived" : "Show archived"}
                </button>
                <a role="menuitem" href="/api/issues/export?format=md" download>
                  Export Markdown
                </a>
                <a
                  role="menuitem"
                  href="/api/issues/export?format=json"
                  download
                >
                  Export JSON
                </a>
              </div>
            )}
          </div>
          <button
            className="issues-help"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={() => setHelp((open) => !open)}
          >
            ?
          </button>
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
        <div className="issues-filter" role="search">
          <input
            ref={filterInput}
            aria-label="Filter issues"
            placeholder="Filter…  /"
            value={filter.q}
            onChange={(event) =>
              setFilter({ ...filter, q: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Escape" || event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.blur();
                const first = layout.find((c) => c.numbers.length)?.numbers[0];
                if (first !== undefined) focusCard(first);
              }
            }}
          />
          <select
            aria-label="Label filter"
            value={filter.label}
            onChange={(event) =>
              setFilter({ ...filter, label: event.target.value })
            }
          >
            <option value="">All labels</option>
            {allLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Priority filter"
            value={filter.priority}
            onChange={(event) =>
              setFilter({ ...filter, priority: event.target.value })
            }
          >
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_NAMES[p]}
              </option>
            ))}
          </select>
          {filtered && (
            <button
              className="issues-filter-clear"
              aria-label="Clear filters"
              onClick={() => setFilter({ q: "", label: "", priority: "" })}
            >
              <X size={14} />
            </button>
          )}
        </div>
        {help && (
          <div
            className="issues-shortcuts"
            role="dialog"
            aria-label="Issue shortcuts"
          >
            <div className="issues-shortcuts-head">
              <strong>Keyboard shortcuts</strong>
              <button
                aria-label="Close shortcuts"
                onClick={() => setHelp(false)}
              >
                <X size={14} />
              </button>
            </div>
            <dl>
              {BOARD_SHORTCUTS.map(([keys, what]) => (
                <div key={keys}>
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div
          className={`issues-board${hints !== null ? " hinting" : ""}`}
          role="list"
          aria-label="Issue board"
        >
          {board.statuses.map((status) => {
            const items = columnIssues(visible, status.key);
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
                    style={pillStyle(
                      STATUS_COLOR[status.color] ?? status.color,
                    )}
                  >
                    {status.name}
                  </span>
                  <span className="issues-column-count">{items.length}</span>
                  {status.key === board.statuses.at(-1)?.key &&
                    items.some((i) => !i.archivedAt) && (
                      <button
                        className="issues-archive"
                        title="Archive every issue in this column"
                        onClick={async () => {
                          try {
                            await issuesApi.archiveColumn(status.key);
                            await reload();
                          } catch (error) {
                            onError(error);
                          }
                        }}
                      >
                        Archive
                      </button>
                    )}
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
                          event.stopPropagation();
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
          focus={panelFocus}
          onChanged={reload}
          onClose={() => {
            goToIssues(null);
            focusCard(openNumber);
          }}
          onError={onError}
          pages={pages}
          openPage={openPage}
          onPagesChanged={onPagesChanged}
        />
      )}
      {settings && (
        <IssueSettings
          statuses={board.statuses}
          issues={board.issues}
          onClose={() => setSettings(false)}
          onSaved={async () => {
            await reload();
          }}
        />
      )}
    </section>
  );
}
