import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Document, TreeNode } from "../../packages/document-schema/index";
import { RowMenu } from "./DatabaseMenus";
import { DatabaseTable, type RowInfo } from "./DatabaseTable";
import { Plus, X } from "lucide-react";
import { DatabaseViewBar } from "./DatabaseViews";
import { DatabaseFeed, freshBlockIds, meetingSkeleton } from "./DatabaseFeed";
import { RowPagesContext } from "./row-pages";
import { recordNotification } from "./NotificationBell";
import { SummarizeButton, type SummaryStyle } from "./summaries";
import {
  FILTER_OPS,
  applyView,
  defaultView,
  filterDefaults,
  readViews,
  viewsJson,
  type DatabaseView,
} from "../../packages/database/views";
import {
  DEFAULT_DATABASE_COLUMNS_JSON,
  DEFAULT_DATABASE_ROWS_JSON,
  insertRowCopy,
  moveRow,
  readDatabaseState,
  removeRow,
  type DatabaseColumn,
  type DatabaseRow,
  type DatabaseState,
  type DatabaseValue,
} from "../../packages/database/model";

export type DatabaseActions = {
  pages: TreeNode[];
  createRowPage: (title: string) => Promise<Document>;
  openPage: (id: string) => void;
  /** Copy a row page (and its children) next to it without navigating. */
  duplicateRowPage?: (id: string) => Promise<Document>;
  /** Move a row page to the trash. */
  trashRowPage?: (id: string) => Promise<void>;
};

export const DatabaseActionsContext = createContext<DatabaseActions | null>(
  null,
);

function pageId(href: string) {
  return /^#\/page\/([a-zA-Z0-9_-]{1,100})$/.exec(href)?.[1] ?? null;
}

/**
 * Add a link to a new meeting page at the end of the page that holds the database
 * (before a trailing empty paragraph, so typing at the end stays easy).
 */
function linkAtPageEnd(editor: any, page: Document) {
  try {
    const blocks = editor.document as any[];
    const last = blocks[blocks.length - 1];
    const link = {
      type: "paragraph",
      content: [
        {
          type: "mention",
          props: {
            kind: "page",
            href: `#/page/${page.id}`,
            label: page.title,
            icon: page.icon ?? "📄",
            value: "",
          },
        },
      ],
    };
    const trailingEmpty =
      last?.type === "paragraph" && !(last.content ?? []).length;
    editor.insertBlocks([link], last, trailingEmpty ? "before" : "after");
  } catch {
    // the link is a convenience; the row and its page already exist
  }
}

export function DatabaseBlock({ block, editor }: { block: any; editor: any }) {
  const actions = useContext(DatabaseActionsContext);
  /** Meeting logs: meeting entries, summaries; otherwise a plain database. */
  const meetings = block.props.variant === "meetings";
  const rowPages = useContext(RowPagesContext);
  const state = useMemo(() => {
    try {
      return readDatabaseState(block.props.columns, block.props.rows);
    } catch {
      return readDatabaseState(
        DEFAULT_DATABASE_COLUMNS_JSON,
        DEFAULT_DATABASE_ROWS_JSON,
      );
    }
  }, [block.props.columns, block.props.rows]);
  const views = useMemo(() => {
    try {
      return readViews(block.props.views, state.columns);
    } catch {
      return [defaultView()];
    }
  }, [block.props.views, state.columns]);
  const viewKey = `lotion-database-view:${block.id}`;
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return localStorage.getItem(viewKey) ?? "";
    } catch {
      return "";
    }
  });
  const active: DatabaseView =
    views.find((view) => view.id === activeId) ?? views[0];
  const selectView = (id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(viewKey, id);
    } catch {
      /* per-viewer convenience only */
    }
  };
  const section = useRef<HTMLElement>(null);
  // Clicks on the database's own controls (tabs, menus, feed entries) must not reach
  // the page editor, which would select the whole block (blue highlight) on mousedown.
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const stop = (event: Event) => event.stopPropagation();
    element.addEventListener("mousedown", stop);
    return () => element.removeEventListener("mousedown", stop);
  }, []);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Rows removed elsewhere drop out of the selection.
  useEffect(() => {
    setSelected((current) => {
      const next = new Set(
        [...current].filter((id) => state.rows.some((row) => row.id === id)),
      );
      return next.size === current.size ? current : next;
    });
  }, [state.rows]);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [filterRequest, setFilterRequest] = useState(0);
  const [error, setError] = useState("");

  const update = useCallback(
    (next: DatabaseState) =>
      editor.updateBlock(block, {
        props: {
          columns: JSON.stringify(next.columns),
          rows: JSON.stringify(next.rows),
        },
      }),
    [block, editor],
  );
  const updateViews = (next: DatabaseView[]) =>
    editor.updateBlock(block, { props: { views: viewsJson(next) } });
  /** For async results: apply `change` to the block's state as it is *now*. */
  const updateLatest = useCallback(
    (change: (current: DatabaseState) => DatabaseState): boolean => {
      const current = editor.getBlock(block.id);
      if (!current) return false;
      let latest: DatabaseState;
      try {
        latest = readDatabaseState(current.props.columns, current.props.rows);
      } catch {
        return false;
      }
      update(change(latest));
      return true;
    },
    [block.id, editor, update],
  );

  useEffect(() => {
    if (!actions) return;
    const stale = state.rows.some((row) => {
      const title = actions.pages.find(
        (page) => page.id === pageId(row.href),
      )?.title;
      return !!title && title !== row.title;
    });
    if (!stale) return;
    // Apply to the block as it is now: this render's copy can miss a row that an
    // async action (new meeting, duplicate) added a moment ago.
    updateLatest((latest) => ({
      ...latest,
      rows: latest.rows.map((row) => {
        const title = actions.pages.find(
          (page) => page.id === pageId(row.href),
        )?.title;
        return title && title !== row.title ? { ...row, title } : row;
      }),
    }));
  }, [actions, state, updateLatest]);

  const rowTitle = (row: DatabaseRow) => {
    const id = pageId(row.href);
    return actions?.pages.find((page) => page.id === id)?.title ?? row.title;
  };
  const shownRows = applyView(state, active, rowTitle);
  const shownColumns = state.columns.filter(
    (column) => !active.hidden.includes(column.id),
  );

  /**
   * Create a row page. In Meeting logs it is a new meeting: today's date in the first
   * date property and the body from the template row (or a meeting skeleton). In a
   * basic database it is an "Untitled row", with the template row's body if one is set.
   */
  const createEntry = async () => {
    if (!actions) return;
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const values = filterDefaults(active, state.columns, today);
    const dateColumn = state.columns.find((column) => column.type === "date");
    if (meetings && dateColumn && values[dateColumn.id] === undefined)
      values[dateColumn.id] = day;
    let body = null;
    if (rowPages) {
      const templateId = pageId(String(block.props.template ?? ""));
      const template =
        templateId && actions.pages.some((page) => page.id === templateId)
          ? await rowPages.load(templateId)
          : null;
      body = template
        ? freshBlockIds(template.blocks)
        : meetings
          ? meetingSkeleton()
          : null;
    }
    const page = await actions.createRowPage(
      meetings ? `${day} 회의` : "Untitled row",
    );
    // Fill the body before the row appears, so the feed opens it with the template.
    if (body && rowPages) {
      const coordinator = await rowPages.coordinator(page.id);
      coordinator.edit({ ...coordinator.content, blocks: body });
      await coordinator.flush();
    }
    const entry = {
      id: crypto.randomUUID(),
      href: `#/page/${page.id}`,
      title: page.title,
      values,
    };
    // A meeting goes first, so same-day meetings also read newest first.
    const added = updateLatest((latest) => ({
      ...latest,
      rows: meetings ? [entry, ...latest.rows] : [...latest.rows, entry],
    }));
    if (added && meetings) linkAtPageEnd(editor, page);
    if (added && meetings)
      recordNotification({
        kind: "meeting.created",
        title: page.title,
        detail: String(block.props.title || "Meeting logs"),
        pageId: page.id,
      });
    if (!added)
      throw new Error(
        `"${page.title}" was created but could not be added to this database; it is in the sidebar.`,
      );
  };

  /** Remove rows at once, then trash their pages; rows whose page fails come back. */
  const deleteRows = async (ids: string[]) => {
    setError("");
    const removed = state.rows.filter((row) => ids.includes(row.id));
    updateLatest((latest) => ({
      ...latest,
      rows: latest.rows.filter((row) => !ids.includes(row.id)),
    }));
    setSelected(new Set());
    const failed: DatabaseRow[] = [];
    for (const row of removed) {
      const id = pageId(row.href);
      if (!id || !actions?.trashRowPage) continue;
      if (!actions.pages.some((page) => page.id === id)) continue;
      try {
        await actions.trashRowPage(id);
      } catch {
        failed.push(row);
      }
    }
    if (failed.length) {
      setError(`${failed.length} row page(s) could not be moved to the trash.`);
      updateLatest((latest) => ({
        ...latest,
        rows: [...latest.rows, ...failed],
      }));
    }
  };

  const setValue = (
    row: DatabaseRow,
    column: DatabaseColumn,
    value: DatabaseValue,
  ) =>
    update({
      ...state,
      rows: state.rows.map((candidate) =>
        candidate.id === row.id
          ? {
              ...candidate,
              values: { ...candidate.values, [column.id]: value },
            }
          : candidate,
      ),
    });

  const needle = query.trim().toLowerCase();
  const visibleRows = needle
    ? shownRows.filter((row) =>
        [rowTitle(row), ...Object.values(row.values)]
          .filter((v) => typeof v === "string" || typeof v === "number")
          .some((v) => String(v).toLowerCase().includes(needle)),
      )
    : shownRows;
  const infos: RowInfo[] = visibleRows.map((row) => {
    const id = pageId(row.href);
    const page = actions?.pages.find((candidate) => candidate.id === id);
    return {
      row,
      pageId: id,
      page,
      title: (page?.title ?? row.title) || "Untitled row",
    };
  });
  const patchView = (change: (view: DatabaseView) => DatabaseView) =>
    updateViews(views.map((v) => (v.id === active.id ? change(v) : v)));
  const startEntry = () => {
    if (!actions || adding) return;
    setAdding(true);
    setError("");
    void createEntry()
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setAdding(false));
  };
  const feed = active.type === "feed";

  const rowMenu = (info: RowInfo, anchor: HTMLElement, close: () => void) => {
    const { row, pageId: id, page } = info;
    return (
      <RowMenu
        anchor={anchor}
        index={state.rows.indexOf(row)}
        count={state.rows.length}
        canPage={!!id && !!page && !!actions?.duplicateRowPage}
        onSummarize={
          meetings && id && page && rowPages
            ? (style?: SummaryStyle) => {
                close();
                void rowPages
                  .summarize({ pages: [{ id }], parentId: id, style })
                  .catch(() => undefined);
              }
            : undefined
        }
        isTemplate={!!block.props.template && block.props.template === row.href}
        onTemplate={() => {
          close();
          editor.updateBlock(block, {
            props: {
              template: block.props.template === row.href ? "" : row.href,
            },
          });
        }}
        onClose={close}
        onMove={(delta) => update(moveRow(state, row.id, delta))}
        onDuplicate={() => {
          if (!id || !actions?.duplicateRowPage) return;
          close();
          setError("");
          void actions
            .duplicateRowPage(id)
            .then((copy) =>
              updateLatest((latest) =>
                insertRowCopy(latest, row.id, {
                  id: crypto.randomUUID(),
                  href: `#/page/${copy.id}`,
                  title: copy.title,
                }),
              ),
            )
            .catch((reason) => setError((reason as Error).message));
        }}
        onDelete={() => {
          close();
          setError("");
          // Remove the row right away, then trash its page; if trashing
          // fails, put the row back where it was.
          const index = state.rows.indexOf(row);
          update(removeRow(state, row.id));
          if (!id || !page || !actions?.trashRowPage) return;
          void actions.trashRowPage(id).catch((reason) => {
            setError((reason as Error).message);
            updateLatest((latest) =>
              latest.rows.some((r) => r.id === row.id)
                ? latest
                : {
                    ...latest,
                    rows: [
                      ...latest.rows.slice(0, index),
                      row,
                      ...latest.rows.slice(index),
                    ],
                  },
            );
          });
        }}
      />
    );
  };

  return (
    <section ref={section} className="lotion-database" contentEditable={false}>
      <input
        className="ldb-name"
        aria-label="Database title"
        placeholder="Untitled database"
        maxLength={200}
        value={String(block.props.title ?? "")}
        onChange={(event) =>
          editor.updateBlock(block, {
            props: { title: event.target.value.slice(0, 200) },
          })
        }
      />
      <DatabaseViewBar
        views={views}
        active={active}
        columns={state.columns}
        shown={shownRows.length}
        total={state.rows.length}
        onSelect={selectView}
        onChange={updateViews}
        query={query}
        onQuery={setQuery}
        filterRequest={filterRequest}
        meetings={meetings}
        onVariant={(variant) =>
          editor.updateBlock(block, { props: { variant } })
        }
        primary={
          <button
            type="button"
            className="ldb-primary"
            aria-label={meetings ? "+ New meeting" : "New row page"}
            disabled={!actions || adding || state.rows.length >= 500}
            onClick={startEntry}
          >
            <Plus size={14} aria-hidden />
            {adding ? "Creating…" : meetings ? "New meeting" : "New"}
          </button>
        }
      />
      {feed ? (
        <DatabaseFeed
          rows={visibleRows}
          columns={shownColumns}
          editor={editor}
          rowTitle={rowTitle}
          pageOf={(row) =>
            actions?.pages.find((page) => page.id === pageId(row.href))
          }
          newestEditable
          summaries={meetings}
          selected={selected}
          onToggle={toggleSelected}
        />
      ) : (
        <DatabaseTable
          state={state}
          columns={shownColumns}
          rows={infos}
          selected={selected}
          onToggle={toggleSelected}
          onToggleAll={(checked) =>
            setSelected(
              checked
                ? new Set([...selected, ...infos.map((i) => i.row.id)])
                : new Set(
                    [...selected].filter(
                      (id) => !infos.some((i) => i.row.id === id),
                    ),
                  ),
            )
          }
          update={update}
          setValue={setValue}
          openRow={(info) => info.pageId && actions?.openPage(info.pageId)}
          addRow={startEntry}
          adding={adding}
          canAdd={!!actions && state.rows.length < 500}
          emptyText={
            needle
              ? `No rows match “${query}”.`
              : state.rows.length
                ? "No rows match this view's filters."
                : "No rows yet. Click “New” to add one."
          }
          renderRowMenu={rowMenu}
          view={{
            sort: (columnId, direction) =>
              patchView((v) => ({
                ...v,
                sort: [
                  { columnId, direction },
                  ...v.sort.filter((r) => r.columnId !== columnId),
                ].slice(0, 5),
              })),
            filter: (columnId) => {
              const column = state.columns.find((c) => c.id === columnId);
              if (!column) return;
              patchView((v) => ({
                ...v,
                filters: [
                  ...v.filters,
                  {
                    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
                    columnId,
                    op: FILTER_OPS[column.type][0],
                  },
                ].slice(0, 10),
              }));
              setFilterRequest((n) => n + 1);
            },
            hide: (columnId) =>
              patchView((v) => ({
                ...v,
                hidden: [...new Set([...v.hidden, columnId])],
              })),
          }}
        />
      )}
      {selected.size > 0 && (
        <div
          className="lotion-database-selection"
          role="toolbar"
          aria-label="Selected rows"
        >
          <strong>{selected.size} selected</strong>
          {visibleRows.some((row) => !selected.has(row.id)) && (
            <button
              type="button"
              onClick={() =>
                setSelected(
                  new Set([...selected, ...visibleRows.map((r) => r.id)]),
                )
              }
            >
              Select all {visibleRows.length} shown
            </button>
          )}
          {meetings && rowPages && (
            <SummarizeButton
              label={`📝 Summarize ${selected.size}`}
              className="lotion-database-summarize"
              onRun={(style) => {
                const pages = shownRows
                  .concat(state.rows.filter((row) => !shownRows.includes(row)))
                  .filter((row) => selected.has(row.id))
                  .map((row) => pageId(row.href))
                  .filter(
                    (id): id is string =>
                      !!id && !!actions?.pages.some((page) => page.id === id),
                  );
                if (!pages.length) return;
                const parentId =
                  pages.length === 1 ? pages[0] : rowPages.activePageId;
                if (!parentId) return;
                void rowPages
                  .summarize({
                    pages: pages.map((id) => ({ id })),
                    parentId,
                    style,
                  })
                  .then(() => setSelected(new Set()))
                  .catch(() => undefined);
              }}
            />
          )}
          {confirmBulk ? (
            <span className="lotion-database-confirm" role="alert">
              Delete {selected.size} rows? Their pages move to the trash.
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setConfirmBulk(false);
                  void deleteRows([...selected]);
                }}
              >
                Delete rows
              </button>
              <button type="button" onClick={() => setConfirmBulk(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="danger"
              onClick={() => setConfirmBulk(true)}
            >
              Delete…
            </button>
          )}
          <button
            type="button"
            className="ldb-selection-clear"
            aria-label="Clear"
            onClick={() => setSelected(new Set())}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
