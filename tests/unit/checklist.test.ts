import { expect, it } from "vitest";
import {
  bulkCheckedValue,
  checklistIdsInSubtrees,
  selectionCoversContent,
} from "../../packages/editor-adapter/checklist";
import type { Block } from "../../packages/document-schema/index";

const check = (id: string, checked: boolean, children?: Block[]): Block => ({
  id,
  type: "checkListItem",
  props: { checked },
  children,
});
const blocks: Block[] = [
  { id: "title", type: "heading", props: { level: 1 } },
  check("a", false),
  {
    id: "group",
    type: "paragraph",
    children: [
      check("b", true, [check("b1", false)]),
      { id: "note", type: "paragraph" },
    ],
  },
  check("c", false),
];

it("collects checklist items inside the selected blocks, nested ones included", () => {
  expect(checklistIdsInSubtrees(blocks, ["title", "a", "group"])).toEqual([
    "a",
    "b",
    "b1",
  ]);
  expect(checklistIdsInSubtrees(blocks, ["b"])).toEqual(["b", "b1"]);
  expect(checklistIdsInSubtrees(blocks, ["title"])).toEqual([]);
  // a selected child inside a selected parent is not counted twice
  expect(checklistIdsInSubtrees(blocks, ["group", "b1"])).toEqual(["b", "b1"]);
});

it("checks all unless every item is already checked", () => {
  expect(
    bulkCheckedValue([
      { props: { checked: true } },
      { props: { checked: false } },
    ]),
  ).toBe(true);
  expect(bulkCheckedValue([{ props: { checked: false } }])).toBe(true);
  expect(
    bulkCheckedValue([
      { props: { checked: true } },
      { props: { checked: true } },
    ]),
  ).toBe(false);
  expect(bulkCheckedValue([{ props: {} }])).toBe(true);
});

it("counts a block only when the text selection covers its content", () => {
  expect(selectionCoversContent(5, 20, 10, 15)).toBe(true);
  expect(selectionCoversContent(12, 30, 10, 15)).toBe(true);
  // selection ends exactly where the next block's text starts
  expect(selectionCoversContent(2, 10, 10, 15)).toBe(false);
  // selection starts exactly at the end of the previous block's text
  expect(selectionCoversContent(15, 25, 10, 15)).toBe(false);
  // empty checklist item inside / outside the selection
  expect(selectionCoversContent(5, 20, 10, 10)).toBe(true);
  expect(selectionCoversContent(11, 20, 10, 10)).toBe(false);
});
