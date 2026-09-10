import type { Block } from "../document-schema/index";
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
