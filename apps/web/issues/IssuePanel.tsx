import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CalendarDays,
  Crosshair,
  FileText,
  Link2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  markdownToHtml,
  toggleTask,
} from "../../../packages/markdown/render-html";

import { textToBlocks } from "../paste/text-blocks";
import type { TreeNode } from "../../../packages/document-schema/index";
import { ApiError, api } from "../api";
import { pillStyle } from "../database-ui";
import {
  PRIORITIES,
  PRIORITY_NAMES,
  dueLabel,
  focusState,
  type Issue,
  type IssueStatus,
} from "../../../packages/issues/model";
import { issuesApi } from "./issues-api";
import { DatePicker } from "../DatePicker";
import { IssueNoteItem, enterSubmits } from "./IssueNoteItem";
import { labelColor } from "./board-order";

/** An ISO date-time as the value of a datetime-local field (local time). */
function localInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Pasted-text blocks carry no ids; a saved page needs one on every block. */
function withIds<T extends { id?: string; children?: T[] }>(blocks: T[]): T[] {
  return blocks.map((block) => ({
    ...block,
    id: block.id || crypto.randomUUID(),
    children: withIds(block.children ?? []),
  }));
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const labelText = (labels: string[]) => labels.join(", ");
const parseLabels = (text: string) =>
  [
    ...new Set(
      text
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);

/** A keyboard request to focus a field once the issue is shown. */
export type PanelFocus = {
  field: "title" | "note" | "description" | "labels";
  at: number;
};

/** One issue beside the board: fields saved on blur, and its status notes. */
export function IssuePanel({
  number,
  statuses,
  seq,
  focus,
  onChanged,
  onClose,
  onError,
  pages = [],
  openPage,
  onPagesChanged,
}: {
  number: number;
  statuses: IssueStatus[];
  /** The board's change counter; a new value reloads the issue. */
  seq: number;
  focus?: PanelFocus | null;
  onChanged: () => Promise<void>;
  onClose: () => void;
  onError: (error: unknown) => void;
  pages?: TreeNode[];
  openPage?: (id: string, blockId?: string) => void;
  onPagesChanged?: () => void;
}) {
  const [linkQuery, setLinkQuery] = useState("");
  const [pickingDue, setPickingDue] = useState(false);
  /** The description shows rendered Markdown until you click to edit it. */
  const [editingBody, setEditingBody] = useState(false);
  const [linking, setLinking] = useState(false);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [labels, setLabels] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** The newer server version while you have unsaved edits to the same issue. */
  const [conflict, setConflict] = useState<Issue | null>(null);
  const conflictRef = useRef<Issue | null>(null);
  const current = useRef<Issue | null>(null);
  const draft = useRef({ title: "", labels: "", body: "" });
  draft.current = { title, labels, body };
  const dirty = useRef(new Set<string>());
  const panel = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const labelsRef = useRef<HTMLInputElement>(null);
  const loaded = !!issue;
  const openedAt = useRef(Date.now());
  const bodyHtml = useMemo(
    () => markdownToHtml(body, { interactiveTasks: true }),
    [body],
  );

  useEffect(() => {
    // only a request made for this panel (just before it opened), however
    // long the issue takes to load; older requests belong to earlier panels
    if (!focus || !loaded || focus.at < openedAt.current - 1000) return;
    if (focus.field === "description") {
      // the editor mounts focused, with the cursor after the text
      setEditingBody(true);
      return;
    }
    const el =
      focus.field === "title"
        ? titleRef.current
        : focus.field === "labels"
          ? labelsRef.current
          : noteRef.current;
    el?.focus();
    if (focus.field === "title") el?.select();
  }, [focus, loaded]);

  const show = useCallback((next: Issue) => {
    const previous = current.current;
    // someone else changed the issue while a field here has unsaved text
    const local = draft.current;
    const clashes = [...dirty.current].filter((field) =>
      field === "title"
        ? local.title.trim() !== next.title
        : field === "labels"
          ? labelText(parseLabels(local.labels)) !== labelText(next.labels)
          : field === "body"
            ? local.body !== next.body
            : false,
    );
    if (previous && next.version !== previous.version && clashes.length) {
      conflictRef.current = next;
      setConflict(next);
    }
    current.current = next;
    setIssue(next);
    if (!dirty.current.has("title")) setTitle(next.title);
    if (!dirty.current.has("labels")) setLabels(labelText(next.labels));
    if (!dirty.current.has("body")) setBody(next.body);
  }, []);

  const resolve = async (keepMine: boolean) => {
    const theirs = conflictRef.current;
    conflictRef.current = null;
    setConflict(null);
    if (!theirs) return;
    if (!keepMine) {
      dirty.current.clear();
      show(theirs);
      return;
    }
    const input: Record<string, unknown> = {};
    for (const field of dirty.current)
      input[field] =
        field === "title"
          ? draft.current.title.trim() || theirs.title
          : field === "labels"
            ? parseLabels(draft.current.labels)
            : draft.current.body;
    try {
      const next = await issuesApi.patch(number, theirs.version, input);
      dirty.current.clear();
      show(next);
      await onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        show(await issuesApi.get(number));
      else onError(error);
    }
  };

  useEffect(() => {
    let alive = true;
    issuesApi
      .get(number)
      .then((next) => alive && (setMissing(false), show(next)))
      .catch((error) => {
        if (!alive) return;
        if (error instanceof ApiError && error.status === 404) setMissing(true);
        else onError(error);
      });
    return () => {
      alive = false;
    };
    // seq: reload when anything on the board changed
  }, [number, seq, show, onError]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        panel.current?.contains(target) &&
        target.matches("input, textarea")
      ) {
        target.blur();
        return;
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (
    field:
      | "title"
      | "labels"
      | "body"
      | "status"
      | "priority"
      | "links"
      | "archived"
      | "focus"
      | "due",
    value: unknown,
  ) => {
    if (!issue || conflictRef.current) return;
    try {
      const next = await issuesApi.patch(number, issue.version, {
        [field]: value,
      });
      dirty.current.delete(field);
      show(next);
      await onChanged();
    } catch (error) {
      // a newer version exists: show it next to your edit and let you choose
      if (error instanceof ApiError && error.status === 409) {
        dirty.current.add(field);
        show(await issuesApi.get(number));
      } else onError(error);
    }
  };

  if (missing)
    return (
      <aside
        className="issue-panel"
        aria-label={`Issue #${number}`}
        ref={panel}
      >
        <button
          className="issue-panel-close"
          aria-label="Close issue"
          onClick={onClose}
        >
          <X size={16} />
        </button>
        <p className="issues-empty">
          Issue #{number} does not exist (it may have been deleted).
        </p>
      </aside>
    );
  if (!issue)
    return (
      <aside
        className="issue-panel"
        aria-label={`Issue #${number}`}
        ref={panel}
      >
        <p className="issues-empty">Loading…</p>
      </aside>
    );

  const inFocus = focusState(issue, statuses, Date.now());
  const isLastStatus = issue.status === statuses.at(-1)?.key;
  return (
    <aside className="issue-panel" aria-label={`Issue #${number}`} ref={panel}>
      <div className="issue-panel-top">
        <span className="issue-number">Issues / #{issue.number}</span>
        <button
          className="issue-panel-close"
          aria-label="Close issue"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <textarea
        ref={titleRef}
        className="issue-title-input"
        aria-label="Title"
        rows={1}
        value={title}
        onChange={(event) => {
          dirty.current.add("title");
          setTitle(event.target.value.replace(/\n/g, " "));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onBlur={() => {
          if (!dirty.current.has("title")) return;
          if (!title.trim()) {
            dirty.current.delete("title");
            setTitle(issue.title);
          } else if (title.trim() !== issue.title)
            void save("title", title.trim());
          else dirty.current.delete("title");
        }}
      />
      {conflict && (
        <div className="issue-conflict" role="alert">
          <p>
            <b>{conflict.updatedBy ?? "Someone"}</b> changed this issue while
            you were editing it.
          </p>
          <div>
            <button onClick={() => void resolve(true)}>Keep mine</button>
            <button onClick={() => void resolve(false)}>Use theirs</button>
          </div>
        </div>
      )}
      <div className="issue-props">
        <label>
          <span>Status</span>
          <select
            aria-label="Status"
            value={issue.status}
            onChange={(event) => void save("status", event.target.value)}
          >
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select
            aria-label="Priority"
            value={issue.priority ?? "none"}
            onChange={(event) => void save("priority", event.target.value)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_NAMES[p]}
              </option>
            ))}
          </select>
        </label>
        <div className="issue-due-row">
          <span>Deadline</span>
          <button
            className={`issue-due-button${issue.due ? "" : " empty"}`}
            aria-label="Deadline"
            title="Pick a date and time"
            onClick={() => setPickingDue(true)}
          >
            <CalendarDays size={13} />
            {issue.due
              ? new Date(issue.due).toLocaleString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Set deadline"}
          </button>
          {issue.due && (
            <button
              className="issue-due-clear"
              aria-label="Clear deadline"
              title="Clear deadline"
              onClick={(event) => {
                event.preventDefault();
                void save("due", null);
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        {pickingDue && (
          <DatePicker
            title="Set deadline"
            confirmLabel="Set deadline"
            withTime
            initial={issue.due ? localInput(issue.due).slice(0, 10) : undefined}
            initialTime={
              issue.due ? localInput(issue.due).slice(11, 16) : "23:59"
            }
            onCancel={() => setPickingDue(false)}
            onClear={
              issue.due
                ? () => {
                    setPickingDue(false);
                    void save("due", null);
                  }
                : undefined
            }
            onInsert={(date, time) => {
              setPickingDue(false);
              void save(
                "due",
                new Date(`${date}T${time ?? "23:59"}`).toISOString(),
              );
            }}
          />
        )}
        <div className="issue-focus-row">
          <span>Focus</span>
          <button
            className={`issue-focus-toggle${issue.focusedAt ? " on" : ""}`}
            aria-pressed={!!issue.focusedAt}
            disabled={isLastStatus}
            title={
              isLastStatus
                ? "Done issues are not in focus"
                : "Focus now (n): highlight this issue until it is done"
            }
            onClick={() => void save("focus", !issue.focusedAt)}
          >
            <Crosshair size={13} /> Focus now
          </button>
          {inFocus.reason === "due" && (
            <span className="issue-focus-auto" role="status">
              {inFocus.overdue
                ? `Overdue by ${dueLabel(inFocus.dueIn!).replace(/ overdue$/, "")}`
                : `Due ${dueLabel(inFocus.dueIn!)}`}{" "}
              — in focus automatically
            </span>
          )}
        </div>
        <label>
          <span>Labels</span>
          <input
            ref={labelsRef}
            aria-label="Labels"
            placeholder="bug, idea"
            value={labels}
            onChange={(event) => {
              dirty.current.add("labels");
              setLabels(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            onBlur={() => {
              if (!dirty.current.has("labels")) return;
              const next = parseLabels(labels);
              if (next.join("\n") !== issue.labels.join("\n"))
                void save("labels", next);
              else {
                dirty.current.delete("labels");
                setLabels(labelText(issue.labels));
              }
            }}
          />
        </label>
        {!!issue.labels.length && (
          <div className="issue-label-row">
            {issue.labels.map((l) => (
              <span
                key={l}
                className="issue-label"
                style={pillStyle(labelColor(l))}
              >
                {l}
              </span>
            ))}
          </div>
        )}
        <div className="issue-pages" aria-label="Linked pages">
          <span className="issue-pages-label">Pages</span>
          <div className="issue-pages-list">
            {(issue.links ?? []).map((id) => {
              const page = pages.find((p) => p.id === id);
              return (
                <span key={id} className="issue-page-chip">
                  <button
                    className="issue-page-open"
                    disabled={!page || !openPage}
                    onClick={() => openPage?.(id)}
                  >
                    <span aria-hidden="true">{page?.icon || "📄"}</span>
                    {page ? page.title || "Untitled" : "Missing page"}
                  </button>
                  <button
                    aria-label={`Unlink ${page?.title || "page"}`}
                    onClick={() =>
                      void save(
                        "links",
                        (issue.links ?? []).filter((l) => l !== id),
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
            {linking ? (
              <div className="issue-link-picker">
                <input
                  autoFocus
                  aria-label="Find a page to link"
                  placeholder="Page title…"
                  value={linkQuery}
                  onChange={(event) => setLinkQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setLinking(false);
                    }
                  }}
                />
                <ul>
                  {pages
                    .filter(
                      (p) =>
                        !(issue.links ?? []).includes(p.id) &&
                        (p.title || "Untitled")
                          .toLowerCase()
                          .includes(linkQuery.trim().toLowerCase()),
                    )
                    .slice(0, 6)
                    .map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => {
                            setLinking(false);
                            setLinkQuery("");
                            void save("links", [...(issue.links ?? []), p.id]);
                          }}
                        >
                          <span aria-hidden="true">{p.icon || "📄"}</span>{" "}
                          {p.title || "Untitled"}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <button
                className="issue-link-add"
                onClick={() => setLinking(true)}
              >
                <Link2 size={13} /> Link a page
              </button>
            )}
          </div>
        </div>
        {issue.source && (
          <button
            className="issue-source"
            disabled={!openPage}
            onClick={() =>
              openPage?.(issue.source!.pageId, issue.source!.blockId)
            }
          >
            Made from a block in{" "}
            <b>
              {pages.find((p) => p.id === issue.source!.pageId)?.title ||
                "a page"}
            </b>
          </button>
        )}
        <div className="issue-dates">
          Created {when(issue.createdAt)} · Updated {when(issue.updatedAt)}
          {issue.updatedBy ? ` by ${issue.updatedBy}` : ""}
          {issue.archivedAt ? ` · Archived ${when(issue.archivedAt)}` : ""}
        </div>
      </div>
      {editingBody || (conflict && dirty.current.has("body")) ? (
        <textarea
          autoFocus
          onFocus={(event) => {
            const end = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(end, end);
          }}
          onKeyDown={(event) => {
            // ⌘/Ctrl+Enter saves and shows the rendered description
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          className="issue-body"
          aria-label="Description"
          placeholder="Description (Markdown)…"
          value={body}
          rows={Math.min(24, Math.max(5, body.split("\n").length + 1))}
          onChange={(event) => {
            dirty.current.add("body");
            setBody(event.target.value);
          }}
          onBlur={() => {
            setEditingBody(false);
            if (!dirty.current.has("body")) return;
            if (body !== issue.body) void save("body", body);
            else dirty.current.delete("body");
          }}
        />
      ) : bodyHtml ? (
        <div className="issue-body-view">
          <div
            role="region"
            aria-label="Description"
            className="issue-markdown"
            title="Click to edit"
            onClick={(event) => {
              // links and checkboxes inside the description keep their own clicks
              const box = (
                event.target as HTMLElement
              ).closest<HTMLInputElement>("input[data-task]");
              if (box) {
                // a checkbox in the description: flip that item in the Markdown
                // source and save; the rendered list follows the new text
                event.preventDefault();
                const next = toggleTask(body, Number(box.dataset.task));
                if (next === body) return;
                dirty.current.add("body");
                setBody(next);
                void save("body", next);
                return;
              }
              if ((event.target as HTMLElement).closest("a, input")) return;
              setEditingBody(true);
            }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
          <button
            className="issue-body-edit"
            aria-label="Edit description"
            onClick={() => setEditingBody(true)}
          >
            <Pencil size={13} />
          </button>
        </div>
      ) : (
        <button
          className="issue-body-empty"
          onClick={() => setEditingBody(true)}
        >
          Add a description (Markdown)…
        </button>
      )}
      <h2 className="issue-notes-title">Status notes</h2>
      <ol className="issue-notes" aria-label="Status notes">
        {issue.notes.map((n) => (
          <IssueNoteItem
            key={n.id}
            note={n}
            onSave={async (text) => {
              try {
                show(await issuesApi.editNote(number, n.id, text));
                await onChanged();
                return true;
              } catch (error) {
                onError(error);
                return false;
              }
            }}
            onDelete={async () => {
              try {
                show(await issuesApi.deleteNote(number, n.id));
                await onChanged();
                return true;
              } catch (error) {
                onError(error);
                return false;
              }
            }}
          />
        ))}
      </ol>
      <form
        className="issue-note-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const text = note.trim();
          if (!text) return;
          try {
            show(await issuesApi.note(number, text));
            setNote("");
            await onChanged();
          } catch (error) {
            onError(error);
          }
        }}
      >
        <textarea
          ref={noteRef}
          aria-label="Add a status note"
          placeholder="Add a status note… (Enter adds, Shift+Enter for a new line)"
          value={note}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            const form = event.currentTarget.form;
            enterSubmits(event, () => form?.requestSubmit());
          }}
        />
        <button type="submit" disabled={!note.trim()}>
          Add note
        </button>
      </form>
      <div className="issue-danger">
        {issue.body.trim() && !confirmDelete && (
          <button
            title="Create a page with this description and link it"
            onClick={async () => {
              try {
                const title = `#${issue.number} ${issue.title}`.slice(0, 200);
                const doc = await api<{ id: string; revision: number }>(
                  "/api/documents",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      title,
                      mutationId: crypto.randomUUID(),
                    }),
                  },
                );
                await api(`/api/documents/${doc.id}/content`, {
                  method: "PUT",
                  headers: { "If-Match": `"${doc.revision}"` },
                  body: JSON.stringify({
                    title,
                    blocks: withIds(textToBlocks(issue.body)),
                    mutationId: crypto.randomUUID(),
                  }),
                });
                const next = await issuesApi.patch(number, issue.version, {
                  links: [...(issue.links ?? []), doc.id],
                  body: `The description moved to the page “${title}”.`,
                });
                dirty.current.delete("body");
                show(next);
                await onChanged();
                onPagesChanged?.();
              } catch (error) {
                onError(error);
              }
            }}
          >
            <FileText size={14} /> Move description to a page
          </button>
        )}
        {!confirmDelete && (
          <button onClick={() => void save("archived", !issue.archivedAt)}>
            <Archive size={14} /> {issue.archivedAt ? "Unarchive" : "Archive"}
          </button>
        )}
        {confirmDelete ? (
          <>
            <span>Delete #{issue.number} and its notes?</span>
            <button
              className="danger"
              onClick={async () => {
                try {
                  await issuesApi.remove(number);
                  await onChanged();
                  onClose();
                } catch (error) {
                  onError(error);
                }
              }}
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Delete issue
          </button>
        )}
      </div>
    </aside>
  );
}
