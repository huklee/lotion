import { expect, it } from "vitest";
import { mermaidFromClipboard } from "../../apps/web/mermaid-paste";

it("unwraps complete Mermaid fences while preserving source indentation", () => {
  expect(mermaidFromClipboard("```mermaid\ngraph TD;\n    A --> B;\n```")).toBe(
    "graph TD;\n    A --> B;",
  );
  expect(
    mermaidFromClipboard("\r\n~~~mermaid\r\ngraph TD\r\n A-->B\r\n~~~\r\n"),
  ).toBe("graph TD\n A-->B");
});

it("leaves ordinary text, other languages, partial and mixed Markdown alone", () => {
  for (const text of [
    "graph TD; A-->B;",
    "```js\nhello\n```",
    "```mermaid\nA-->B",
    "```mermaid\n\n```",
    "before\n```mermaid\nA-->B\n```",
    "```mermaid\nA-->B\n```\n\n```mermaid\nB-->C\n```",
  ])
    expect(mermaidFromClipboard(text)).toBeNull();
});
