import type { Block } from "../document-schema/index";
import { joinBlocks, renderWikiMarkup, type WikiOptions } from "./wiki-markup";

/**
 * A whole Lotion page as a Confluence wiki page (wiki markup), with simple
 * layout edits: runs of top-level blocks can be wrapped in an Expand or a
 * panel macro (Info, Note, Warning, Tip, Panel). Fixed rules only, no AI.
 *
 * Each top-level block (with its nested blocks) is one unit. The view shows
 * each unit rendered from its own markup, so what you see is what the markup
 * says.
 */

export const WRAP_KINDS = [
  "expand",
  "info",
  "note",
  "warning",
  "tip",
  "panel",
] as const;
export type WrapKind = (typeof WRAP_KINDS)[number];

export const WRAP_LABELS: Record<WrapKind, string> = {
  expand: "Expand",
  info: "Info",
  note: "Note",
  warning: "Warning",
  tip: "Tip",
  panel: "Panel",
};

/** Confluence's own default title for an Expand macro. */
export const DEFAULT_EXPAND_TITLE = "Click here to expand...";

export type Wrap = {
  id: string;
  kind: WrapKind;
  title: string;
  /** Consecutive top-level block ids, in page order. */
  blockIds: string[];
};

export type WikiUnit = { id: string; markup: string; html: string };

/** One piece of the page: a plain unit or a wrap of units. */
export type WikiPart =
  | { type: "unit"; unit: WikiUnit }
  | { type: "wrap"; wrap: Wrap; units: WikiUnit[] };

export type WikiPage = {
  /** The page in Confluence wiki markup. */
  markup: string;
  /** The page as parts, for the interactive view. */
  parts: WikiPart[];
};

function plainText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((n: any) =>
      typeof n?.text === "string"
        ? n.text
        : Array.isArray(n?.content)
          ? plainText(n.content)
          : (n?.props?.label ?? ""),
    )
    .join("");
}

/** The default title for a new wrap: an Expand over a heading takes its text. */
export function defaultTitle(kind: WrapKind, first: Block | undefined): string {
  if (kind !== "expand") return "";
  if (first?.type === "heading") return plainText(first.content).trim();
  return DEFAULT_EXPAND_TITLE;
}

/** Wraps that still fit the page: known blocks, consecutive, no overlap. */
export function validWraps(blocks: Block[], wraps: Wrap[]): Wrap[] {
  const index = new Map(blocks.map((b, i) => [b.id, i]));
  const used = new Set<string>();
  const out: Wrap[] = [];
  for (const wrap of wraps) {
    if (!WRAP_KINDS.includes(wrap?.kind) || !wrap.blockIds?.length) continue;
    const positions = wrap.blockIds.map((id) => index.get(id));
    if (positions.some((p) => p === undefined)) continue;
    const sorted = (positions as number[]).slice().sort((a, b) => a - b);
    const consecutive = sorted.every(
      (p, i) => i === 0 || p === sorted[i - 1] + 1,
    );
    if (!consecutive || wrap.blockIds.some((id) => used.has(id))) continue;
    wrap.blockIds.forEach((id) => used.add(id));
    out.push({
      ...wrap,
      title: String(wrap.title ?? ""),
      blockIds: sorted.map((p) => blocks[p].id),
    });
  }
  return out;
}

/**
 * Wrap the top-level blocks from `fromId` to `toId` (either order). Wraps
 * that overlap the range are replaced by the new one.
 */
export function addWrap(
  blocks: Block[],
  wraps: Wrap[],
  kind: WrapKind,
  fromId: string,
  toId: string,
  id: string,
): Wrap[] {
  const a = blocks.findIndex((b) => b.id === fromId);
  const b = blocks.findIndex((b) => b.id === toId);
  if (a < 0 || b < 0) return wraps;
  const range = blocks.slice(Math.min(a, b), Math.max(a, b) + 1);
  const ids = new Set(range.map((block) => block.id));
  const kept = wraps.filter((w) => !w.blockIds.some((x) => ids.has(x)));
  return [
    ...kept,
    {
      id,
      kind,
      title: defaultTitle(kind, range[0]),
      blockIds: range.map((block) => block.id),
    },
  ];
}

export function updateWrap(
  wraps: Wrap[],
  id: string,
  change: Partial<Pick<Wrap, "kind" | "title">>,
): Wrap[] {
  return wraps.map((w) => (w.id === id ? { ...w, ...change } : w));
}

export function removeWrap(wraps: Wrap[], id: string): Wrap[] {
  return wraps.filter((w) => w.id !== id);
}

/** An Expand over a heading shows the heading as its title only, not twice. */
function bodyBlocks(wrap: Wrap, blocks: Block[]): Block[] {
  const [first, ...rest] = blocks;
  if (
    wrap.kind === "expand" &&
    first?.type === "heading" &&
    plainText(first.content).trim() === wrap.title.trim()
  )
    return rest;
  return blocks;
}

/** A macro title cannot hold `{`, `}` or `|` in wiki markup. */
const cleanTitle = (title: string) =>
  title
    .replace(/[{}|\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function macroOpen(wrap: Wrap): string {
  const title = cleanTitle(wrap.title);
  if (wrap.kind === "expand") return `{expand${title ? `:${title}` : ""}}`;
  return `{${wrap.kind}${title ? `:title=${title}` : ""}}`;
}

export function renderWiki(
  title: string,
  blocks: Block[],
  wraps: Wrap[],
  options: WikiOptions = {},
): WikiPage {
  const valid = validWraps(blocks, wraps);
  const wrapOf = new Map<string, Wrap>();
  for (const wrap of valid)
    for (const id of wrap.blockIds) wrapOf.set(id, wrap);
  const unitOf = (block: Block): WikiUnit => {
    const markup = joinBlocks([block], options);
    return { id: block.id, markup, html: renderWikiMarkup(markup) };
  };

  const parts: WikiPart[] = [];
  const sections: string[] = [
    `h1. ${(title || "Untitled").replace(/\n/g, " ")}`,
  ];
  let run: Block[] = [];
  const flush = () => {
    const markup = joinBlocks(run, options);
    if (markup) sections.push(markup);
    run = [];
  };
  for (let i = 0; i < blocks.length;) {
    const wrap = wrapOf.get(blocks[i].id);
    if (!wrap) {
      run.push(blocks[i]);
      parts.push({ type: "unit", unit: unitOf(blocks[i]) });
      i++;
      continue;
    }
    flush();
    const members = blocks.slice(i, i + wrap.blockIds.length);
    const body = bodyBlocks(wrap, members);
    const inner = joinBlocks(body, options);
    sections.push(`${macroOpen(wrap)}\n${inner}\n{${wrap.kind}}`);
    const shown = new Set(body.map((b) => b.id));
    parts.push({
      type: "wrap",
      wrap,
      units: members.map((b) =>
        shown.has(b.id) ? unitOf(b) : { id: b.id, markup: "", html: "" },
      ),
    });
    i += wrap.blockIds.length;
  }
  flush();
  return { markup: sections.join("\n\n") + "\n", parts };
}
