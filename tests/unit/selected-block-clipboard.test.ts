import { expect, it } from "vitest";
import type { Block } from "../../packages/document-schema/index";
import {
  rememberSelectedBlockClipboard,
  selectedBlocksFromClipboard,
} from "../../apps/web/selected-block-clipboard";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

it("restores exact selected block types and styles with fresh ids", () => {
  const storage = memoryStorage();
  const blocks: Block[] = [
    {
      id: "source-heading",
      type: "heading",
      props: { level: 2 },
      content: [
        {
          type: "text",
          text: "Styled heading",
          styles: { bold: true, textColor: "blue", backgroundColor: "blue" },
        },
      ],
      children: [
        {
          id: "source-task",
          type: "checkListItem",
          props: { checked: true },
          content: [{ type: "text", text: "Nested task", styles: {} }],
        },
      ],
    },
  ];
  rememberSelectedBlockClipboard("## **Styled heading**", blocks, storage);

  const restored = selectedBlocksFromClipboard(
    "## **Styled heading**",
    storage,
  );
  expect(restored?.[0]).toMatchObject({
    type: "heading",
    props: { level: 2 },
    content: [
      {
        type: "text",
        text: "Styled heading",
        styles: { bold: true, textColor: "blue", backgroundColor: "blue" },
      },
    ],
  });
  expect(restored?.[0].id).not.toBe("source-heading");
  expect(restored?.[0].children?.[0]).toMatchObject({
    type: "checkListItem",
    props: { checked: true },
  });
  expect(restored?.[0].children?.[0].id).not.toBe("source-task");
});

it("does not reinterpret unrelated or malformed clipboard data", () => {
  const malformed = {
    getItem: () => '{"markdown":"other","blocks":[{"type":"heading"}]}',
    setItem: () => undefined,
  };
  expect(selectedBlocksFromClipboard("ordinary text", malformed)).toBeNull();
  expect(selectedBlocksFromClipboard("other", malformed)).toBeNull();
});
