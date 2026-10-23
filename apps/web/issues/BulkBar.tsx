import { useEffect, useRef, useState } from "react";
import { Archive, Tag, Trash2, X } from "lucide-react";

export type BulkAction =
  "status" | "priority" | "labels" | "archive" | "delete";

/** The toolbar shown while several issues are selected. */
export function BulkBar({
  count,
  onAction,
  onClear,
}: {
  count: number;
  onAction: (action: BulkAction, anchor: DOMRect) => void;
  onClear: () => void;
}) {
  const button = (
    action: BulkAction,
    label: string,
    key: string,
    icon?: React.ReactNode,
  ) => (
    <button
      onClick={(event) =>
        onAction(action, event.currentTarget.getBoundingClientRect())
      }
      title={`${label} (${key})`}
    >
      {icon}
      {label}
      <kbd>{key}</kbd>
    </button>
  );
  return (
    <div className="issues-bulk" role="toolbar" aria-label="Selected issues">
      <span className="issues-bulk-count">{count} selected</span>
      {button("status", "Status", "s")}
      {button("priority", "Priority", "p")}
      {button("labels", "Labels", "t", <Tag size={13} />)}
      {button("archive", "Archive", "a", <Archive size={13} />)}
      {button("delete", "Delete", "Del", <Trash2 size={13} />)}
      <button
        aria-label="Clear selection"
        title="Clear selection (Esc)"
        onClick={onClear}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** "+bug -ui idea": labels to add (bare or +) and remove (-) on the selection. */
export function parseLabelEdits(text: string) {
  const parts = text
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    add: parts
      .filter((p) => !p.startsWith("-"))
      .map((p) => p.replace(/^\+/, ""))
      .filter(Boolean),
    remove: parts
      .filter((p) => p.startsWith("-"))
      .map((p) => p.slice(1))
      .filter(Boolean),
  };
}

/** A one-line box for label changes on several issues. */
export function BulkLabels({
  count,
  anchor,
  onApply,
  onClose,
}: {
  count: number;
  anchor: { left: number; top: number } | null;
  onApply: (edits: { add: string[]; remove: string[] }) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div
      className="key-picker"
      role="dialog"
      aria-label={`Labels of ${count} issues`}
      style={
        anchor
          ? {
              left: Math.min(anchor.left, window.innerWidth - 280),
              top: Math.min(anchor.top, window.innerHeight - 120),
            }
          : undefined
      }
    >
      <div className="key-picker-title">
        Labels of {count} issues — <code>+add</code> <code>-remove</code>
      </div>
      <input
        ref={input}
        className="bulk-labels-input"
        aria-label="Label changes"
        placeholder="+bug -ui"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          } else if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            const edits = parseLabelEdits(text);
            if (edits.add.length || edits.remove.length) onApply(edits);
            else onClose();
          }
        }}
        onBlur={onClose}
      />
    </div>
  );
}
