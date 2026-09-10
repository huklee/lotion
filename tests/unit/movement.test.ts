import { expect, it } from "vitest";
import { moveBlocks, sectionIds } from "../../packages/editor-adapter/movement";
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
