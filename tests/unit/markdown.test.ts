import { expect, it } from "vitest";
import { fromMarkdown, toMarkdown } from "../../packages/markdown/convert";
it("imports legacy TOC markers and exports Lotion markers", () => {
  const parsed = fromMarkdown("<!-- yestion:table-of-contents -->");
  expect(parsed.blocks[0].type).toBe("tableOfContents");
  expect(toMarkdown(parsed.blocks).markdown).toContain(
    "<!-- lotion:table-of-contents -->",
  );
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
  "| A | B |\n| - | - |\n| English | 🙂 |\n",
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

it("exports whitespace-only editor blocks as blank Markdown without HTML space entities", () => {
  const result = toMarkdown([
    {
      id: "before",
      type: "paragraph",
      content: [{ type: "text", text: "Before", styles: {} }],
    },
    {
      id: "blank",
      type: "paragraph",
      content: [{ type: "text", text: "   ", styles: {} }],
    },
    {
      id: "after",
      type: "paragraph",
      content: [{ type: "text", text: "After", styles: {} }],
    },
  ]);
  expect(result.markdown).not.toContain("&#x20;");
  expect(result.markdown).toBe("Before\n\n\n\nAfter\n");
});

it("exports link mentions and degrades date mentions to portable text", () => {
  const fileHref = `/api/assets/${"a".repeat(64)}.bin`;
  const result = toMarkdown([
    {
      id: "mentions",
      type: "paragraph",
      content: [
        {
          type: "mention",
          props: {
            kind: "page",
            href: "#/page/target",
            label: "Target page",
            icon: "🧭",
          },
        },
        { type: "text", text: " and ", styles: {} },
        {
          type: "mention",
          props: {
            kind: "external",
            href: "https://example.com/article",
            label: "External article",
            icon: "🌐",
          },
        },
        { type: "text", text: " with ", styles: {} },
        {
          type: "mention",
          props: {
            kind: "file",
            href: fileHref,
            label: "brief.txt",
            icon: "📎",
          },
        },
        { type: "text", text: " on ", styles: {} },
        {
          type: "mention",
          props: {
            kind: "date",
            href: "",
            label: "2026-09-17",
            icon: "📅",
            value: "2026-09-17",
          },
        },
      ],
    },
  ]);

  expect(result.markdown).toContain("[🧭 Target page](#/page/target)");
  expect(result.markdown).toContain(
    "[🌐 External article](https://example.com/article)",
  );
  expect(result.markdown).toContain(`[📎 brief.txt](${fileHref})`);
  expect(result.markdown).toContain("📅 2026-09-17");
  expect(result.markdown).not.toContain("[]()");
});

it("exports a typed database as a static portable table with row links", () => {
  const result = toMarkdown([
    {
      id: "database",
      type: "database",
      props: {
        columns: JSON.stringify([
          { id: "status", name: "Status", type: "select", options: ["Open"] },
          { id: "done", name: "Done", type: "checkbox" },
          { id: "estimate", name: "Estimate", type: "number" },
        ]),
        rows: JSON.stringify([
          {
            id: "row-1",
            href: "#/page/row-page",
            title: "Release row",
            values: { status: "Open", done: true, estimate: 5 },
          },
        ]),
      },
    },
  ]);
  expect(result.markdown).toContain("| Page");
  expect(result.markdown).toContain("[Release row](#/page/row-page)");
  expect(result.markdown).toContain("Open");
  expect(result.markdown).toContain("Yes");
  expect(result.warnings).toContain(
    "Portable Markdown renders a database as a static table; exact bundles preserve typed properties and row-page behavior.",
  );
});
