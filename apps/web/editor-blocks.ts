import type { Block } from "../../packages/document-schema/index";
import type { editorSchema } from "./editor-schema";

/**
 * Between Lotion's saved blocks (`packages/document-schema`) and the editor's
 * (BlockNote with `editorSchema`).
 *
 * Both are the same JSON: Lotion validates and stores exactly what the editor
 * produces (`contentSchema`), and loads it back as the editor's content. The
 * two TypeScript types are written separately, though — BlockNote's are
 * generic over the schema — so they cannot be assigned to each other. This
 * module is the one place that converts between them; elsewhere, use these
 * helpers instead of `as unknown as` / `as any` casts.
 */

export type LotionEditor = typeof editorSchema.BlockNoteEditor;
/** Blocks as the editor accepts them (insert, replace, update). */
export type EditorBlocks = Parameters<LotionEditor["replaceBlocks"]>[1];
export type EditorBlock = EditorBlocks[number];

type HasDocument = { readonly document: unknown };

/** The editor's current document as Lotion blocks. */
export function documentBlocks(editor: HasDocument): Block[] {
  return editor.document as Block[];
}

/** Lotion blocks in the form the editor accepts. */
export function toEditorBlocks(blocks: readonly Block[]): EditorBlocks {
  return blocks as unknown as EditorBlocks;
}

export function toEditorBlock(block: Block): EditorBlock {
  return block as unknown as EditorBlock;
}

/** A Lotion block as the editor reads it back (`getBlock`, selections…). */
export function fromEditorBlock(block: unknown): Block {
  return block as Block;
}

/** An empty paragraph: what a document holds when every block is removed. */
export const EMPTY_DOCUMENT: readonly Block[] = Object.freeze([
  { type: "paragraph" } as Block,
]);

/**
 * Replace the whole document with `blocks` (one empty paragraph when there
 * are none: the editor always keeps a block to type in).
 */
export function replaceDocument(
  editor: Pick<LotionEditor, "document" | "replaceBlocks">,
  blocks: readonly Block[],
): void {
  editor.replaceBlocks(
    editor.document,
    toEditorBlocks(blocks.length ? blocks : EMPTY_DOCUMENT),
  );
}
