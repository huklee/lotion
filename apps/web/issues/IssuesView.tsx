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
import { KeyPicker } from "./KeyPicker";
import { BulkBar, BulkLabels } from "./BulkBar";
import { pillStyle } from "../database-ui";
import {
  DUE_SOON_MS,
  PRIORITIES,
  PRIORITY_NAMES,
  dueLabel,
  focusState,
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
import { latinKey } from "../keyboard-layout";
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

/** Buttons, links and fields of the issue view that are on screen now. */
function visibleControls() {
  const root = document.querySelector(".issues-view");
  if (!root) return [];
  return [
    ...root.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, textarea, [role='button']",
    ),
  ]
    .filter((el) => {
      if (el.closest(".issue-card") || (el as HTMLButtonElement).disabled)
        return false;
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.right > 0 &&
        r.top < window.innerHeight &&
        r.left < window.innerWidth
      );
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { el, left: r.left, top: r.top };
    });
}

/** What choosing a hint does: fields get focus (a select opens), others click. */
function activate(el: HTMLElement | undefined) {
  if (!el) return;
  if (el instanceof HTMLSelectElement) {
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      // showPicker needs a user gesture in some browsers; focus is enough
    }
    return;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    return;
  }
  el.click();
}

/** Open issues, in progress, and done in the last 7 days. */
function IssueStats({ board, now }: { board: IssueBoard; now: number }) {
  const last = board.statuses.at(-1)?.key;
  const live = board.issues.filter((i) => !i.archivedAt);
  const open = live.filter((i) => i.status !== last).length;
  const doing = live.filter((i) => i.status === "doing").length;
  const inFocus = live.filter(
    (i) => focusState(i, board.statuses, now).focused,
  ).length;
  const week = Date.now() - 7 * 86400_000;
  const done = board.issues.filter(
    (i) => i.closedAt && Date.parse(i.closedAt) >= week,
  ).length;
  return (
    <span className="issues-stats" aria-label="Board summary">
      {open} open{doing ? ` · ${doing} in progress` : ""}
      {inFocus ? ` · ${inFocus} in focus` : ""} · {done} done this week
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
  // deadlines move into focus as time passes: re-evaluate every half minute
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
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
  // hints cover every card, then every other control on screen (Vimium style)
  const [controls, setControls] = useState<
    { el: HTMLElement; left: number; top: number }[]
  >([]);
  const labels = useMemo(
    () => hintLabels(hintOrder.length + controls.length),
    [hintOrder, controls],
  );
  const [picker, setPicker] = useState<{
    kind: "status" | "priority" | "labels" | "delete";
    /** One issue, or the selection. */
    numbers: number[];
    anchor: { left: number; top: number } | null;
  } | null>(null);
  // several issues selected at once (⌘/Ctrl-click, ⇧-click, v, ⇧V)
  const [selectedRaw, setSelected] = useState<Set<number>>(() => new Set());
  const selectAnchor = useRef<number | null>(null);
  const selected = useMemo(() => {
    const shown = new Set(hintOrder);
    return new Set([...selectedRaw].filter((n) => shown.has(n)));
  }, [selectedRaw, hintOrder]);
  const toggleSelect = (n: number) => {
    selectAnchor.current = n;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };
  const selectRange = (n: number) => {
    const from = hintOrder.indexOf(selectAnchor.current ?? n);
    const to = hintOrder.indexOf(n);
    if (from < 0 || to < 0) return toggleSelect(n);
    const [a, b] = from < to ? [from, to] : [to, from];
    setSelected(
      (current) => new Set([...current, ...hintOrder.slice(a, b + 1)]),
    );
  };
  const cardAnchor = (n: number) => {
    const rect = document
      .querySelector<HTMLElement>(`.issue-card[data-issue="${n}"]`)
      ?.getBoundingClientRect();
    return rect ? { left: rect.left, top: rect.bottom + 4 } : null;
  };
  /** Focus now on for all of them, or off when every one already has it. */
  const toggleFocus = (numbers: number[]) => {
    const allOn = (board?.issues ?? [])
      .filter((i) => numbers.includes(i.number))
      .every((i) => i.focusedAt);
    void runBulk({ focus: !allOn }, numbers);
  };
  /** The selection when there is one, otherwise just this issue. */
  const targets = (n: number) => (selected.size ? [...selected] : [n]);
  const runBulk = async (
    input: Omit<Parameters<typeof issuesApi.bulk>[0], "numbers">,
    numbers: number[],
  ) => {
    try {
      const result = await issuesApi.bulk({ numbers, ...input });
      if (result.deleted.length) {
        setSelected(new Set());
        if (openNumber !== null && result.deleted.includes(openNumber))
          goToIssues(null);
      }
    } catch (error) {
      onError(error);
    }
    await reload();
  };
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
    // never pull focus out of a field you are typing in (the panel's note box
    // after m, say) when an earlier move finishes late
    if (isTyping(document.activeElement)) {
      wantFocus.current = false;
      return;
    }
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
      if (!board || picker || isTyping(event.target) || modalOpen()) return;
      if (hints !== null) {
        event.preventDefault();
        event.stopPropagation();
        const key = latinKey(event);
        const stop = () => {
          setHints(null);
          setControls([]);
        };
        if (event.key === "Escape") return stop();
        if (event.key === "Backspace") return setHints(hints.slice(0, -1));
        if (!/^[a-z]$/i.test(key)) return;
        const typed = hints + key.toLowerCase();
        const match = matchHint(labels, typed);
        if (!match) return stop();
        if ("chosen" in match) {
          stop();
          if (match.chosen < hintOrder.length) {
            const number = hintOrder[match.chosen];
            focusCard(number);
            goToIssues(number);
          } else activate(controls[match.chosen - hintOrder.length]?.el);
        } else setHints(typed);
        return;
      }
      if (help && (event.key === "Escape" || latinKey(event) === "?")) {
        event.preventDefault();
        event.stopPropagation();
        setHelp(false);
        return;
      }
      if (selected.size && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setSelected(new Set());
        return;
      }
      if (
        selected.size &&
        latinKey(event) === "x" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        // x on a selection: all done, or all back to the first column
        event.preventDefault();
        const last = board.statuses.at(-1)!.key;
        const all = [...selected];
        const allDone = board.issues
          .filter((i) => selected.has(i.number))
          .every((i) => i.status === last);
        void runBulk({ status: allDone ? board.statuses[0].key : last }, all);
        return;
      }
      const action = boardKey(
        {
          key: latinKey(event),
          shift: event.shiftKey,
          meta: event.metaKey,
          ctrl: event.ctrlKey,
          alt: event.altKey,
        },
        layout,
        // with no card focused, keys act on the issue open in the panel
        focused !== null && hintOrder.includes(focused)
          ? focused
          : openNumber !== null && hintOrder.includes(openNumber)
            ? openNumber
            : null,
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
          setControls(visibleControls());
          setHints("");
          break;
        case "status":
        case "priority":
        case "delete":
          setPicker({
            kind: action.type,
            numbers: targets(action.number),
            anchor: cardAnchor(action.number),
          });
          break;
        case "labels":
          if (selected.size)
            setPicker({
              kind: "labels",
              numbers: [...selected],
              anchor: cardAnchor(action.number),
            });
          else {
            goToIssues(action.number);
            setPanelFocus({ field: "labels", at: Date.now() });
          }
          break;
        case "archive": {
          const numbers = targets(action.number);
          const allArchived = board.issues
            .filter((i) => numbers.includes(i.number))
            .every((i) => i.archivedAt);
          void runBulk({ archived: !allArchived }, numbers);
          if (!allArchived) setSelected(new Set());
          break;
        }
        case "focusNow":
          toggleFocus(targets(action.number));
          break;
        case "select":
          toggleSelect(action.number);
          break;
        case "selectAll":
          setSelected(new Set(hintOrder));
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
        case "description":
          goToIssues(action.number);
          setPanelFocus({
            field:
              action.type === "edit"
                ? "title"
                : action.type === "note"
                  ? "note"
                  : "description",
            at: Date.now(),
          });
          break;
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [
    board,
    hints,
    help,
    labels,
    hintOrder,
    controls,
    layout,
    focused,
    openNumber,
    picker,
    selected,
    move,
  ]);

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
    const focus = focusState(issue, board.statuses, now);
    return (
      <div key={issue.number}>
        {drag?.before === issue.number && drag.number !== issue.number && (
          <div className="issue-drop-line" aria-hidden="true" />
        )}
        <a
          aria-selected={selected.size ? selected.has(issue.number) : undefined}
          className={`issue-card${selected.has(issue.number) ? " selected" : ""}${openNumber === issue.number ? " open" : ""}${drag?.number === issue.number ? " dragging" : ""}${focused === issue.number ? " focused" : ""}${focus.focused ? " focus-now" : ""}${focus.overdue ? " overdue" : ""}`}
          data-focus={focus.reason ?? undefined}
          title={
            focus.reason === "manual"
              ? "Focus now"
              : focus.reason === "due"
                ? focus.overdue
                  ? "In focus: the deadline has passed"
                  : "In focus: the deadline is within 24 hours"
                : undefined
          }
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
            event.preventDefault();
            if (event.metaKey || event.ctrlKey)
              return toggleSelect(issue.number);
            if (event.shiftKey) return selectRange(issue.number);
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
          <span
            role="checkbox"
            aria-checked={selected.has(issue.number)}
            aria-label={`Select #${issue.number}`}
            className="issue-select"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.shiftKey) selectRange(issue.number);
              else toggleSelect(issue.number);
            }}
          >
            {selected.has(issue.number) ? "✓" : ""}
          </span>
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
            {focus.dueIn !== null && (
              <span
                className={`issue-due${focus.overdue ? " overdue" : focus.dueIn <= DUE_SOON_MS ? " soon" : ""}`}
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
  };

  return (
    <section
      className={`issues-view${openNumber ? " with-panel" : ""}${selected.size ? " selecting" : ""}`}
    >
      <div className="issues-main">
        <header className="issues-header">
          <h1>Issues</h1>
          <span className="issues-count">
            {filtered
              ? `${visible.length} of ${board.issues.length}`
              : board.issues.length}
          </span>
          <IssueStats board={board} now={now} />
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
          className={`issues-board focus-clock${hints !== null ? " hinting" : ""}`}
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
      {hints !== null &&
        controls.map((control, i) => {
          const label = labels[hintOrder.length + i];
          if (!label?.startsWith(hints)) return null;
          return (
            <span
              key={label}
              className="issue-hint control"
              data-hint={label}
              style={{ left: control.left - 6, top: control.top - 8 }}
            >
              <b>{hints}</b>
              {label.slice(hints.length)}
            </span>
          );
        })}
      {picker &&
        (() => {
          const { numbers } = picker;
          const many = numbers.length > 1;
          const chosen = board.issues.filter((i) => numbers.includes(i.number));
          if (!chosen.length) return null;
          const name = many ? `${numbers.length} issues` : `#${numbers[0]}`;
          const close = () => {
            setPicker(null);
            if (!many) focusCard(numbers[0]);
          };
          const common = <T,>(get: (i: IssueSummary) => T) =>
            chosen.every((i) => get(i) === get(chosen[0]))
              ? String(get(chosen[0]))
              : "";
          if (picker.kind === "labels")
            return (
              <BulkLabels
                count={numbers.length}
                anchor={picker.anchor}
                onClose={close}
                onApply={(edits) => {
                  close();
                  void runBulk(
                    { addLabels: edits.add, removeLabels: edits.remove },
                    numbers,
                  );
                }}
              />
            );
          if (picker.kind === "delete")
            return (
              <KeyPicker
                title={`Delete ${name} and ${many ? "their" : "its"} notes?`}
                options={[
                  { value: "delete", label: `Delete ${name}`, color: "red" },
                  { value: "cancel", label: "Cancel" },
                ]}
                current="cancel"
                anchor={picker.anchor}
                onClose={close}
                onChoose={(value) => {
                  close();
                  if (value === "delete")
                    void runBulk({ delete: true }, numbers);
                }}
              />
            );
          return picker.kind === "status" ? (
            <KeyPicker
              title={`Status of ${name}`}
              options={board.statuses.map((s) => ({
                value: s.key,
                label: s.name,
                color: STATUS_COLOR[s.color] ?? s.color,
              }))}
              current={common((i) => i.status)}
              anchor={picker.anchor}
              onClose={close}
              onChoose={(status) => {
                close();
                if (many) void runBulk({ status }, numbers);
                else if (status !== chosen[0].status)
                  void move(numbers[0], status, null).then(() =>
                    focusCard(numbers[0]),
                  );
              }}
            />
          ) : (
            <KeyPicker
              title={`Priority of ${name}`}
              options={PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_NAMES[p],
                color: p === "none" ? undefined : PRIORITY_COLOR[p],
              }))}
              firstNumber={0}
              current={common((i) => i.priority ?? "none")}
              anchor={picker.anchor}
              onClose={close}
              onChoose={(priority) => {
                close();
                void runBulk({ priority }, numbers);
              }}
            />
          );
        })()}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onAction={(action, rect) => {
            const numbers = [...selected];
            const anchor = { left: rect.left, top: rect.top - 8 };
            if (action === "focus") toggleFocus(numbers);
            else if (action === "archive") {
              void runBulk({ archived: true }, numbers);
              setSelected(new Set());
            } else setPicker({ kind: action, numbers, anchor });
          }}
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
