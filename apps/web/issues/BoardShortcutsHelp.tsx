import { X } from "lucide-react";
import { BOARD_SHORTCUTS } from "./issue-keys";

/** The board's key list, opened with "?". */
export function BoardShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="issues-shortcuts"
      role="dialog"
      aria-label="Issue shortcuts"
    >
      <div className="issues-shortcuts-head">
        <strong>Keyboard shortcuts</strong>
        <button aria-label="Close shortcuts" onClick={onClose}>
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
  );
}
