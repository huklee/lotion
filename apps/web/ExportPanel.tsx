import { ArrowDownToLine } from "lucide-react";

type ExportPanelProps = {
  busy: boolean;
  activeId: string | undefined;
  pageCount: number;
  title: string;
  copyPageMarkdown: () => Promise<void>;
  exportWorkspace: (rootId?: string, portable?: boolean) => Promise<void>;
};

export function ExportPanel({
  busy,
  activeId,
  pageCount,
  title,
  copyPageMarkdown,
  exportWorkspace,
}: ExportPanelProps) {
  return (
    <>
      <div className="modal-symbol">
        <ArrowDownToLine size={24} />
      </div>
      <h2>Take your workspace with you.</h2>
      <p>
        Download a complete folder tree as a ZIP, including Markdown, images,
        and exact document snapshots.
      </p>
      <div className="export-options">
        {activeId && (
          <button disabled={busy} onClick={() => void copyPageMarkdown()}>
            Copy page as Markdown
            <span>Title and complete page content</span>
          </button>
        )}
        <button disabled={busy} onClick={() => void exportWorkspace()}>
          Entire workspace <span>{pageCount} pages</span>
        </button>
        {activeId && (
          <button
            disabled={busy}
            onClick={() => void exportWorkspace(activeId)}
          >
            This page & subpages <span>{title || "Untitled"}</span>
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => void exportWorkspace(undefined, true)}
        >
          Portable Markdown <span>Without rich-layout snapshots</span>
        </button>
      </div>
      {busy && <p role="status">Saving and preparing your download…</p>}
    </>
  );
}
