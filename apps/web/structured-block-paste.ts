import type { Block, Inline } from "../../packages/document-schema/index";
import { fromMarkdown } from "../../packages/markdown/convert";

const headingLine = /^ {0,3}#{1,6}[\t ]+\S/;
const listLine = /^[\t ]*(?:[-+*]|\d+[.)])[\t ]+(?:\[[ xX]\][\t ]+)?\S/;
const enhancedTypes = new Set([
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
]);

function plainInline(content: Block["content"]): boolean {
  return (
    Array.isArray(content) &&
    content.every(
      (item: Inline) =>
        item.type === "text" && Object.keys(item.styles ?? {}).length === 0,
    )
  );
}

function enhancedBlock(block: Block): boolean {
  return (
    enhancedTypes.has(block.type) &&
    plainInline(block.content) &&
    (block.children ?? []).every(enhancedBlock)
  );
}

/**
 * Recognize a multi-block plain-text outline without treating arbitrary
 * Markdown-looking prose as formatted clipboard input.
 */
export function structuredBlocksFromClipboard(text: string): Block[] | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.at(-1) === "") lines.pop();
  const structural = lines.filter((line) => line.trim().length > 0);
  if (
    structural.length < 1 ||
    structural.length > 10000 ||
    structural.some((line) => !headingLine.test(line) && !listLine.test(line))
  )
    return null;
  const parsed = fromMarkdown(lines.join("\n"));
  if (parsed.warnings.length || !parsed.blocks.every(enhancedBlock))
    return null;
  return parsed.blocks;
}
