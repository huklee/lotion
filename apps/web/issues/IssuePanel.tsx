import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { ApiError } from "../api";
import { pillStyle } from "../database-ui";
import {
  PRIORITIES,
  PRIORITY_NAMES,
  type Issue,
  type IssueStatus,
} from "../../../packages/issues/model";
import { issuesApi } from "./issues-api";
import { labelColor } from "./board-order";

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
export type PanelFocus = { field: "title" | "note"; at: number };

/** One issue beside the board: fields saved on blur, and its status notes. */
export function IssuePanel({
  number,
  statuses,
  seq,
  focus,
  onChanged,
  onClose,
  onError,
}: {
  number: number;
  statuses: IssueStatus[];
  /** The board's change counter; a new value reloads the issue. */
  seq: number;
  focus?: PanelFocus | null;
  onChanged: () => Promise<void>;
  onClose: () => void;
  onError: (error: unknown) => void;
}) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [labels, setLabels] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useRef(new Set<string>());
  const panel = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const loaded = !!issue;

  useEffect(() => {
    if (!focus || !loaded || Date.now() - focus.at > 3000) return;
    const el = focus.field === "title" ? titleRef.current : noteRef.current;
    el?.focus();
    if (focus.field === "title") el?.select();
  }, [focus, loaded]);

  const show = useCallback((next: Issue) => {
    setIssue(next);
    if (!dirty.current.has("title")) setTitle(next.title);
    if (!dirty.current.has("labels")) setLabels(labelText(next.labels));
    if (!dirty.current.has("body")) setBody(next.body);
  }, []);

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
    field: "title" | "labels" | "body" | "status" | "priority",
    value: unknown,
  ) => {
    if (!issue) return;
    try {
      const next = await issuesApi.patch(number, issue.version, {
        [field]: value,
      });
      dirty.current.delete(field);
      show(next);
      setNotice("");
      await onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        dirty.current.delete(field);
        setNotice(
          "This issue changed elsewhere; it was reloaded. Make your edit again.",
        );
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
      {notice && (
        <p className="issue-notice" role="status">
          {notice}
        </p>
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
        <label>
          <span>Labels</span>
          <input
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
        <div className="issue-dates">
          Created {when(issue.createdAt)} · Updated {when(issue.updatedAt)}
        </div>
      </div>
      <textarea
        className="issue-body"
        aria-label="Description"
        placeholder="Description (Markdown)…"
        value={body}
        rows={5}
        onChange={(event) => {
          dirty.current.add("body");
          setBody(event.target.value);
        }}
        onBlur={() => {
          if (!dirty.current.has("body")) return;
          if (body !== issue.body) void save("body", body);
          else dirty.current.delete("body");
        }}
      />
      <h2 className="issue-notes-title">Status notes</h2>
      <ol className="issue-notes" aria-label="Status notes">
        {issue.notes.map((n) => (
          <li key={n.id} className={`issue-note kind-${n.kind}`}>
            <div className="issue-note-head">
              <b>{n.author}</b>
              <time dateTime={n.at}>{when(n.at)}</time>
              {n.kind !== "note" && (
                <span className="issue-note-kind">{n.text}</span>
              )}
            </div>
            {n.kind === "note" && (
              <div className="issue-note-text">{n.text}</div>
            )}
          </li>
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
          placeholder="Add a status note… (⌘/Ctrl+Enter)"
          value={note}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" disabled={!note.trim()}>
          Add note
        </button>
      </form>
      <div className="issue-danger">
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
