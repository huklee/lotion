import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { api } from "./api";

export type ChangeKind =
  "created" | "edited" | "renamed" | "moved" | "deleted" | "restored";

export type ChangeEntry = {
  id: string;
  title: string;
  icon?: string;
  kinds: ChangeKind[];
  titleFrom?: string;
  added: number;
  removed: number;
  changed: number;
  excerpt?: string;
  blockId?: string;
  from: string;
  to: string;
  fromRevision: number;
  toRevision: number;
  edits: number;
  deletedNow: boolean;
};

const KIND_LABEL: Record<ChangeKind, string> = {
  created: "Created",
  edited: "Edited",
  renamed: "Renamed",
  moved: "Moved",
  deleted: "Moved to trash",
  restored: "Restored",
};

function dayLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  const start = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** One entry of the changes feed (also used by the Home page). */
export function ChangeRow({
  entry,
  onOpen,
  onOpenTrash,
  day,
}: {
  entry: ChangeEntry;
  onOpen: (id: string, blockId?: string) => void;
  onOpenTrash: () => void;
  /** Show the day next to the time (lists without day headings). */
  day?: boolean;
}) {
  return (
    <button
      type="button"
      className="change-row"
      data-change={`${entry.id}:${entry.toRevision}`}
      onClick={() =>
        entry.deletedNow ? onOpenTrash() : onOpen(entry.id, entry.blockId)
      }
      title={entry.deletedNow ? "In the trash — open Trash" : "Open page"}
    >
      <span className="change-icon" aria-hidden="true">
        {entry.icon || <FileText size={16} />}
      </span>
      <span className="change-main">
        <span className="change-title">
          {entry.title || "Untitled"}
          {entry.titleFrom !== undefined && entry.titleFrom !== entry.title && (
            <span className="change-from">
              {" "}
              (was “{entry.titleFrom || "Untitled"}”)
            </span>
          )}
        </span>
        <span className="change-meta">
          {entry.kinds.map((kind) => (
            <span key={kind} className={`change-kind kind-${kind}`}>
              {KIND_LABEL[kind]}
            </span>
          ))}
          {(entry.added > 0 || entry.removed > 0 || entry.changed > 0) && (
            <span
              className="change-counts"
              aria-label={`${entry.added} blocks added, ${entry.removed} removed, ${entry.changed} changed`}
            >
              {entry.added > 0 && (
                <span className="count-add">+{entry.added}</span>
              )}
              {entry.removed > 0 && (
                <span className="count-remove">−{entry.removed}</span>
              )}
              {entry.changed > 0 && (
                <span className="count-change">~{entry.changed}</span>
              )}
            </span>
          )}
          {entry.edits > 1 && (
            <span className="change-edits">{entry.edits} edits</span>
          )}
          {entry.deletedNow && <span className="change-edits">in trash</span>}
        </span>
        {entry.excerpt && (
          <span className="change-excerpt">{entry.excerpt}</span>
        )}
      </span>
      <time className="change-time" dateTime={entry.to}>
        {day && `${dayLabel(entry.to)} `}
        {entry.edits > 1 && timeLabel(entry.from) !== timeLabel(entry.to)
          ? `${timeLabel(entry.from)}–${timeLabel(entry.to)}`
          : timeLabel(entry.to)}
      </time>
    </button>
  );
}

/** Workspace-wide feed of recent page changes, grouped by day, newest first. */
export function ChangesView({
  onOpen,
  onOpenTrash,
}: {
  onOpen: (id: string, blockId?: string) => void;
  onOpenTrash: () => void;
}) {
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    setError("");
    try {
      const page = await api<{ changes: ChangeEntry[]; next: string | null }>(
        `/api/changes?limit=30${before ? `&before=${encodeURIComponent(before)}` : ""}`,
      );
      setEntries((current) =>
        before ? [...current, ...page.changes] : page.changes,
      );
      setNext(page.next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const days: { label: string; items: ChangeEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.to);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(entry);
    else days.push({ label, items: [entry] });
  }

  return (
    <section
      className="home-content changes-view"
      aria-labelledby="changes-title"
    >
      <div className="eyebrow">WHAT MOVED LATELY</div>
      <h1 id="changes-title">Recent changes</h1>
      <p className="subtitle">
        Every page edit, rename, move and restore in this workspace, newest
        first.
      </p>
      {error && (
        <p className="message error" role="alert">
          Could not load recent changes: {error}
        </p>
      )}
      {days.map((day) => (
        <div className="changes-day" key={day.label}>
          <h2>{day.label}</h2>
          <ul>
            {day.items.map((entry) => (
              <li key={`${entry.id}:${entry.toRevision}`}>
                <ChangeRow
                  entry={entry}
                  onOpen={onOpen}
                  onOpenTrash={onOpenTrash}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!loading && !error && !entries.length && (
        <p className="empty-copy">No changes yet. Edits will show up here.</p>
      )}
      {loading && <p className="empty-copy">Loading…</p>}
      {next && !loading && (
        <button
          type="button"
          className="quiet changes-more"
          onClick={() => void load(next)}
        >
          Show older changes
        </button>
      )}
    </section>
  );
}

/** The latest few changes on the Home page, with a link to the full feed. */
export function HomeRecentChanges({
  onOpen,
  onOpenTrash,
  onShowAll,
  limit = 6,
}: {
  onOpen: (id: string, blockId?: string) => void;
  onOpenTrash: () => void;
  onShowAll: () => void;
  limit?: number;
}) {
  const [entries, setEntries] = useState<ChangeEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ changes: ChangeEntry[] }>(`/api/changes?limit=${limit}`)
      .then((page) => alive && setEntries(page.changes))
      .catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [limit]);
  return (
    <section className="home-recent" aria-labelledby="home-recent-title">
      <div className="home-section">
        <h2 id="home-recent-title">Recent changes</h2>
        <button className="quiet" onClick={onShowAll}>
          See all
        </button>
      </div>
      {entries === null ? (
        <p className="empty-copy">Loading…</p>
      ) : entries.length ? (
        <ul className="home-recent-list">
          {entries.map((entry) => (
            <li key={`${entry.id}:${entry.toRevision}`}>
              <ChangeRow
                entry={entry}
                onOpen={onOpen}
                onOpenTrash={onOpenTrash}
                day
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">No changes yet. Edits will show up here.</p>
      )}
    </section>
  );
}
