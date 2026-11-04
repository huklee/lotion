import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_DOCUMENT,
  documentBlocks,
  fromEditorBlock,
  replaceDocument,
  toEditorBlock,
  toEditorBlocks,
} from "../../apps/web/editor-blocks";
import type { Block } from "../../packages/document-schema/index";

const para = (id: string, text: string): Block => ({
  id,
  type: "paragraph",
  props: {},
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

function fakeEditor(document: Block[]) {
  return {
    document,
    replaceBlocks: vi.fn((_old: unknown, next: unknown) => next),
  };
}

describe("editor blocks adapter", () => {
  it("reads and passes blocks through unchanged (same JSON on both sides)", () => {
    const doc = [para("a", "one"), para("b", "two")];
    const editor = fakeEditor(doc);
    expect(documentBlocks(editor)).toBe(doc);
    expect(toEditorBlocks(doc)).toBe(doc);
    expect(toEditorBlock(doc[0])).toBe(doc[0]);
    expect(fromEditorBlock(doc[1])).toBe(doc[1]);
  });

  it("replaces the whole document", () => {
    const editor = fakeEditor([para("a", "old")]);
    const next = [para("b", "new"), para("c", "newer")];
    replaceDocument(editor as never, next);
    expect(editor.replaceBlocks).toHaveBeenCalledWith(editor.document, next);
  });

  it("keeps one empty paragraph when every block is removed", () => {
    const editor = fakeEditor([para("a", "old")]);
    replaceDocument(editor as never, []);
    const [, blocks] = editor.replaceBlocks.mock.calls[0];
    expect(blocks).toEqual([{ type: "paragraph" }]);
    // the shared empty document is never changed by callers
    expect(Object.isFrozen(EMPTY_DOCUMENT)).toBe(true);
  });
});
