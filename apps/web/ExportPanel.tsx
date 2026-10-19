import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import type { ConfluenceOutput } from "../../packages/confluence/convert";
import { ConfluencePreview } from "./ConfluencePreview";

type ExportPanelProps = {
  busy: boolean;
  activeId: string | undefined;
  pageCount: number;
  title: string;
  copyPageMarkdown: () => Promise<void>;
  copyPageConfluence: (storageOnly?: boolean) => Promise<void>;
  pageConfluence: () => ConfluenceOutput | null;
  exportWorkspace: (rootId?: string, portable?: boolean) => Promise<void>;
};

export function ExportPanel({
  busy,
  activeId,
  pageCount,
  title,
  copyPageMarkdown,
  copyPageConfluence,
  pageConfluence,
  exportWorkspace,
}: ExportPanelProps) {
  const [preview, setPreview] = useState<ConfluenceOutput | null>(null);
  if (preview)
    return (
      <ConfluencePreview
        converted={preview}
        copy={(storageOnly) => void copyPageConfluence(storageOnly)}
        back={() => setPreview(null)}
      />
    );
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
        {activeId && (
          <button disabled={busy} onClick={() => void copyPageConfluence()}>
            Copy page for Confluence
            <span>Paste into a Confluence page; formatting kept</span>
          </button>
        )}
        {activeId && (
          <button disabled={busy} onClick={() => setPreview(pageConfluence())}>
            Preview as Confluence
            <span>See the page and its Confluence storage format</span>
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
