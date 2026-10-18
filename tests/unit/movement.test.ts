import { expect, it } from "vitest";
import {
  moveBlocks,
  removeBlocksPreservingHierarchy,
  withDescendants,
  selectedBlockSubtrees,
  sectionIds,
} from "../../packages/editor-adapter/movement";
import {
  contentSchema,
  safeUrl,
  type Block,
} from "../../packages/document-schema/index";
const blocks: Block[] = [
  { id: "a", type: "heading", props: { level: 1 } },
  {
    id: "b",
    type: "paragraph",
    children: [{ id: "nested", type: "paragraph" }],
  },
  { id: "c", type: "heading", props: { level: 2 } },
  { id: "d", type: "paragraph" },
  { id: "e", type: "heading", props: { level: 1 } },
];
it("selects a whole heading section up to an equal heading", () =>
  expect(sectionIds(blocks, "a")).toEqual(["a", "b", "c", "d"]));
it("selects a lower section without crossing its boundary", () =>
  expect(sectionIds(blocks, "c")).toEqual(["c", "d"]));
it("moves a section preserving IDs and nested children", () => {
  const result = moveBlocks(blocks, sectionIds(blocks, "a"), "e", "after");
  expect(result.map((b) => b.id)).toEqual(["e", "a", "b", "c", "d"]);
  expect(result[2].children?.[0].id).toBe("nested");
});
it("rejects a move into a selected subtree", () =>
  expect(moveBlocks(blocks, ["b"], "nested", "after")).toBe(blocks));
it("does not duplicate selected parent and child", () =>
  expect(
    moveBlocks(blocks, ["b", "nested"], "e", "after").filter(
      (b) => b.id === "b",
    ),
  ).toHaveLength(1));
it("leaves unknown destinations unchanged", () =>
  expect(moveBlocks(blocks, ["b"], "missing", "after")).toBe(blocks));
it("removes only selected subtrees without changing following indentation", () => {
  const nested: Block[] = [
    {
      id: "parent",
      type: "paragraph",
      children: [
        { id: "delete", type: "paragraph" },
        {
          id: "keep",
          type: "paragraph",
          children: [{ id: "grandchild", type: "paragraph" }],
        },
      ],
    },
    {
      id: "following",
      type: "paragraph",
      children: [{ id: "following-child", type: "paragraph" }],
    },
  ];
  const result = removeBlocksPreservingHierarchy(nested, ["delete"]);
  expect(result.map((block) => block.id)).toEqual(["parent", "following"]);
  expect(result[0].children?.map((block) => block.id)).toEqual(["keep"]);
  expect(result[0].children?.[0].children?.[0].id).toBe("grandchild");
  expect(result[1]).toBe(nested[1]);
  expect(removeBlocksPreservingHierarchy(nested, ["missing"])).toBe(nested);
});
it("removes a selected parent and its complete subtree", () => {
  const result = removeBlocksPreservingHierarchy(blocks, ["b", "nested"]);
  expect(result.map((block) => block.id)).toEqual(["a", "c", "d", "e"]);
});
it("collects selected subtrees once in document order", () => {
  expect(
    selectedBlockSubtrees(blocks, ["nested", "e"]).map((b) => b.id),
  ).toEqual(["nested", "e"]);
  expect(
    selectedBlockSubtrees(blocks, ["b", "nested"]).map((b) => b.id),
  ).toEqual(["b"]);
});
it("rejects duplicate block IDs", () =>
  expect(() =>
    contentSchema.parse({ title: "", blocks: [blocks[0], blocks[0]] }),
  ).toThrow());
it.each([
  "javascript:alert(1)",
  "data:text/html,x",
  "//evil.test",
  "file:///etc/passwd",
])("rejects unsafe URL %s", (url) => expect(safeUrl(url)).toBe(false));

it("deleting a selected parent keeps its unselected children in its place", () => {
  const doc = [
    { id: "top", type: "paragraph" },
    {
      id: "parent",
      type: "paragraph",
      children: [
        {
          id: "c1",
          type: "paragraph",
          children: [{ id: "g1", type: "paragraph" }],
        },
        { id: "c2", type: "paragraph" },
      ],
    },
    { id: "after", type: "paragraph" },
  ] as any;
  const kept = removeBlocksPreservingHierarchy(doc, ["parent"]);
  expect(kept.map((b) => b.id)).toEqual(["top", "c1", "c2", "after"]);
  expect(kept[1].children?.map((b) => b.id)).toEqual(["g1"]);
  // a selected child goes with it; the other child stays
  const partly = removeBlocksPreservingHierarchy(doc, ["parent", "c1"]);
  expect(partly.map((b) => b.id)).toEqual(["top", "g1", "c2", "after"]);
  // a whole subtree selected is removed entirely
  expect(
    removeBlocksPreservingHierarchy(doc, withDescendants(doc, ["parent"])).map(
      (b) => b.id,
    ),
  ).toEqual(["top", "after"]);
  expect(withDescendants(doc, ["parent"])).toEqual([
    "parent",
    "c1",
    "g1",
    "c2",
  ]);
});
