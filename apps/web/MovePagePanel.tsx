import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Home } from "lucide-react";
import type { TreeNode } from "../../packages/document-schema/index";
import { buildMovePageTree, type MovePageTreeNode } from "./move-page-tree";

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
  const tree = useMemo(
    () => buildMovePageTree(visible, activeId),
    [activeId, visible],
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function treeItem(item: MovePageTreeNode, depth: number) {
    const title = item.node.title || "Untitled";
    const isCollapsed = collapsed.has(item.node.id);
    const hasChildren = item.children.length > 0;
    return (
      <div
        className="move-tree-item"
        key={item.node.id}
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={hasChildren ? !isCollapsed : undefined}
      >
        <div className="move-tree-row" style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? (
            <button
              className="move-tree-toggle"
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${title}`}
              onClick={() =>
                setCollapsed((previous) => {
                  const next = new Set(previous);
                  if (next.has(item.node.id)) next.delete(item.node.id);
                  else next.add(item.node.id);
                  return next;
                })
              }
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          ) : (
            <span className="move-tree-toggle-spacer" aria-hidden="true" />
          )}
          <button
            className="move-tree-destination"
            aria-label={`Move to ${title}`}
            onClick={() => onMove(item.node.id)}
          >
            <span aria-hidden="true">
              {item.node.icon || <FileText size={16} />}
            </span>
            <span>{title}</span>
          </button>
        </div>
        {hasChildren && !isCollapsed ? (
          <div role="group">
            {item.children.map((child) => treeItem(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <h2>Move this page</h2>
      <p>Choose a parent from the document tree.</p>
      <div className="move-tree-root-option">
        <button
          aria-label="Move to workspace root"
          onClick={() => onMove(null)}
        >
          <Home size={16} />
          Workspace root
        </button>
      </div>
      <div className="move-tree" role="tree" aria-label="Document tree">
        {tree.length ? (
          tree.map((item) => treeItem(item, 0))
        ) : (
          <p className="move-tree-empty">No other pages are available.</p>
        )}
      </div>
    </>
  );
}
