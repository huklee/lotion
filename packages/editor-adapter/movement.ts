import type { Block } from "../document-schema/index";

export function removeBlocksPreservingHierarchy(
  blocks: Block[],
  selected: readonly string[],
): Block[] {
  const ids = new Set(selected);
  const remove = (items: Block[]): Block[] => {
    let changed = false;
    const result: Block[] = [];
    for (const block of items) {
      const originalChildren = block.children ?? [];
      const children = remove(originalChildren);
      if (ids.has(block.id)) {
        // Only the selected block goes; its unselected children move up into
        // its place (selected descendants are removed with it).
        changed = true;
        result.push(...children);
        continue;
      }
      if (children !== originalChildren) {
        changed = true;
        result.push({ ...block, children });
      } else result.push(block);
    }
    return changed ? result : items;
  };
  return remove(blocks);
}

/** `selected` plus every descendant of those blocks, in document order. */
export function withDescendants(
  blocks: Block[],
  selected: readonly string[],
): string[] {
  const ids = new Set(selected);
  const out: string[] = [];
  const walk = (items: Block[], inside: boolean) => {
    for (const block of items) {
      const hit = inside || ids.has(block.id);
      if (hit) out.push(block.id);
      walk(block.children ?? [], hit);
    }
  };
  walk(blocks, false);
  return out;
}

export function selectedBlockSubtrees(
  blocks: Block[],
  selected: readonly string[],
): Block[] {
  const ids = new Set(selected);
  const collect = (items: Block[]): Block[] =>
    items.flatMap((block) =>
      ids.has(block.id) ? [block] : collect(block.children ?? []),
    );
  return collect(blocks);
}

export function sectionIds(blocks: Block[], id: string): string[] {
  const index = blocks.findIndex((b) => b.id === id);
  if (index < 0) {
    for (const block of blocks) {
      const found = sectionIds(block.children ?? [], id);
      if (found.length) return found;
    }
    return [];
  }
  const first = blocks[index];
  if (first.type !== "heading") return [id];
  const level = Number(first.props?.level ?? 1);
  const result = [id];
  for (let i = index + 1; i < blocks.length; i++) {
    if (
      blocks[i].type === "heading" &&
      Number(blocks[i].props?.level ?? 1) <= level
    )
      break;
    result.push(blocks[i].id);
  }
  return result;
}
export function moveBlocks(
  blocks: Block[],
  selected: string[],
  target: string,
  side: "before" | "after",
): Block[] {
  const ids = new Set(selected),
    moving: Block[] = [];
  let invalid = false;
  function contains(block: Block, id: string): boolean {
    return (
      block.id === id || (block.children ?? []).some((b) => contains(b, id))
    );
  }
  function collect(items: Block[]): Block[] {
    return items.flatMap((b) => {
      if (ids.has(b.id)) {
        moving.push(b);
        if (contains(b, target)) invalid = true;
        return [];
      }
      return [{ ...b, children: collect(b.children ?? []) }];
    });
  }
  const remaining = collect(blocks);
  if (invalid || !moving.length) return blocks;
  let inserted = false;
  function insert(items: Block[]): Block[] {
    return items.flatMap((b) => {
      if (b.id === target) {
        inserted = true;
        return side === "before" ? [...moving, b] : [b, ...moving];
      }
      return [{ ...b, children: insert(b.children ?? []) }];
    });
  }
  const result = insert(remaining);
  return inserted ? result : blocks;
}
