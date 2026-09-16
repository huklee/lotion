import { expect, it } from "vitest";
import type { Content } from "../../packages/document-schema/index";
import { normalizeEditorContent } from "../../apps/web/normalize-editor-content";

it.each([
  ["legacy", "<main>Hello</main>", "html"],
  ["c++", "#include <vector>\nstd::vector<int> values;", "cpp"],
  ["golang", "package main\nfunc main() {}", "go"],
  ["py", "def greet():\n  print('hi')", "python"],
  ["javascript", "const value = 1", "json"],
])(
  "normalizes unsupported %s code containing %s to %s",
  (language, source, expected) => {
    const initial: Content = {
      title: "Code",
      blocks: [
        {
          id: "code",
          type: "codeBlock",
          props: { language },
          content: [{ type: "text", text: source, styles: {} }],
        },
      ],
    };
    const result = normalizeEditorContent(initial);
    expect(result.changed).toBe(true);
    expect(result.content.blocks[0].props?.language).toBe(expected);
  },
);

it("keeps supported code languages and normalizes nested legacy blocks", () => {
  const initial: Content = {
    title: "Nested",
    blocks: [
      {
        id: "parent",
        type: "paragraph",
        children: [
          {
            id: "supported",
            type: "codeBlock",
            props: { language: "go" },
          },
          {
            id: "legacy",
            type: "codeBlock",
            props: { language: "text" },
            content: [{ type: "text", text: "print('hello')", styles: {} }],
          },
        ],
      },
    ],
  };
  const result = normalizeEditorContent(initial);
  expect(result.content.blocks[0].children?.[0]).toBe(
    initial.blocks[0].children?.[0],
  );
  expect(result.content.blocks[0].children?.[1].props?.language).toBe("python");
});
