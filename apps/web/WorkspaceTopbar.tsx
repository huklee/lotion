import { ArrowDownToLine, Check, Menu, Move, Star, Trash2 } from "lucide-react";
import type { TreeNode } from "../../packages/document-schema/index";

type WorkspaceTopbarProps = {
  sidebar: boolean;
  setSidebar: (open: boolean) => void;
  trash: boolean;
  breadcrumbPages: TreeNode[];
  title: string;
  openPage: (id: string) => Promise<void>;
  activeId: string | undefined;
  status: string;
  favorite: boolean;
  onExport: () => void;
  onToggleFavorite: () => void;
  onMove: () => void;
  onTrash: () => void;
};

export function WorkspaceTopbar({
  sidebar,
  setSidebar,
  trash,
  breadcrumbPages,
  title,
  openPage,
  activeId,
  status,
  favorite,
  onExport,
  onToggleFavorite,
  onMove,
  onTrash,
}: WorkspaceTopbarProps) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          className="icon-button"
          aria-label="Toggle sidebar"
          onClick={() => setSidebar(!sidebar)}
        >
          <Menu size={17} />
        </button>
        <span className="muted">Workspace</span>
        {trash ? (
          <>
            <span className="breadcrumb-slash">/</span>
            <span>Trash</span>
          </>
        ) : breadcrumbPages.length ? (
          breadcrumbPages.map((page, index) => (
            <span className="breadcrumb-page" key={page.id}>
              <span className="breadcrumb-slash">/</span>
              <span aria-hidden="true">{page.icon || "📄"}</span>
              {index < breadcrumbPages.length - 1 ? (
                <button onClick={() => void openPage(page.id)}>
                  {page.title || "Untitled"}
                </button>
              ) : (
                <span>{title || "Untitled"}</span>
              )}
            </span>
          ))
        ) : (
          <>
            <span className="breadcrumb-slash">/</span>
            <span>Home</span>
          </>
        )}
      </div>
      <div className="topbar-actions">
        {activeId && !trash && (
          <>
            <span
              className={`save-status ${status === "Conflict" || status === "Save failed" ? "danger" : ""}`}
              role="status"
            >
              {status === "Saved" ? (
                <Check size={13} />
              ) : (
                <span className="status-dot" />
              )}
              {status}
            </span>
            <button className="quiet" onClick={onExport}>
              <ArrowDownToLine size={14} />
              Export
            </button>
            <button
              className="icon-button"
              aria-label={
                favorite ? "Remove from favorites" : "Add to favorites"
              }
              aria-pressed={favorite}
              onClick={onToggleFavorite}
            >
              <Star size={16} fill={favorite ? "currentColor" : "none"} />
            </button>
            <button
              className="icon-button"
              aria-label="Move page"
              onClick={onMove}
            >
              <Move size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Move page to trash"
              onClick={onTrash}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
        <div className="avatar">Y</div>
      </div>
    </header>
  );
}
