import { FileText, RotateCcw } from "lucide-react";
import type { TreeNode } from "../../packages/document-schema/index";

export function TrashView({
  pages,
  onRestore,
}: {
  pages: TreeNode[];
  onRestore: (id: string) => void;
}) {
  const deleted = pages.filter((page) => page.deletedAt);
  return (
    <section className="home-content">
      <div className="eyebrow">A SECOND CHANCE</div>
      <h1>Trash</h1>
      <p className="subtitle">
        Your pages stay here until you bring them back.
      </p>
      {deleted.map((page) => (
        <div className="trash-row" key={page.id}>
          <FileText size={18} />
          <span>{page.title || "Untitled"}</span>
          <button className="quiet" onClick={() => onRestore(page.id)}>
            <RotateCcw size={14} />
            Restore
          </button>
        </div>
      ))}
      {!deleted.length && (
        <p className="empty-copy">
          Nothing here. Everything is where it belongs.
        </p>
      )}
    </section>
  );
}
