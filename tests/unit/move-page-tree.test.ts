import { expect, it } from "vitest";
import type { TreeNode } from "../../packages/document-schema/index";
import { buildMovePageTree } from "../../apps/web/move-page-tree";

function node(
  id: string,
  parentId: string | null = null,
  hidden = false,
): TreeNode {
  return {
    id,
    parentId,
    hidden,
    title: id,
    icon: "📄",
    schemaVersion: 1,
    revision: 1,
    position: id,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
    deletedAt: null,
  };
}

it("builds an ordered hierarchy and excludes the active subtree", () => {
  const tree = buildMovePageTree(
    [
      node("root-a"),
      node("child-a", "root-a"),
      node("grandchild-a", "child-a"),
      node("root-b"),
      node("hidden", null, true),
    ],
    "child-a",
  );
  expect(tree.map((item) => item.node.id)).toEqual(["root-a", "root-b"]);
  expect(tree[0].children).toEqual([]);
});

it("keeps orphaned destinations visible and bounds malformed cycles", () => {
  const tree = buildMovePageTree(
    [
      node("orphan", "missing"),
      node("cycle-a", "cycle-b"),
      node("cycle-b", "cycle-a"),
    ],
    undefined,
  );
  expect(tree.map((item) => item.node.id)).toEqual(["orphan", "cycle-a"]);
  expect(tree[1].children[0].node.id).toBe("cycle-b");
  expect(tree[1].children[0].children).toEqual([]);
});
