import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DATABASE_PROPERTY_TYPES,
  changeColumnType,
  moveColumn,
  removeColumn,
  setSelectOptions,
  type DatabaseColumn,
  type DatabasePropertyType,
  type DatabaseState,
} from "../../packages/database/model";

const TYPE_LABEL: Record<DatabasePropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  checkbox: "Checkbox",
  date: "Date",
};

/**
 * A menu floating above the page (portal to <body>, fixed under its button), so the
 * table's scroll container cannot clip it. Closes on Escape, an outside click or a
 * page scroll, and returns focus to the button that opened it.
 */
export function Floating({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", outside, true);
    ref.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", outside, true);
      if (anchor.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [anchor, onClose]);
  const rect = anchor.getBoundingClientRect();
  const top = Math.min(rect.bottom + 4, window.innerHeight - 120);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 268));
  return createPortal(
    <div
      ref={ref}
      className="lotion-database-menu"
      role="dialog"
      aria-label={label}
      style={{ top, left, maxHeight: window.innerHeight - top - 12 }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function PropertyMenu({
  anchor,
  column,
  state,
  index,
  update,
  onClose,
}: {
  anchor: HTMLElement;
  column: DatabaseColumn;
  state: DatabaseState;
  index: number;
  update: (next: DatabaseState) => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [options, setOptions] = useState(
    (column.options ?? []).map((value) => ({ original: value, value })),
  );
  const [error, setError] = useState("");
  const saveOptions = (next = options) => {
    try {
      const renames: Record<string, string> = {};
      for (const option of next)
        if (option.original && option.original !== option.value.trim())
          renames[option.original] = option.value.trim();
      update(
        setSelectOptions(
          state,
          column.id,
          next.map((o) => o.value),
          renames,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Floating
      anchor={anchor}
      label={`${column.name} property settings`}
      onClose={onClose}
    >
      <label>
        Type
        <select
          value={column.type}
          onChange={(event) =>
            update(
              changeColumnType(
                state,
                column.id,
                event.target.value as DatabasePropertyType,
              ),
            )
          }
        >
          {DATABASE_PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </label>
      {column.type === "select" && (
        <fieldset>
          <legend>Options</legend>
          {options.map((option, i) => (
            <div className="lotion-database-option" key={i}>
              <input
                aria-label={`Option ${i + 1}`}
                maxLength={100}
                value={option.value}
                onChange={(event) =>
                  setOptions(
                    options.map((o, j) =>
                      j === i ? { ...o, value: event.target.value } : o,
                    ),
                  )
                }
                onBlur={() => saveOptions()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveOptions();
                  }
                }}
              />
              <button
                type="button"
                aria-label={`Remove option ${option.value || i + 1}`}
                disabled={options.length <= 1}
                onClick={() => {
                  const next = options.filter((_, j) => j !== i);
                  setOptions(next);
                  saveOptions(next);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={options.length >= 20}
            onClick={() => {
              let n = options.length + 1;
              while (options.some((o) => o.value === `Option ${n}`)) n++;
              const next = [...options, { original: "", value: `Option ${n}` }];
              setOptions(next);
              saveOptions(next);
            }}
          >
            Add option
          </button>
        </fieldset>
      )}
      <div className="lotion-database-menu-row">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => update(moveColumn(state, column.id, -1))}
        >
          ← Move left
        </button>
        <button
          type="button"
          disabled={index === state.columns.length - 1}
          onClick={() => update(moveColumn(state, column.id, 1))}
        >
          Move right →
        </button>
      </div>
      {confirmDelete ? (
        <div className="lotion-database-confirm" role="alert">
          Delete “{column.name}” and its values in every row?
          <button
            type="button"
            className="danger"
            onClick={() => {
              update(removeColumn(state, column.id));
              onClose();
            }}
          >
            Delete property
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="danger"
          onClick={() => setConfirmDelete(true)}
        >
          Delete property…
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </Floating>
  );
}

export function RowMenu({
  anchor,
  index,
  count,
  canPage,
  onDuplicate,
  onMove,
  onDelete,
  onClose,
  isTemplate,
  onTemplate,
}: {
  anchor: HTMLElement;
  isTemplate?: boolean;
  onTemplate?: () => void;
  index: number;
  count: number;
  canPage: boolean;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Floating anchor={anchor} label="Row actions" onClose={onClose}>
      <button type="button" disabled={!canPage} onClick={onDuplicate}>
        Duplicate row
      </button>
      {onTemplate && (
        <button type="button" disabled={!canPage} onClick={onTemplate}>
          {isTemplate
            ? "✓ Template for new entries"
            : "Use as template for new entries"}
        </button>
      )}
      <div className="lotion-database-menu-row">
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑ Move up
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          ↓ Move down
        </button>
      </div>
      {confirmDelete ? (
        <div className="lotion-database-confirm" role="alert">
          Delete this row? Its page moves to the trash and can be restored.
          <button type="button" className="danger" onClick={onDelete}>
            Delete row
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="danger"
          onClick={() => setConfirmDelete(true)}
        >
          Delete row…
        </button>
      )}
    </Floating>
  );
}
