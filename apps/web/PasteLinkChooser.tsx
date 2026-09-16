import type { RefObject } from "react";
import { X } from "lucide-react";

type PasteLinkChooserProps = {
  choice: string;
  loading: boolean;
  position: { left: number; top: number };
  menuRef: RefObject<HTMLDivElement | null>;
  onInsert: (asMention: boolean) => Promise<void>;
  onCancel: () => void;
};

export function PasteLinkChooser({
  choice,
  loading,
  position,
  menuRef,
  onInsert,
  onCancel,
}: PasteLinkChooserProps) {
  return (
    <div
      ref={menuRef}
      style={position}
      className="paste-link-chooser"
      role="dialog"
      aria-label="Paste link"
      onMouseDown={(event) => event.preventDefault()}
    >
      <span>{choice}</span>
      <button disabled={loading} onClick={() => void onInsert(true)}>
        {loading ? "Loading preview…" : "Paste as mention"}
      </button>
      <button disabled={loading} onClick={() => void onInsert(false)}>
        Paste as URL
      </button>
      <button aria-label="Cancel paste" onClick={onCancel}>
        <X size={14} />
      </button>
    </div>
  );
}
