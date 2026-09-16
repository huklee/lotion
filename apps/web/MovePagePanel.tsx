import { Home, FileText } from "lucide-react";
import type { TreeNode } from "../../packages/document-schema/index";

type MovePagePanelProps = {
  activeId: string | undefined;
  visible: TreeNode[];
  onMove: (parentId: string | null) => void;
};

export function MovePagePanel({
  activeId,
  visible,
  onMove,
}: MovePagePanelProps) {
  return (
    <>
      <h2>Move this page</h2>
      <p>Choose a parent. Drag pages in the sidebar to nest them, too.</p>
      <div className="search-results">
        <button onClick={() => onMove(null)}>
          <Home size={16} />
          Workspace root
        </button>
        {visible
          .filter((n) => n.id !== activeId)
          .map((n) => (
            <button key={n.id} onClick={() => onMove(n.id)}>
              <FileText size={16} />
              {n.title || "Untitled"}
            </button>
          ))}
      </div>
    </>
  );
}
