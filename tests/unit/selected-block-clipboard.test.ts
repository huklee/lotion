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

it("restores custom and nested block payloads from session storage", () => {
  const persisted = memoryStorage();
  const blocks: Block[] = [
    {
      id: "source-callout",
      type: "callout",
      props: { type: "info" },
      content: [{ type: "text", text: "Callout", styles: { italic: true } }],
    },
    {
      id: "source-mermaid",
      type: "mermaid",
      props: { code: "graph TD; A --> B;" },
    },
    {
      id: "source-bullet",
      type: "bulletListItem",
      content: [{ type: "text", text: "Parent", styles: {} }],
      children: [
        {
          id: "source-child",
          type: "checkListItem",
          props: { checked: true },
          content: [{ type: "text", text: "Child", styles: {} }],
        },
      ],
    },
  ];
  rememberSelectedBlockClipboard("custom payload", blocks, persisted);
  // Replace the module's in-memory value to force the original payload to be
  // recovered from the supplied session store, as it would be after reload.
  rememberSelectedBlockClipboard("newer memory value", blocks, memoryStorage());

  const restored = selectedBlocksFromClipboard("custom payload", persisted);
  expect(restored?.map((block) => block.type)).toEqual([
    "callout",
    "mermaid",
    "bulletListItem",
  ]);
  expect(restored?.[1].props?.code).toBe("graph TD; A --> B;");
  expect(restored?.[2].children?.[0]).toMatchObject({
    type: "checkListItem",
    props: { checked: true },
  });
});

it("keeps the in-memory copy usable when session storage is unavailable", () => {
  const unavailable = {
    getItem: () => {
      throw new Error("Storage disabled");
    },
    setItem: () => {
      throw new Error("Storage disabled");
    },
  };
  const blocks: Block[] = [
    {
      id: "source-paragraph",
      type: "paragraph",
      content: [{ type: "text", text: "Available", styles: {} }],
    },
  ];
  rememberSelectedBlockClipboard("available", blocks, unavailable);
  expect(selectedBlocksFromClipboard("available", unavailable)?.[0].type).toBe(
    "paragraph",
  );
});
