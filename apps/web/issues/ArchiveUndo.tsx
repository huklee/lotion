import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { matchShortcut } from "../keyboard-layout";

// text fields keep their own ⌘Z (same test as the board's isTyping)
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** How long the Undo toast stays after an archive. */
export const ARCHIVE_UNDO_MS = 3000;

export type ArchivedBatch = { numbers: number[]; id: number };

/**
 * After issues are archived: a small toast at the bottom with Undo for a few
 * seconds, and ⌘/Ctrl+Z (outside text fields) undoes it meanwhile. Hovering
 * the toast keeps it open.
 */
export function ArchiveUndoToast({
  batch,
  onUndo,
  onDone,
}: {
  batch: ArchivedBatch | null;
  onUndo: (numbers: number[]) => void;
  onDone: () => void;
}) {
  const timer = useRef(0);
  const start = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(onDone, ARCHIVE_UNDO_MS);
  };
  const undo = () => {
    if (!batch) return;
    window.clearTimeout(timer.current);
    onDone();
    onUndo(batch.numbers);
  };
  // a new batch restarts the countdown
  useEffect(() => {
    if (!batch) return;
    start();
    return () => window.clearTimeout(timer.current);
  }, [batch?.id]);
  useEffect(() => {
    if (!batch) return;
    const key = (event: KeyboardEvent) => {
      if (!matchShortcut(event, "Mod+Z") || typingIn(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      undo();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });
  if (!batch) return null;
  const count = batch.numbers.length;
  return (
    <div
      className="issue-toast archive-undo"
      role="status"
      onMouseEnter={() => window.clearTimeout(timer.current)}
      onMouseLeave={start}
    >
      <span>
        Archived {count === 1 ? <b>#{batch.numbers[0]}</b> : `${count} issues`}
      </span>
      <button onClick={undo} title="Undo (⌘Z / Ctrl+Z)">
        Undo <kbd>⌘Z</kbd>
      </button>
      <button
        aria-label="Dismiss"
        onClick={() => {
          window.clearTimeout(timer.current);
          onDone();
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
