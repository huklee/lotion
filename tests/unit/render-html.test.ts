import { expect, it } from "vitest";
import { markdownToHtml } from "../../packages/markdown/render-html";

it("renders GFM safely for issue descriptions", () => {
  const html = markdownToHtml(
    [
      "# Plan",
      "**bold**, _em_, `code` and [site](https://example.com) or [page](#/page/abc)",
      "",
      "- [ ] open task",
      "- [x] done task",
      "",
      "1. first",
      "2. second",
      "",
      "```js",
      "const a = 1 < 2;",
      "```",
      "",
      "<script>alert(1)</script>",
      "[bad](javascript:alert(1))",
    ].join("\n"),
  );
  expect(html).toContain("<h1>Plan</h1>");
  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain("<em>em</em>");
  expect(html).toContain("<code>code</code>");
  expect(html).toContain(
    '<a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a>',
  );
  expect(html).toContain('<a href="#/page/abc">page</a>');
  expect(html).toContain('<input type="checkbox" disabled /> open task');
  expect(html).toContain(
    '<input type="checkbox" disabled checked /> done task',
  );
  expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
  expect(html).toContain("const a = 1 &lt; 2;");
  expect(html).not.toContain("<script");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("javascript:");
  expect(markdownToHtml("  ")).toBe("");
});
