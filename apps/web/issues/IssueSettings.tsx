import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2, X } from "lucide-react";
import { ApiError } from "../api";
import {
  STATUS_COLORS,
  type IssueStatus,
  type IssueSummary,
} from "../../../packages/issues/model";
import { issuesApi } from "./issues-api";

/** A key for a new status from its name ("Waiting on" → "waiting-on"). */
export function statusKey(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "status";
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}-${i}`;
  return key;
}

/** Board settings: columns (rename, colour, order, add, remove) and labels. */
export function IssueSettings({
  statuses,
  issues,
  onClose,
  onSaved,
}: {
  statuses: IssueStatus[];
  issues: IssueSummary[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(statuses);
  const [error, setError] = useState("");
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const count = (key: string) => issues.filter((i) => i.status === key).length;
  const labels = [...new Set(issues.flatMap((i) => i.labels))].sort((a, b) =>
    a.localeCompare(b),
  );
  const labelCount = (l: string) =>
    issues.filter((i) => i.labels.includes(l)).length;
  const update = (index: number, change: Partial<IssueStatus>) =>
    setDraft(draft.map((s, i) => (i === index ? { ...s, ...change } : s)));
  const move = (index: number, step: number) => {
    const next = [...draft];
    const [item] = next.splice(index, 1);
    next.splice(index + step, 0, item);
    setDraft(next);
  };
  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : String(e));

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal issue-settings"
        role="dialog"
        aria-modal="true"
        aria-label="Board settings"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close board settings"
          onClick={onClose}
        >
          <X size={19} />
        </button>
        <h2>Board settings</h2>
        <h3>Columns</h3>
        <p className="muted">
          The last column counts as done. A column can be removed once it is
          empty.
        </p>
        <ol className="issue-settings-statuses">
          {draft.map((status, index) => (
            <li key={status.key}>
              <input
                aria-label={`Name of ${status.name || status.key}`}
                value={status.name}
                maxLength={40}
                onChange={(event) =>
                  update(index, { name: event.target.value })
                }
              />
              <select
                aria-label={`Colour of ${status.name || status.key}`}
                value={status.color}
                onChange={(event) =>
                  update(index, { color: event.target.value })
                }
              >
                {STATUS_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="muted">{count(status.key)}</span>
              <button
                aria-label={`Move ${status.name} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                aria-label={`Move ${status.name} down`}
                disabled={index === draft.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                aria-label={`Remove ${status.name}`}
                disabled={count(status.key) > 0 || draft.length <= 2}
                title={
                  count(status.key) > 0
                    ? "Move its issues to another column first"
                    : "Remove column"
                }
                onClick={() => setDraft(draft.filter((_, i) => i !== index))}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ol>
        <div className="issue-settings-row">
          <button
            onClick={() =>
              setDraft([
                ...draft.slice(0, -1),
                {
                  key: statusKey(
                    "New column",
                    draft.map((s) => s.key),
                  ),
                  name: "New column",
                  color: "purple",
                },
                ...draft.slice(-1),
              ])
            }
          >
            + Add column
          </button>
          <button
            className="primary"
            onClick={async () => {
              setError("");
              try {
                await issuesApi.setStatuses(
                  draft.map((s) => ({ ...s, name: s.name.trim() })),
                );
                await onSaved();
              } catch (e) {
                fail(e);
              }
            }}
          >
            Save columns
          </button>
        </div>
        <h3>Labels</h3>
        {!labels.length && <p className="muted">No labels yet.</p>}
        <ul className="issue-settings-labels">
          {labels.map((label) => (
            <li key={label}>
              <input
                aria-label={`Rename label ${label}`}
                value={renames[label] ?? label}
                maxLength={40}
                onChange={(event) =>
                  setRenames({ ...renames, [label]: event.target.value })
                }
              />
              <span className="muted">{labelCount(label)}</span>
              <button
                disabled={!renames[label]?.trim() || renames[label] === label}
                onClick={async () => {
                  try {
                    await issuesApi.renameLabel(label, renames[label].trim());
                    await onSaved();
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                Rename
              </button>
              {deleting === label ? (
                <button
                  className="danger"
                  onClick={async () => {
                    setDeleting(null);
                    try {
                      await issuesApi.renameLabel(label, null);
                      await onSaved();
                    } catch (e) {
                      fail(e);
                    }
                  }}
                >
                  Remove from {labelCount(label)}
                </button>
              ) : (
                <button
                  aria-label={`Delete label ${label}`}
                  onClick={() => setDeleting(label)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
