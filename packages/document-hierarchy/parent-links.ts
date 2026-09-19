import type { Block, Document } from "../document-schema/index";

const PREFIX = "child-page-link-";

export function parentLinkBlockId(childId: string) {
  return `${PREFIX}${childId}`;
}

export function parentLinkBlock(
  child: Pick<Document, "id" | "title" | "icon">,
): Block {
  return {
    id: parentLinkBlockId(child.id),
    type: "paragraph",
    content: [
      {
        type: "link",
        href: `#/page/${child.id}`,
        content: [
          {
            type: "text",
            text: `${child.icon || "📄"} ${child.title || "Untitled"}`,
            styles: {},
          },
        ],
      },
    ],
  };
}

export function ensureParentLink(
  blocks: Block[],
  child: Pick<Document, "id" | "title" | "icon">,
): Block[] {
  const id = parentLinkBlockId(child.id);
  const replacement = parentLinkBlock(child);
  let found = false;
  let changed = false;

  function visit(items: Block[]): Block[] {
    return items
      .map((block) => {
        if (block.id === id) {
          if (!found) {
            found = true;
            if (JSON.stringify(block) === JSON.stringify(replacement))
              return block;
            changed = true;
            return replacement;
          }
          changed = true;
          return null;
        }
        const children = block.children ?? [];
        const nextChildren = visit(children).filter(
          (item): item is Block => !!item,
        );
        if (nextChildren !== children && changed)
          return { ...block, children: nextChildren };
        return block;
      })
      .filter((item): item is Block => !!item);
  }

  const visited = visit(blocks);
  if (!found) return [...blocks, replacement];
  return changed ? visited : blocks;
}

export function removeParentLink(blocks: Block[], childId: string): Block[] {
  const id = parentLinkBlockId(childId);
  let changed = false;
  function visit(items: Block[]): Block[] {
    const result: Block[] = [];
    for (const block of items) {
      if (block.id === id) {
        changed = true;
        continue;
      }
      const children = block.children ?? [];
      const nextChildren = visit(children);
      result.push(
        nextChildren === children
          ? block
          : { ...block, children: nextChildren },
      );
    }
    return changed ? result : items;
  }
  return visit(blocks);
}
