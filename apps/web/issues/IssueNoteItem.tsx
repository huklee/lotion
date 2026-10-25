import { useState, type KeyboardEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { markdownToHtml } from "../../../packages/markdown/render-html";
import type { IssueNote } from "../../../packages/issues/model";

/**
 * Enter submits a note (Shift+Enter is a new line). An IME that is still
 * composing a character (Korean input) also sends Enter; that one is ignored.
 */
export function enterSubmits(
  event: KeyboardEvent<HTMLTextAreaElement>,
  submit: () => void,
) {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.nativeEvent.isComposing &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    submit();
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** One entry of the status-note thread; written notes can be edited or deleted. */
export function IssueNoteItem({
  note,
  onSave,
  onDelete,
}: {
  note: IssueNote;
  onSave: (text: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [confirm, setConfirm] = useState(false);
  const written = note.kind === "note";
  const save = async () => {
    const text = draft.trim();
    if (!text) return;
    if (text === note.text || (await onSave(text))) setEditing(false);
  };
  return (
    <li className={`issue-note kind-${note.kind}${editing ? " editing" : ""}`}>
      <div className="issue-note-head">
        <b
          className={`issue-author-name${note.author !== "me" ? " agent" : ""}`}
        >
          {note.author}
        </b>
        <time dateTime={note.at}>{when(note.at)}</time>
        {note.editedAt && (
          <span
            className="issue-note-edited"
            title={`Edited ${when(note.editedAt)}${note.editedBy ? ` by ${note.editedBy}` : ""}`}
          >
            edited
          </span>
        )}
        {!written && <span className="issue-note-kind">{note.text}</span>}
        {written && !editing && !confirm && (
          <span className="issue-note-actions">
            <button
              aria-label="Edit note"
              title="Edit note"
              onClick={() => {
                setDraft(note.text);
                setEditing(true);
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              aria-label="Delete note"
              title="Delete note"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={12} />
            </button>
          </span>
        )}
      </div>
      {confirm && (
        <div className="issue-note-confirm" role="alert">
          Delete this note?
          <button
            className="danger"
            onClick={async () => {
              if (await onDelete()) setConfirm(false);
            }}
          >
            Delete
          </button>
          <button onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
      {written &&
        (editing ? (
          <div className="issue-note-editor">
            <textarea
              autoFocus
              aria-label="Edit note text"
              value={draft}
              rows={Math.min(12, Math.max(2, draft.split("\n").length))}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => {
                const end = event.currentTarget.value.length;
                event.currentTarget.setSelectionRange(end, end);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  // stays inside the note: the panel must not close
                  event.preventDefault();
                  event.stopPropagation();
                  event.nativeEvent.stopImmediatePropagation();
                  setEditing(false);
                  return;
                }
                enterSubmits(event, () => void save());
              }}
            />
            <div className="issue-note-editor-actions">
              <button onClick={() => setEditing(false)}>Cancel</button>
              <button
                className="primary"
                disabled={!draft.trim()}
                onClick={() => void save()}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className="issue-note-text issue-markdown"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(note.text) }}
          />
        ))}
    </li>
  );
}
