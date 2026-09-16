import type { editorSchema } from "./editor-schema";

/** Concrete BlockNote editor with Lotion's custom block schema. */
export type LotionEditor = typeof editorSchema.BlockNoteEditor;
