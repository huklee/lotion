import {
  Plus,
  FileText,
  ArrowDownToLine,
  FolderOpen,
  ArrowUpFromLine,
} from "lucide-react";
import type { TreeNode } from "../../packages/document-schema/index";

type WorkspaceHomeProps = {
  roots: TreeNode[];
  pageCount: number;
  create: () => Promise<void>;
  openPage: (id: string) => Promise<void>;
  onExport: () => void;
  onImport: () => void;
};
export function WorkspaceHome({
  roots,
  pageCount,
  create,
  openPage,
  onExport,
  onImport,
}: WorkspaceHomeProps) {
  return (
    <section className="home-content">
      <div className="eyebrow">YOUR OWN LITTLE CORNER</div>
      <h1>
        Make room for
        <br />
        <span>what’s on your mind.</span>
      </h1>
      <p className="subtitle">
        Notes, plans, half-formed ideas.
        <br />
        Keep them together. Make them yours.
      </p>
      <button className="primary" onClick={() => void create()}>
        <Plus size={17} />
        Create a page
      </button>
      <div className="home-section">
        <h2>
          Your pages <span>{pageCount}</span>
        </h2>
        <button
          className="quiet"
          onClick={() => onExport()}
          disabled={!pageCount}
        >
          Export workspace <ArrowDownToLine size={14} />
        </button>
      </div>
      <div className="page-cards">
        {roots.slice(0, 12).map((n) => (
          <button
            className="page-card"
            key={n.id}
            onClick={() => void openPage(n.id)}
          >
            <div className="card-icon">
              <FileText size={23} />
            </div>
            <strong>{n.title || "Untitled"}</strong>
            <span>
              Edited{" "}
              {new Date(n.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </button>
        ))}
        <button className="page-card new-card" onClick={() => void create()}>
          <Plus size={24} />
          <span>Start something new</span>
        </button>
      </div>
      <div className="home-tip">
        <FolderOpen size={20} />
        <div>
          <strong>Your notes, at home.</strong>
          <p>
            Bring a whole folder of Markdown files. Your structure and images
            come along.
          </p>
        </div>
        <button className="quiet" onClick={() => onImport()}>
          Import <ArrowUpFromLine size={14} />
        </button>
      </div>
    </section>
  );
}
