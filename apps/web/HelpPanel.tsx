import { Settings2 } from "lucide-react";

export function HelpPanel() {
  return (
    <>
      <div className="modal-symbol">
        <Settings2 size={24} />
      </div>
      <h2>A little less friction.</h2>
      <div className="shortcut-row">
        <span>Find a page</span>
        <kbd>⌘ / Ctrl K</kbd>
      </div>
      <div className="shortcut-row">
        <span>Save immediately</span>
        <kbd>⌘ / Ctrl S</kbd>
      </div>
      <div className="shortcut-row">
        <span>Insert a block</span>
        <kbd>/</kbd>
      </div>
      <div className="shortcut-row">
        <span>Undo</span>
        <kbd>⌘ / Ctrl Z</kbd>
      </div>
      <p>
        Drag in the editor’s left margin to select blocks. Use “Select section”
        to move a heading with its content. Drop images into your page or use
        the image slash command.
      </p>
      <p className="muted">
        Changes save after 3 seconds of quiet, or every 10 seconds while typing.
        Keep this tab open when a draft hasn’t reached the server.
      </p>
    </>
  );
}
