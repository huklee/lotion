import { blockToNode } from "@blocknote/core";
import type { Block } from "../../../packages/document-schema/index";
import { contentSchema } from "../../../packages/document-schema/index";
import { selectedBlocksFromClipboard } from "../selected-block-clipboard";
import { cleanClipboardHtml, isSemanticHtml } from "./html-clean";
import { textToBlocks } from "./text-blocks";

/**
 * Paste engine v2: choose the richest clipboard flavour, turn it into blocks, and
 * insert them where the cursor is.
 *
 * Source order: Lotion's own copy → HTML with structure (Notion, Google Docs,
 * Word, Slack, web, AI chat) → plain text (Markdown or indented notes).
 * Placement: one plain line goes inline (keeping links and bold); on an empty line
 * the paste replaces it; in the middle of a line the line is split around the
 * paste; pasted plain lines inside a list take that list's type; code blocks and
 * table cells receive plain text.
 */

export type PasteSource = "lotion" | "html" | "text";
export type PasteResult = { source: PasteSource; blocks: number } | null;

const LIST_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);

function isEmptyInline(block: any) {
  return !Array.isArray(block.content) || block.content.length === 0;
}

/** Drop leading/trailing empty paragraphs and collapse runs of them. */
export function tidyBlocks(blocks: any[]): any[] {
  const out: any[] = [];
  for (const block of blocks) {
    const empty =
      block.type === "paragraph" &&
      isEmptyInline(block) &&
      !(block.children ?? []).length;
    if (empty && (!out.length || out[out.length - 1].__empty)) continue;
    const next = { ...block, children: tidyBlocks(block.children ?? []) };
    if (empty) Object.defineProperty(next, "__empty", { value: true });
    out.push(next);
  }
  while (out.length && out[out.length - 1].__empty) out.pop();
  return out;
}

function asListType(blocks: any[], type: string): any[] {
  return blocks.map((b) => ({
    ...b,
    type: b.type === "paragraph" ? type : b.type,
    props:
      b.type === "paragraph" && type === "checkListItem"
        ? { checked: false }
        : b.props,
    children: asListType(b.children ?? [], type),
  }));
}

const LANGUAGES: Record<string, string> = {
  json: "json",
  html: "html",
  xml: "html",
  python: "python",
  py: "python",
  go: "go",
  golang: "go",
  cpp: "cpp",
  "c++": "cpp",
  c: "cpp",
};

/** Code languages the editor supports; anything else becomes plain text. */
function supportedCode(blocks: any[]): any[] {
  return blocks.map((b) => ({
    ...b,
    ...(b.type === "codeBlock"
      ? {
          props: {
            ...b.props,
            language: LANGUAGES[String(b.props?.language ?? "").toLowerCase()] ?? "text",
          },
        }
      : {}),
    children: supportedCode(b.children ?? []),
  }));
}

function lastDeep(block: any): any {
  let current = block;
  while (current.children?.length)
    current = current.children[current.children.length - 1];
  return current;
}

/** Blocks for this clipboard (no editor changes). */
export function clipboardBlocks(
  editor: any,
  data: { html: string; text: string },
): { source: PasteSource; blocks: any[] } | null {
  const internal = selectedBlocksFromClipboard(data.text);
  if (internal) return { source: "lotion", blocks: internal };
  if (isSemanticHtml(data.html)) {
    const parsed = editor.tryParseHTMLToBlocks(
      cleanClipboardHtml(data.html),
    ) as any[];
    const blocks = tidyBlocks(parsed);
    if (blocks.length) return { source: "html", blocks };
  }
  if (!data.text) return null;
  return { source: "text", blocks: tidyBlocks(textToBlocks(data.text)) };
}

export function pasteV2(
  editor: any,
  data: { html: string; text: string },
  documentTitle: string,
): PasteResult {
  const result = clipboardBlocks(editor, data);
  if (!result || !result.blocks.length) return null;
  let blocks = supportedCode(result.blocks);
  const tiptap = editor._tiptapEditor;
  const current = editor.getTextCursorPosition().block;

  // code blocks and tables take text as text
  if (current.type === "codeBlock" || current.type === "table") {
    tiptap.commands.insertContentAt(
      { from: tiptap.state.selection.from, to: tiptap.state.selection.to },
      { type: "text", text: data.text },
      { applyPasteRules: false, applyInputRules: false },
    );
    return { source: "text", blocks: 1 };
  }

  if (
    LIST_TYPES.has(current.type) &&
    blocks.every((b) => b.type === "paragraph")
  )
    blocks = asListType(blocks, current.type);

  const checked = contentSchema.safeParse({
    title: documentTitle,
    blocks: [...editor.document, ...blocks],
  });
  if (!checked.success)
    throw new Error(
      "This paste exceeds the document's save limits. Paste a smaller section.",
    );

  // one line of text (with its links/bold): inline at the cursor
  const single = blocks.length === 1 && !(blocks[0].children ?? []).length;
  if (
    single &&
    (blocks[0].type === "paragraph" || blocks[0].type === current.type)
  ) {
    const node = blockToNode(
      blocks[0],
      tiptap.schema,
      editor.schema.styleSchema,
    );
    const inline = node.firstChild?.content.toJSON() ?? [];
    if (inline.length)
      tiptap.commands.insertContentAt(
        { from: tiptap.state.selection.from, to: tiptap.state.selection.to },
        inline,
        { applyPasteRules: false, applyInputRules: false },
      );
    return { source: result.source, blocks: 1 };
  }

  if (!tiptap.state.selection.empty) tiptap.commands.deleteSelection();
  let anchor = editor.getTextCursorPosition().block;
  const { $from } = tiptap.state.selection;
  const offset = $from.parentOffset;
  const length = $from.parent.content.size;
  let where: "replace" | "before" | "after" = "after";
  if (
    isEmptyInline(anchor) &&
    anchor.type === "paragraph" &&
    !(anchor.children ?? []).length
  )
    where = "replace";
  else if (offset === 0 && length > 0) where = "before";
  else if (offset < length) {
    // split the line (BlockNote's own Enter): the text after the cursor ends up
    // after the pasted blocks
    tiptap.commands.keyboardShortcut("Enter");
    anchor =
      editor.getPrevBlock(editor.getTextCursorPosition().block) ?? anchor;
  }
  editor.transact(() => {
    if (where === "replace") editor.replaceBlocks([anchor], blocks);
    else editor.insertBlocks(blocks, anchor, where);
  });
  try {
    const target = lastDeep(blocks[blocks.length - 1]);
    if (editor.getBlock(target.id))
      editor.setTextCursorPosition(target.id, "end");
  } catch {
    /* cursor placement is best effort */
  }
  return { source: result.source, blocks: blocks.length };
}

export type { Block };
