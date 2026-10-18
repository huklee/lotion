/**
 * Backspace at the start of a paragraph, Notion-style.
 *
 * BlockNote "lifts" an indented block out of its parent on Backspace at its start;
 * ProseMirror's lift then makes the following siblings children of the lifted
 * block, so the next line's indent jumps. It also drops a merged block's children
 * to the top level. Here instead:
 *   - an empty line is deleted and the cursor goes to the end of the line above;
 *   - a line with text is merged into the line above (the previous sibling's last
 *     visible line, or the parent when it is a first child), and its nested blocks
 *     move under that line.
 * Lists keep BlockNote's first step (the item turns into a paragraph).
 */
type AnyBlock = {
  id: string;
  type: string;
  content?: unknown;
  children?: AnyBlock[];
};

const INLINE_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
]);

function lastVisible(block: AnyBlock): AnyBlock {
  let current = block;
  while (current.children?.length)
    current = current.children[current.children.length - 1];
  return current;
}

function inlineLength(content: unknown): number {
  if (!Array.isArray(content)) return 0;
  return content.reduce((n: number, item: any) => {
    if (item?.type === "text") return n + String(item.text ?? "").length;
    if (item?.type === "link") return n + inlineLength(item.content);
    return n + 1; // mentions and other inline nodes are one position
  }, 0);
}

/** Returns true when it handled the key (caller prevents the default). */
export function handleBackspace(editor: any): boolean {
  const view = editor._tiptapEditor?.view;
  const selection = view?.state.selection;
  if (!selection?.empty || selection.$from.parentOffset !== 0) return false;
  let block: AnyBlock;
  try {
    block = editor.getTextCursorPosition().block;
  } catch {
    return false;
  }
  if (block.type !== "paragraph") return false;
  const prev: AnyBlock | undefined = editor.getPrevBlock(block);
  const parent: AnyBlock | undefined = editor.getParentBlock(block);
  const target = prev ? lastVisible(prev) : parent;
  if (
    !target ||
    !INLINE_TYPES.has(target.type) ||
    !Array.isArray(target.content)
  )
    return false;
  // nothing nested and not indented: BlockNote's own merge is already right
  if (!parent && !block.children?.length) return false;

  const empty = !Array.isArray(block.content) || block.content.length === 0;
  const children = block.children ?? [];
  const junction = inlineLength(target.content);
  editor.transact(() => {
    if (empty) {
      // children stay where they were by joining the line above
      if (children.length)
        editor.updateBlock(target, {
          children: [...(target.children ?? []), ...children],
        });
      editor.removeBlocks([block]);
    } else {
      editor.updateBlock(target, {
        content: [
          ...(target.content as unknown[]),
          ...(block.content as unknown[]),
        ],
        children: [...(target.children ?? []), ...children],
      });
      editor.removeBlocks([block]);
    }
  });
  try {
    editor.setTextCursorPosition(target.id, "end");
    const after = editor._tiptapEditor.view.state.selection.from;
    const moved = inlineLength(editor.getBlock(target.id)?.content) - junction;
    editor._tiptapEditor.commands.setTextSelection(after - moved);
  } catch {
    /* cursor placement is best effort */
  }
  return true;
}
