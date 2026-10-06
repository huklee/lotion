import type { Block } from "../document-schema/index";
import { selectedBlockSubtrees } from "./movement";

/** Checklist items inside the selected blocks, nested children included, in document order. */
export function checklistIdsInSubtrees(
  blocks: Block[],
  selected: readonly string[],
): string[] {
  const ids: string[] = [];
  const walk = (items: Block[]) =>
    items.forEach((block) => {
      if (block.type === "checkListItem") ids.push(block.id);
      walk(block.children ?? []);
    });
  walk(selectedBlockSubtrees(blocks, selected));
  return ids;
}

/**
 * Target state of a bulk Cmd/Ctrl+Enter: check every item unless all of them are
 * already checked, in which case uncheck them all (a single item simply toggles).
 */
export function bulkCheckedValue(
  items: readonly { props?: Record<string, unknown> }[],
): boolean {
  return items.some((item) => item.props?.checked !== true);
}

/**
 * Whether a text selection [from, to] covers a block's inline content
 * [contentStart, contentEnd]. Touching only an edge (a selection ending right at
 * the start of the next block) does not count; an empty block counts when it lies
 * inside the selection.
 */
export function selectionCoversContent(
  from: number,
  to: number,
  contentStart: number,
  contentEnd: number,
): boolean {
  if (contentStart === contentEnd)
    return from <= contentStart && contentEnd <= to;
  return contentStart < to && contentEnd > from;
}
