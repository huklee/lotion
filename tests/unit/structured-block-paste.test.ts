import { expect, it } from "vitest";
import { structuredBlocksFromClipboard } from "../../apps/web/structured-block-paste";
import { toMarkdown } from "../../packages/markdown/convert";

it("recognizes a plain multi-block heading and list outline", () => {
  const blocks = structuredBlocksFromClipboard(
    "## Plan\n\n- First\n- [x] Finished\n- [ ] Remaining\n",
  );
  expect(blocks?.map((block) => block.type)).toEqual([
    "heading",
    "bulletListItem",
    "checkListItem",
    "checkListItem",
  ]);
  expect(blocks?.slice(2).map((block) => block.props?.checked)).toEqual([
    true,
    false,
  ]);
});

it("preserves nested list hierarchy", () => {
  const blocks = structuredBlocksFromClipboard(
    "- Parent\n  - Child\n- Sibling",
  );
  expect(blocks?.map((block) => block.type)).toEqual([
    "bulletListItem",
    "bulletListItem",
  ]);
  expect(blocks?.[0].children?.[0].type).toBe("bulletListItem");
});

it("reconstructs the structured Markdown emitted by selected-block copy", () => {
  const markdown = toMarkdown([
    {
      id: "heading",
      type: "heading",
      props: { level: 3 },
      content: [{ type: "text", text: "Copied heading", styles: {} }],
    },
    {
      id: "task",
      type: "checkListItem",
      props: { checked: true },
      content: [{ type: "text", text: "Copied task", styles: {} }],
    },
  ]).markdown;
  const blocks = structuredBlocksFromClipboard(markdown);
  expect(blocks?.map((block) => block.type)).toEqual([
    "heading",
    "checkListItem",
  ]);
  expect(blocks?.[0].props?.level).toBe(3);
  expect(blocks?.[1].props?.checked).toBe(true);
});

it("recognizes a single structural block", () => {
  expect(structuredBlocksFromClipboard("- One bullet")?.[0].type).toBe(
    "bulletListItem",
  );
});

it.each([
  "# Heading\nordinary prose",
  "# Heading\n**formatted prose**",
  "- [link](javascript:alert(1))\n- Safe",
])("keeps ambiguous or rich Markdown literal: %s", (text) => {
  expect(structuredBlocksFromClipboard(text)).toBeNull();
});
