import { expect, it } from "vitest";
import { fromMarkdown, toMarkdown } from "../../packages/markdown/convert";
it("imports legacy TOC markers and exports Lotion markers", () => {
  const parsed = fromMarkdown("<!-- yestion:table-of-contents -->");
  expect(parsed.blocks[0].type).toBe("tableOfContents");
  expect(toMarkdown(parsed.blocks).markdown).toContain("<!-- lotion:table-of-contents -->");
});
function semantic(value: any): any {
  if (Array.isArray(value)) return value.map(semantic);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== "id")
        .map(([k, v]) => [k, semantic(v)]),
    );
  return value;
}
it.each([
  "```mermaid\ngraph TD\n  A[Start] --> B[Finish]\n```\n",
  "> Quoted text\n>\n> - Nested list\n> - More\n",
  "# Heading\n\nHello **bold** and *italic* [link](https://example.com).\n",
  "- Parent\n  - Child\n- Another\n",
  "- [x] Done\n- [ ] Next\n",
  "```ts\nconst a = 1;\n```\n",
  "| A | B |\n| - | - |\n| 한글 | 🙂 |\n",
  "![Diagram](assets/test.png)\n",
])("round-trips supported Markdown: %s", (source) => {
  const first = fromMarkdown(source);
  expect(
    semantic(fromMarkdown(toMarkdown(first.blocks).markdown).blocks),
  ).toEqual(semantic(first.blocks));
});
it("preserves unsupported raw HTML as inert text with a warning", () => {
  const result = fromMarkdown("<script>alert(1)</script>");
  expect(result.warnings.length).toBeGreaterThan(0);
  expect(JSON.stringify(result.blocks)).toContain("<script>");
});
it("preserves mixed text/image/text order", () =>
  expect(
    fromMarkdown("before ![x](a.png) after").blocks.map((b) => b.type),
  ).toEqual(["paragraph", "image", "paragraph"]));
