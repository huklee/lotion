import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  Block,
  Document,
  TreeNode,
} from "../../packages/document-schema/index";
import type {
  DatabaseColumn,
  DatabaseRow,
  DatabaseValue,
} from "../../packages/database/model";
import { RowPagesContext } from "./row-pages";

const PAGE_SIZE = 10;

/** Body for a new meeting when the database has no template row. */
export function meetingSkeleton(): Block[] {
  const id = () => crypto.randomUUID();
  const heading = (text: string): Block =>
    ({
      id: id(),
      type: "heading",
      props: { level: 3 },
      content: [{ type: "text", text, styles: {} }],
      children: [],
    }) as unknown as Block;
  const empty = (type = "bulletListItem"): Block =>
    ({
      id: id(),
      type,
      props: {},
      content: [],
      children: [],
    }) as unknown as Block;
  return [
    heading("참석자"),
    empty("paragraph"),
    heading("안건"),
    empty(),
    heading("논의 내용"),
    empty(),
    heading("결정 사항"),
    empty(),
    heading("액션 아이템"),
    empty("checkListItem"),
  ];
}

/** A copy of `blocks` with fresh ids, so a template can be reused safely. */
export function freshBlockIds(blocks: Block[]): Block[] {
  return blocks.map((block) => ({
    ...block,
    id: crypto.randomUUID(),
    children: freshBlockIds((block.children ?? []) as Block[]),
  }));
}

function formatValue(column: DatabaseColumn, value: DatabaseValue | undefined) {
  if (value === undefined || value === null || value === "") return null;
  if (column.type === "checkbox") return value === true ? "✓" : null;
  return String(value);
}

type FeedProps = {
  rows: DatabaseRow[];
  columns: DatabaseColumn[];
  editor: any;
  pageOf: (row: DatabaseRow) => TreeNode | undefined;
  rowTitle: (row: DatabaseRow) => string;
  newestEditable: boolean;
  selected?: Set<string>;
  onToggle?: (rowId: string) => void;
};

/**
 * Row pages one after another (in the view's order), read inline. The first entry
 * opens in place for editing; any other entry can be switched to editing too.
 */
export function DatabaseFeed({
  rows,
  columns,
  editor,
  pageOf,
  rowTitle,
  newestEditable,
  selected,
  onToggle,
}: FeedProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  if (!rows.length)
    return (
      <p className="lotion-database-empty lotion-feed-empty">
        No entries in this view.
      </p>
    );
  return (
    <div className="lotion-feed">
      {rows.slice(0, limit).map((row, index) => (
        <FeedEntry
          key={row.id}
          row={row}
          columns={columns}
          editor={editor}
          page={pageOf(row)}
          title={rowTitle(row) || "Untitled"}
          startEditing={newestEditable && index === 0}
          selected={selected?.has(row.id) ?? false}
          onToggle={onToggle && (() => onToggle(row.id))}
        />
      ))}
      {rows.length > limit && (
        <button
          type="button"
          className="lotion-feed-more"
          onClick={() => setLimit((n) => n + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, rows.length - limit)} more (
          {rows.length - limit} left)
        </button>
      )}
    </div>
  );
}

function FeedEntry({
  row,
  columns,
  editor,
  page,
  title,
  startEditing,
  selected,
  onToggle,
}: {
  selected: boolean;
  onToggle?: () => void;
  row: DatabaseRow;
  columns: DatabaseColumn[];
  editor: any;
  page: TreeNode | undefined;
  title: string;
  startEditing: boolean;
}) {
  const rowPages = useContext(RowPagesContext);
  const [editing, setEditing] = useState(startEditing);
  const [doc, setDoc] = useState<Document | null>(null);
  const [error, setError] = useState("");
  const [near, setNear] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const pageId = page?.id;

  // Load the body only when the entry comes near the viewport.
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const revision = page?.revision;
  useEffect(() => {
    if (!near || !pageId || !rowPages || editing) return;
    let alive = true;
    rowPages
      .load(pageId)
      .then((next) => alive && setDoc(next))
      .catch((reason) => alive && setError((reason as Error).message));
    return () => {
      alive = false;
    };
    // Reload when the page's stored revision changes or editing ends.
  }, [near, pageId, revision, editing]);

  const html = useMemo(() => {
    if (!doc) return "";
    try {
      return editor.blocksToFullHTML(doc.blocks) as string;
    } catch {
      return "";
    }
  }, [doc, editor]);

  const chips = columns
    .map((column) => ({
      column,
      text: formatValue(column, row.values[column.id]),
    }))
    .filter((chip) => chip.text !== null);
  const InlineEditor = rowPages?.InlineEditor;
  const summaries = pageId
    ? (rowPages?.pages ?? []).filter(
        (node) => node.parentId === pageId && node.icon === "📝",
      )
    : [];
  const [starting, setStarting] = useState(false);

  return (
    <article ref={ref} className="lotion-feed-entry" aria-label={title}>
      <header>
        {onToggle && (
          <input
            type="checkbox"
            className="lotion-database-select"
            aria-label={`Select ${title}`}
            checked={selected}
            onChange={onToggle}
          />
        )}
        <button
          type="button"
          className="lotion-feed-title"
          disabled={!pageId || !rowPages}
          onClick={() => pageId && rowPages?.openPage(pageId)}
          title="Open as a page"
        >
          {page?.icon ?? "📄"} {title}
        </button>
        <span className="lotion-feed-chips">
          {chips.map(({ column, text }) => (
            <span
              key={column.id}
              className="lotion-feed-chip"
              title={column.name}
            >
              <small>{column.name}</small> {text}
            </span>
          ))}
        </span>
        {summaries.map((summary) => (
          <button
            key={summary.id}
            type="button"
            className="lotion-feed-summary-link"
            onClick={() => rowPages?.openPage(summary.id)}
            title={summary.title}
          >
            📝 요약
          </button>
        ))}
        {pageId && rowPages && (
          <button
            type="button"
            className="lotion-feed-toggle"
            disabled={starting}
            title="Write a summary of this meeting with the summary settings (the text is sent to the chosen AI engine)"
            onClick={() => {
              setStarting(true);
              void rowPages
                .summarize({ pages: [{ id: pageId }], parentId: pageId })
                .catch(() => undefined)
                .finally(() => setStarting(false));
            }}
          >
            {starting ? "Starting…" : "요약"}
          </button>
        )}
        {pageId && InlineEditor && (
          <button
            type="button"
            className="lotion-feed-toggle"
            aria-pressed={editing}
            onClick={() => setEditing((on) => !on)}
          >
            {editing ? "Done" : "Edit here"}
          </button>
        )}
      </header>
      {!pageId ? (
        <p className="lotion-feed-loading">This row has no page.</p>
      ) : editing && InlineEditor ? (
        <InlineEditor pageId={pageId} />
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !doc ? (
        <p className="lotion-feed-loading">{near ? "Loading…" : ""}</p>
      ) : (
        <div
          className="lotion-feed-body bn-container bn-default-styles"
          data-color-scheme={rowPages?.theme}
          // HTML produced by BlockNote's own serializer from validated document blocks.
          dangerouslySetInnerHTML={{ __html: html }}
          onDoubleClick={() => InlineEditor && setEditing(true)}
        />
      )}
    </article>
  );
}
