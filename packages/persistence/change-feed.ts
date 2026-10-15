import type { Document } from "../document-schema/index";
import {
  diffRevisions,
  groupChanges,
  type ChangeGroup,
  type RevisionChange,
} from "./changes";

/** Read access the feed needs; snapshots are immutable, so results are cacheable. */
export type RevisionReader = {
  /** Every page (including trashed) with its committed head revision. */
  heads(): Document[];
  /** A stored revision, or null when it is missing or unreadable. */
  read(id: string, revision: number): Promise<Document | null>;
  isDeleted(id: string): boolean;
};

export type ChangeFeedPage = { changes: ChangeGroup[]; next: string | null };

type Cursor = { id: string; revision: number; at: number };

/** Max-heap of revision cursors by time (newest first). */
class Heap {
  private items: Cursor[] = [];
  get size() {
    return this.items.length;
  }
  peek() {
    return this.items[0];
  }
  push(item: Cursor) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].at >= a[i].at) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < a.length && a[l].at > a[m].at) m = l;
        if (r < a.length && a[r].at > a[m].at) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Recent changes across the workspace, newest first, grouped into sittings.
 * Walks every page's revision chain backwards with a k-way merge, so only the
 * snapshots needed for the requested page of results are read.
 */
export class ChangeFeed {
  private readonly changeCache = new Map<string, RevisionChange>();
  private readonly timeCache = new Map<string, number>();

  constructor(
    private readonly reader: RevisionReader,
    private readonly windowMs = 30 * 60 * 1000,
  ) {}

  private async change(
    id: string,
    revision: number,
    carry: Map<string, Document>,
  ) {
    const key = `${id}:${revision}`;
    const cached = this.changeCache.get(key);
    if (cached) return cached;
    const held = carry.get(id);
    const next =
      held?.revision === revision ? held : await this.reader.read(id, revision);
    if (!next) return null;
    const previous =
      revision > 1 ? await this.reader.read(id, revision - 1) : null;
    let change = diffRevisions(previous, next);
    if (revision > 1 && !previous)
      // the earlier snapshot is gone: keep the entry, without block counts
      change = {
        ...change,
        kinds: ["edited"],
        added: 0,
        removed: 0,
        changed: 0,
      };
    if (previous) {
      carry.set(id, previous);
      this.timeCache.set(
        `${id}:${revision - 1}`,
        Date.parse(previous.updatedAt),
      );
    }
    this.changeCache.set(key, change);
    return change;
  }

  /** Queue the nearest older stored revision (skipping missing snapshots, up to a bound). */
  private async pushOlder(heap: Heap, id: string, revision: number) {
    for (let r = revision - 1; r >= 1 && r >= revision - 50; r--) {
      const at = this.timeCache.get(`${id}:${r}`);
      if (at !== undefined) {
        heap.push({ id, revision: r, at });
        return;
      }
      const doc = await this.reader.read(id, r);
      if (doc) {
        this.timeCache.set(`${id}:${r}`, Date.parse(doc.updatedAt));
        heap.push({ id, revision: r, at: Date.parse(doc.updatedAt) });
        return;
      }
    }
  }

  async page(limit = 30, before?: string): Promise<ChangeFeedPage> {
    const beforeMs = before ? Date.parse(before) : Number.POSITIVE_INFINITY;
    const heap = new Heap();
    for (const doc of this.reader.heads())
      heap.push({
        id: doc.id,
        revision: doc.revision,
        at: Date.parse(doc.updatedAt),
      });
    const carry = new Map<string, Document>();
    const events: RevisionChange[] = [];
    // Track sittings while walking: group i starts at the first (newest) event of a
    // page and extends back while revisions stay within the window. Once more than
    // `limit` groups exist, stop as soon as the next revision is too old to extend
    // any of the first `limit` groups.
    const groupFrom: number[] = [];
    const openGroup = new Map<string, number>();
    while (heap.size) {
      const top = heap.peek();
      if (groupFrom.length > limit) {
        const earliest = Math.min(...groupFrom.slice(0, limit));
        if (top.at < earliest - this.windowMs) break;
      }
      heap.pop();
      const change = await this.change(top.id, top.revision, carry);
      if (top.revision > 1) await this.pushOlder(heap, top.id, top.revision);
      if (!change) continue;
      const t = Date.parse(change.at);
      if (!(t < beforeMs)) continue;
      events.push(change);
      const index = openGroup.get(change.id);
      if (index !== undefined && groupFrom[index] - t <= this.windowMs)
        groupFrom[index] = t;
      else {
        openGroup.set(change.id, groupFrom.length);
        groupFrom.push(t);
      }
    }
    events.sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at) || b.revision - a.revision,
    );
    const groups = groupChanges(events, this.windowMs, (id) =>
      this.reader.isDeleted(id),
    );
    const page = groups.slice(0, limit);
    const more = groups.length > limit || heap.size > 0;
    const next =
      more && page.length
        ? page.reduce((min, g) => (g.from < min ? g.from : min), page[0].from)
        : null;
    return { changes: page, next };
  }
}
