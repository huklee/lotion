import { ArrowUpFromLine, FolderOpen } from "lucide-react";
import type { DragEvent } from "react";
import type { ImportMode } from "./workspace.types";

type ImportPanelProps = {
  busy: boolean;
  dropFolder: (event: DragEvent) => Promise<void>;
  chooseFolder: () => void;
  chooseFiles: () => void;
  importMode: ImportMode;
  setImportMode: (mode: ImportMode) => void;
};

export function ImportPanel({
  busy,
  dropFolder,
  chooseFolder,
  chooseFiles,
  importMode,
  setImportMode,
}: ImportPanelProps) {
  return (
    <>
      <div className="modal-symbol">
        <ArrowUpFromLine size={24} />
      </div>
      <h2>Bring your ideas along.</h2>
      <p>
        Import Markdown, a whole folder, or a Lotion ZIP. Nested pages and
        images stay together.
      </p>
      <div
        className="folder-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => void dropFolder(e)}
      >
        <FolderOpen size={32} />
        <strong>Drop a folder or files here</strong>
        <span>Markdown · Images · ZIP · Up to 100 MB</span>
      </div>
      <div className="button-row">
        <button className="primary" disabled={busy} onClick={chooseFolder}>
          Choose folder
        </button>
        <button disabled={busy} onClick={chooseFiles}>
          Choose files or ZIP
        </button>
      </div>
      <label className="field-label">
        When a bundle has edited Markdown
        <select
          value={importMode}
          onChange={(e) => setImportMode(e.target.value as ImportMode)}
        >
          <option value="auto">Detect and ask before importing</option>
          <option value="markdown">Use Markdown files</option>
          <option value="snapshot">Use exact snapshots</option>
        </select>
      </label>
      {busy && <p role="status">Importing your folder…</p>}
    </>
  );
}
