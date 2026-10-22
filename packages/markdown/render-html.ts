import { markdownToConfluence } from "../confluence/convert";

/**
 * Markdown shown as HTML inside Lotion (issue descriptions and notes). It reuses
 * the static converter behind the Confluence export (GFM: headings, emphasis,
 * lists, task lists, tables, code, quotes, links, autolinks), which escapes raw
 * HTML and turns unsafe link protocols into "#". Web links open in a new tab.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  return markdownToConfluence(markdown).html.replace(
    /<a href="(https?:[^"]*)"/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer"',
  );
}
