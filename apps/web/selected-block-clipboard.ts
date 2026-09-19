import {
  contentSchema,
  type Block,
} from "../../packages/document-schema/index";

const storageKey = "lotion.selected-block-clipboard.v1";
const maximumPayloadLength = 5_000_000;

type ClipboardPayload = {
  markdown: string;
  blocks: Block[];
};

type ClipboardStorage = Pick<Storage, "getItem" | "setItem">;

let rememberedPayload: ClipboardPayload | null = null;

function availableStorage(): ClipboardStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function validPayload(value: unknown): value is ClipboardPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ClipboardPayload>;
  return (
    typeof payload.markdown === "string" &&
    payload.markdown.length <= maximumPayloadLength &&
    Array.isArray(payload.blocks) &&
    contentSchema.safeParse({ title: "Clipboard", blocks: payload.blocks })
      .success
  );
}

function freshBlock(block: Block): Block {
  return {
    ...structuredClone(block),
    id: crypto.randomUUID(),
    children: block.children?.map(freshBlock),
  };
}

/**
 * Remember the exact validated block structure behind the latest toolbar copy.
 * Plain-text Markdown remains the interoperable system clipboard representation.
 */
export function rememberSelectedBlockClipboard(
  markdown: string,
  blocks: Block[],
  storage: ClipboardStorage | null = availableStorage(),
): void {
  const payload = { markdown, blocks: structuredClone(blocks) };
  if (!validPayload(payload)) return;
  rememberedPayload = payload;
  try {
    storage?.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // The in-memory session remains available when storage is disabled or full.
  }
}

/**
 * Restore only an exact match for Lotion's latest selected-block copy. This
 * keeps arbitrary Markdown paste literal while retaining block types and styles
 * for an internal copy/paste, including after an in-tab reload.
 */
export function selectedBlocksFromClipboard(
  markdown: string,
  storage: ClipboardStorage | null = availableStorage(),
): Block[] | null {
  let payload = rememberedPayload;
  if (payload?.markdown !== markdown) {
    try {
      const serialized = storage?.getItem(storageKey);
      const parsed = serialized ? JSON.parse(serialized) : null;
      payload = validPayload(parsed) ? parsed : null;
    } catch {
      payload = null;
    }
  }
  if (!payload || payload.markdown !== markdown || !validPayload(payload))
    return null;
  const blocks = payload.blocks.map(freshBlock);
  return contentSchema.safeParse({ title: "Clipboard", blocks }).success
    ? blocks
    : null;
}
