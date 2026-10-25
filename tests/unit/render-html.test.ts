import { expect, it } from "vitest";
import {
  markdownToHtml,
  toggleTask,
} from "../../packages/markdown/render-html";

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
  expect(html).toContain(
    '<li class="task-item"><input type="checkbox" disabled /> <span class="task-text">open task</span></li>',
  );
  expect(html).toContain(
    '<li class="task-item checked"><input type="checkbox" disabled checked /> <span class="task-text">done task</span></li>',
  );
  expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
  expect(html).toContain("const a = 1 &lt; 2;");
  expect(html).not.toContain("<script");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("javascript:");
  expect(markdownToHtml("  ")).toBe("");
});

it("numbers interactive task boxes and toggles the right marker in the source", () => {
  const source = [
    "Intro with [ ] that is not a task",
    "",
    "- [ ] first",
    "  - [x] nested **done**",
    "    more text",
    "- plain item",
    "",
    "1. [ ] numbered",
    "",
    "* [X] star",
  ].join("\n");
  const html = markdownToHtml(source, { interactiveTasks: true });
  expect(html).toContain(
    '<input type="checkbox" data-task="0" aria-label="Done" />',
  );
  expect(html).toContain(
    '<li class="task-item checked"><input type="checkbox" data-task="1" checked aria-label="Done" /> <span class="task-text">nested <strong>done</strong>',
  );
  expect(html).toContain('data-task="2"');
  expect(html).toContain('data-task="3" checked');
  expect(html).not.toContain("disabled");
  // the first item's text stays outside its nested list
  expect(html).toMatch(/<span class="task-text">first<\/span><ul/);

  let next = toggleTask(source, 0);
  expect(next.split("\n")[2]).toBe("- [x] first");
  next = toggleTask(next, 1);
  expect(next.split("\n")[3]).toBe("  - [ ] nested **done**");
  next = toggleTask(next, 2);
  expect(next.split("\n")[7]).toBe("1. [x] numbered");
  next = toggleTask(next, 3);
  expect(next.split("\n")[9]).toBe("* [ ] star");
  // everything else is untouched
  expect(next.split("\n")[0]).toBe("Intro with [ ] that is not a task");
  expect(toggleTask(source, 9)).toBe(source);
  expect(toggleTask(source, 0, false)).toBe(source);
});
