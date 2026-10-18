import type { Block, Inline } from "../../../packages/document-schema/index";
import { fromMarkdown } from "../../../packages/markdown/convert";

/**
 * Plain text → blocks, line by line (paste engine v2).
 *
 * Every non-blank line becomes its own block (Markdown would join consecutive
 * lines into one paragraph, which is wrong for notes). Indentation (spaces or
 * tabs) becomes nesting. Markers become block types: "-", "*", "+", "•", "·",
 * "◦", "▪", "‣" → bullet; "1." / "1)" → numbered; "- [ ]" / "- [x]" → checklist;
 * "#".."###" → heading; ">" → quote. Fenced ``` blocks become code blocks and
 * Markdown tables become tables. Inline Markdown (**bold**, *italic*, `code`,
 * [link](url), ~~strike~~) is applied only when the line contains it.
 */

const BULLET = /^([-*+•·◦▪‣])\s+(.*)$/;
const TASK = /^[-*+]\s+\[( |x|X)\]\s+(.*)$/;
const NUMBER = /^(\d{1,9})[.)]\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^(```|~~~)\s*([\w+-]*)\s*$/;
const TABLE_ROW = /^\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const INLINE_MD =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|(^|[^\w*])\*[^*\s][^*\n]*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|~~[^~\n]+~~|https?:\/\/\S)/;

const id = () => crypto.randomUUID();

function textInline(text: string): Inline[] {
  return text ? [{ type: "text", text, styles: {} }] : [];
}

/** Inline content for one line: Markdown inline syntax when present. */
export function lineInline(text: string): Inline[] {
  if (!INLINE_MD.test(text)) return textInline(text);
  // escape block-level syntax so the line stays a single paragraph
  const safe = text.replace(/^(\s*)([#>]|[-*+]\s|\d+[.)]\s)/, "$1\\$2");
  const parsed = fromMarkdown(safe).blocks;
  if (
    parsed.length === 1 &&
    parsed[0].type === "paragraph" &&
    Array.isArray(parsed[0].content)
  )
    return parsed[0].content as Inline[];
  return textInline(text);
}

type Line = { indent: number; text: string; blank: boolean };

function measure(raw: string): Line {
  const expanded = raw.replace(/\t/g, "    ").replace(/\u00a0/g, " ");
  const text = expanded.trimStart();
  return {
    indent: expanded.length - text.length,
    text: text.trimEnd(),
    blank: text.trim() === "",
  };
}

/** The indentation step used in this text (2 or 4 spaces, or whatever is smallest). */
function indentUnit(lines: Line[]): number {
  const steps = new Set<number>();
  let previous = 0;
  for (const line of lines) {
    if (line.blank) continue;
    if (line.indent > previous) steps.add(line.indent - previous);
    previous = line.indent;
  }
  const smallest = Math.min(...[...steps].filter((n) => n > 0), 8);
  return Math.max(1, smallest);
}

function blockFor(text: string): Block {
  let m: RegExpExecArray | null;
  if ((m = TASK.exec(text)))
    return {
      id: id(),
      type: "checkListItem",
      props: { checked: m[1] !== " " },
      content: lineInline(m[2]),
      children: [],
    };
  if ((m = BULLET.exec(text)))
    return {
      id: id(),
      type: "bulletListItem",
      props: {},
      content: lineInline(m[2]),
      children: [],
    };
  if ((m = NUMBER.exec(text)))
    return {
      id: id(),
      type: "numberedListItem",
      props: {},
      content: lineInline(m[2]),
      children: [],
    };
  if ((m = HEADING.exec(text)))
    return {
      id: id(),
      type: "heading",
      props: { level: m[1].length },
      content: lineInline(m[2]),
      children: [],
    };
  if ((m = QUOTE.exec(text)))
    return {
      id: id(),
      type: "quote",
      props: {},
      content: lineInline(m[1]),
      children: [],
    };
  return {
    id: id(),
    type: "paragraph",
    props: {},
    content: lineInline(text),
    children: [],
  };
}

const emptyParagraph = (): Block => ({
  id: id(),
  type: "paragraph",
  props: {},
  content: [],
  children: [],
});

export function textToBlocks(text: string): Block[] {
  const raw = text.replace(/\r\n?/g, "\n").split("\n");
  while (raw.length && raw[raw.length - 1].trim() === "") raw.pop();
  while (raw.length && raw[0].trim() === "") raw.shift();
  if (raw.length > 10000)
    throw new Error(
      "Paste supports at most 10,000 lines. Paste smaller sections.",
    );
  const lines = raw.map(measure);
  const unit = indentUnit(lines);
  const baseline =
    Math.min(...lines.filter((l) => !l.blank).map((l) => l.indent), 0) || 0;

  // In Markdown, blank lines only separate blocks; in plain notes one is kept.
  const markdownish = lines.some(
    (l) =>
      !l.blank &&
      (HEADING.test(l.text) ||
        BULLET.test(l.text) ||
        NUMBER.test(l.text) ||
        FENCE.test(l.text) ||
        TASK.test(l.text)),
  );
  const roots: Block[] = [];
  // stack of [depth, block] for nesting
  const stack: { depth: number; block: Block }[] = [];
  const place = (block: Block, depth: number) => {
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack[stack.length - 1];
    // never skip a level: an over-indented line nests one level under its parent
    if (parent)
      parent.block.children = [...(parent.block.children ?? []), block];
    else roots.push(block);
    stack.push({ depth: parent ? parent.depth + 1 : 0, block });
  };
  let blankRun = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.blank) {
      blankRun++;
      continue;
    }
    const depth = Math.round(Math.max(0, line.indent - baseline) / unit);
    if (blankRun) {
      // one empty line marks a gap between top-level groups; ignored inside nesting
      if (depth === 0) {
        if (!markdownish) roots.push(emptyParagraph());
        stack.length = 0;
      }
      blankRun = 0;
    }
    const fence = FENCE.exec(line.text);
    if (fence) {
      const body: string[] = [];
      let j = i + 1;
      for (; j < raw.length && !FENCE.test(raw[j].trim()); j++)
        body.push(raw[j]);
      place(
        {
          id: id(),
          type: "codeBlock",
          props: { language: fence[2] || "text" },
          content: [{ type: "text", text: body.join("\n"), styles: {} }],
          children: [],
        },
        depth,
      );
      i = j;
      continue;
    }
    if (
      TABLE_ROW.test(line.text) &&
      i + 1 < lines.length &&
      TABLE_SEPARATOR.test(lines[i + 1].text)
    ) {
      const rows: string[] = [];
      let j = i;
      for (; j < lines.length && TABLE_ROW.test(lines[j].text); j++)
        rows.push(lines[j].text);
      const table = fromMarkdown(rows.join("\n")).blocks.find(
        (b) => b.type === "table",
      );
      if (table) {
        place({ ...table, children: [] }, depth);
        i = j - 1;
        continue;
      }
    }
    place(blockFor(line.text), depth);
  }
  return roots;
}
