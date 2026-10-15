import type { Block, Document } from "../document-schema/index";

export type ChangeKind =
  "created" | "edited" | "renamed" | "moved" | "deleted" | "restored";

/** What one revision changed compared with the revision before it. */
export type RevisionChange = {
  id: string;
  revision: number;
  at: string;
  title: string;
  icon?: string;
  kinds: ChangeKind[];
  titleFrom?: string;
  added: number;
  removed: number;
  changed: number;
  excerpt?: string;
};

/** Consecutive edits of one page in one sitting, shown as a single entry. */
export type ChangeGroup = Omit<RevisionChange, "revision" | "at"> & {
  from: string;
  to: string;
  fromRevision: number;
  toRevision: number;
  edits: number;
  deletedNow: boolean;
};

const EXCERPT_LENGTH = 140;

function flatten(blocks: Block[] | undefined, out = new Map<string, Block>()) {
  for (const block of blocks ?? []) {
    out.set(block.id, block);
    flatten(block.children, out);
  }
  return out;
}

function own(block: Block) {
  const { children: _children, ...rest } = block;
  return JSON.stringify(rest);
}

export function inlineText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(inlineText).join("");
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    if (typeof node.text === "string") return node.text;
    if (node.content !== undefined) return inlineText(node.content);
    if (Array.isArray(node.rows))
      return (node.rows as { cells?: unknown[] }[])
        .map((row) => (row.cells ?? []).map(inlineText).join(" "))
        .join(" ");
  }
  return "";
}

/** Compare a revision with its predecessor (null for the first revision). */
export function diffRevisions(
  previous: Document | null,
  next: Document,
): RevisionChange {
  const kinds: ChangeKind[] = [];
  let added = 0,
    removed = 0,
    changed = 0,
    excerpt: string | undefined;
  const after = flatten(next.blocks);
  if (!previous) {
    kinds.push("created");
    added = after.size;
  } else {
    if (!previous.deletedAt && next.deletedAt) kinds.push("deleted");
    if (previous.deletedAt && !next.deletedAt) kinds.push("restored");
    if (
      previous.parentId !== next.parentId ||
      previous.position !== next.position
    )
      kinds.push("moved");
    if (previous.title !== next.title) kinds.push("renamed");
    const before = flatten(previous.blocks);
    for (const [id, block] of after) {
      const old = before.get(id);
      if (!old) {
        added++;
        excerpt ??= inlineText(block.content).trim() || undefined;
      } else if (own(old) !== own(block)) {
        changed++;
        excerpt ??= inlineText(block.content).trim() || undefined;
      }
    }
    for (const id of before.keys()) if (!after.has(id)) removed++;
    if (added || removed || changed || previous.icon !== next.icon)
      kinds.push("edited");
    if (!kinds.length) kinds.push("edited");
  }
  if (!excerpt && !previous)
    for (const block of after.values()) {
      excerpt = inlineText(block.content).trim() || undefined;
      if (excerpt) break;
    }
  return {
    id: next.id,
    revision: next.revision,
    at: next.updatedAt,
    title: next.title,
    ...(next.icon ? { icon: next.icon } : {}),
    kinds,
    ...(kinds.includes("renamed") && previous
      ? { titleFrom: previous.title }
      : {}),
    added,
    removed,
    changed,
    ...(excerpt ? { excerpt: excerpt.slice(0, EXCERPT_LENGTH) } : {}),
  };
}

const KIND_ORDER: ChangeKind[] = [
  "created",
  "restored",
  "deleted",
  "moved",
  "renamed",
  "edited",
];

/**
 * Group newest-first revision changes into sittings: a page's revisions belong
 * to the same entry while each is within `windowMs` of the next newer one.
 * Groups are returned newest first.
 */
export function groupChanges(
  newestFirst: RevisionChange[],
  windowMs = 30 * 60 * 1000,
  isDeleted: (id: string) => boolean = () => false,
): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  const open = new Map<string, ChangeGroup>();
  for (const change of newestFirst) {
    const current = open.get(change.id);
    const time = Date.parse(change.at);
    if (current && Date.parse(current.from) - time <= windowMs) {
      current.from = change.at;
      current.fromRevision = change.revision;
      current.edits++;
      current.added += change.added;
      current.removed += change.removed;
      current.changed += change.changed;
      for (const kind of change.kinds)
        if (!current.kinds.includes(kind)) current.kinds.push(kind);
      current.kinds.sort(
        (a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b),
      );
      if (change.titleFrom && current.kinds.includes("renamed"))
        current.titleFrom = change.titleFrom;
      current.excerpt ??= change.excerpt;
      continue;
    }
    const group: ChangeGroup = {
      id: change.id,
      title: change.title,
      ...(change.icon ? { icon: change.icon } : {}),
      kinds: [...change.kinds],
      ...(change.titleFrom ? { titleFrom: change.titleFrom } : {}),
      added: change.added,
      removed: change.removed,
      changed: change.changed,
      ...(change.excerpt ? { excerpt: change.excerpt } : {}),
      from: change.at,
      to: change.at,
      fromRevision: change.revision,
      toRevision: change.revision,
      edits: 1,
      deletedNow: isDeleted(change.id),
    };
    open.set(change.id, group);
    groups.push(group);
  }
  return groups;
}
