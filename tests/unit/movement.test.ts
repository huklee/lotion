import { expect, it } from "vitest";
import {
  moveBlocks,
  removeBlocksPreservingHierarchy,
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
