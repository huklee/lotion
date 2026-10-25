import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { markdownToConfluence } from "../confluence/convert";

/**
 * Markdown shown as HTML inside Lotion (issue descriptions and notes). It reuses
 * the static converter behind the Confluence export (GFM: headings, emphasis,
 * lists, task lists, tables, code, quotes, links, autolinks), which escapes raw
 * HTML and turns unsafe link protocols into "#". Web links open in a new tab.
 *
 * Task items get the class `task-item` (`checked` when done) and their own text
 * in `.task-text`, so a done item can be struck through without striking its
 * nested items. With `interactiveTasks` the checkboxes are enabled and carry
 * `data-task` (their order in the document) for `toggleTask`.
 */
export function markdownToHtml(
  markdown: string,
  options: { interactiveTasks?: boolean } = {},
): string {
  if (!markdown.trim()) return "";
  let task = 0;
  return markdownToConfluence(markdown)
    .html.replace(
      /<a href="(https?:[^"]*)"/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer"',
    )
    .replace(
      /<li><input type="checkbox" disabled( checked)? \/> ([\s\S]*?)(?=<ul|<ol|<\/li>|<p>|<div|<pre|<blockquote|<table|<h[1-6]|<hr)/g,
      (_all, checked: string | undefined, text: string) => {
        const done = !!checked;
        const box = options.interactiveTasks
          ? `<input type="checkbox" data-task="${task++}"${done ? " checked" : ""} aria-label="Done" />`
          : `<input type="checkbox" disabled${done ? " checked" : ""} />`;
        return `<li class="task-item${done ? " checked" : ""}">${box} <span class="task-text">${text}</span>`;
      },
    );
}

const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * Checks or unchecks the `index`-th task item (document order, as numbered by
 * `markdownToHtml`) by rewriting only its `[ ]` / `[x]` marker in the source.
 * Returns the text unchanged when there is no such item.
 */
export function toggleTask(
  markdown: string,
  index: number,
  checked?: boolean,
): string {
  const tasks: { offset: number; checked: boolean }[] = [];
  const walk = (node: any) => {
    if (node.type === "listItem" && typeof node.checked === "boolean")
      tasks.push({
        offset: node.position?.start?.offset ?? -1,
        checked: node.checked,
      });
    for (const child of node.children ?? []) walk(child);
  };
  walk(parser.parse(markdown));
  const target = tasks[index];
  if (!target || target.offset < 0) return markdown;
  const head = markdown.slice(target.offset);
  const marker = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)\[( |x|X)\]/.exec(head);
  if (!marker) return markdown;
  const next = checked ?? !target.checked;
  const at = target.offset + marker[1].length + 1;
  return markdown.slice(0, at) + (next ? "x" : " ") + markdown.slice(at + 1);
}
