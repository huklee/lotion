import type { TreeNode } from "../../packages/document-schema/index";

export type MovePageTreeNode = {
  node: TreeNode;
  children: MovePageTreeNode[];
};

function descendantsOf(nodes: TreeNode[], id: string | undefined) {
  const descendants = new Set<string>();
  if (!id) return descendants;
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }
  const pending = [id];
  while (pending.length) {
    const current = pending.pop()!;
    if (descendants.has(current)) continue;
    descendants.add(current);
    pending.push(...(childrenByParent.get(current) ?? []));
  }
  return descendants;
}

export function buildMovePageTree(
  nodes: TreeNode[],
  activeId: string | undefined,
): MovePageTreeNode[] {
  const excluded = descendantsOf(nodes, activeId);
  const available = nodes.filter(
    (node) => !node.hidden && !excluded.has(node.id),
  );
  const availableIds = new Set(available.map((node) => node.id));
  const childrenByParent = new Map<string | null, TreeNode[]>();
  for (const node of available) {
    const parentId =
      node.parentId && availableIds.has(node.parentId) ? node.parentId : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(parentId, siblings);
  }

  const visited = new Set<string>();
  function branch(node: TreeNode, ancestors: Set<string>): MovePageTreeNode {
    visited.add(node.id);
    const nextAncestors = new Set(ancestors).add(node.id);
    const children = (childrenByParent.get(node.id) ?? [])
      .filter((child) => !nextAncestors.has(child.id))
      .map((child) => branch(child, nextAncestors));
    return { node, children };
  }

  const roots = (childrenByParent.get(null) ?? []).map((node) =>
    branch(node, new Set()),
  );
  // Corrupt cyclic hierarchies should remain selectable instead of disappearing.
  for (const node of available)
    if (!visited.has(node.id)) roots.push(branch(node, new Set()));
  return roots;
}
