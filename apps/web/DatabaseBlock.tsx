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
import { PropertyMenu, RowMenu } from "./DatabaseMenus";
import { DatabaseViewBar } from "./DatabaseViews";
import { DatabaseFeed, freshBlockIds, meetingSkeleton } from "./DatabaseFeed";
import { RowPagesContext } from "./row-pages";
import { SummarizeButton, type SummaryStyle } from "./summaries";
import {
  applyView,
  defaultView,
  filterDefaults,
  readViews,
  viewsJson,
  type DatabaseView,
} from "../../packages/database/views";
import {
  DATABASE_PROPERTY_TYPES,
  DEFAULT_DATABASE_COLUMNS_JSON,
  DEFAULT_DATABASE_ROWS_JSON,
  insertRowCopy,
  moveRow,
  readDatabaseState,
  removeRow,
  type DatabaseColumn,
  type DatabasePropertyType,
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

function emptyValue(type: DatabasePropertyType): DatabaseValue {
  if (type === "checkbox") return false;
  if (type === "number") return null;
  return "";
}

export function DatabaseBlock({ block, editor }: { block: any; editor: any }) {
  const actions = useContext(DatabaseActionsContext);
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
  const [propertyType, setPropertyType] =
    useState<DatabasePropertyType>("text");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<{
    kind: "property" | "row";
    id: string;
    anchor: HTMLElement;
  } | null>(null);

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
   * Create a row page. In a feed it is a new meeting: today's date in the first date
   * property, and the body copied from the template row (or a meeting skeleton).
   */
  const createEntry = async () => {
    if (!actions) return;
    const feed = active.type === "feed";
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const values = filterDefaults(active, state.columns, today);
    const dateColumn = state.columns.find((column) => column.type === "date");
    if (feed && dateColumn && values[dateColumn.id] === undefined)
      values[dateColumn.id] = day;
    let body = null;
    if (feed && rowPages) {
      const templateId = pageId(String(block.props.template ?? ""));
      const template =
        templateId && actions.pages.some((page) => page.id === templateId)
          ? await rowPages.load(templateId)
          : null;
      body = template ? freshBlockIds(template.blocks) : meetingSkeleton();
    }
    const page = await actions.createRowPage(
      feed ? `${day} 회의` : "Untitled row",
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
    // A feed entry goes first, so same-day meetings also read newest first.
    const added = updateLatest((latest) => ({
      ...latest,
      rows: feed ? [entry, ...latest.rows] : [...latest.rows, entry],
    }));
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

  return (
    <section ref={section} className="lotion-database" contentEditable={false}>
      <DatabaseViewBar
        views={views}
        active={active}
        columns={state.columns}
        shown={shownRows.length}
        total={state.rows.length}
        onSelect={selectView}
        onChange={updateViews}
      />
      {active.type === "feed" ? (
        <DatabaseFeed
          rows={shownRows}
          columns={shownColumns}
          editor={editor}
          rowTitle={rowTitle}
          pageOf={(row) =>
            actions?.pages.find((page) => page.id === pageId(row.href))
          }
          newestEditable
          selected={selected}
          onToggle={toggleSelected}
        />
      ) : (
        <div className="lotion-database-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="lotion-database-select"
                    aria-label="Select all shown rows"
                    checked={
                      shownRows.length > 0 &&
                      shownRows.every((row) => selected.has(row.id))
                    }
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? new Set([
                              ...selected,
                              ...shownRows.map((r) => r.id),
                            ])
                          : new Set(
                              [...selected].filter(
                                (id) => !shownRows.some((r) => r.id === id),
                              ),
                            ),
                      )
                    }
                  />{" "}
                  Page
                </th>
                {shownColumns.map((column) => (
                  <th key={column.id} className="lotion-database-property">
                    <input
                      aria-label={`${column.name} property name`}
                      maxLength={100}
                      value={column.name}
                      onChange={(event) =>
                        update({
                          ...state,
                          columns: state.columns.map((candidate) =>
                            candidate.id === column.id
                              ? {
                                  ...candidate,
                                  name: event.target.value.slice(0, 100),
                                }
                              : candidate,
                          ),
                        })
                      }
                    />
                    <small>{column.type}</small>
                    <button
                      type="button"
                      className="lotion-database-more"
                      aria-label={`${column.name} property settings`}
                      aria-expanded={
                        menu?.kind === "property" && menu.id === column.id
                      }
                      onClick={(event) =>
                        setMenu(
                          menu?.kind === "property" && menu.id === column.id
                            ? null
                            : {
                                kind: "property",
                                id: column.id,
                                anchor: event.currentTarget,
                              },
                        )
                      }
                    >
                      ⋯
                    </button>
                    {menu?.kind === "property" && menu.id === column.id && (
                      <PropertyMenu
                        anchor={menu.anchor}
                        column={column}
                        state={state}
                        index={state.columns.indexOf(column)}
                        update={update}
                        onClose={() => setMenu(null)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownRows.length === 0 && (
                <tr>
                  <td
                    className="lotion-database-empty"
                    colSpan={shownColumns.length + 1}
                  >
                    {state.rows.length
                      ? "No rows match this view's filters."
                      : "No rows yet."}
                  </td>
                </tr>
              )}
              {shownRows.map((row) => {
                const id = pageId(row.href);
                const page = actions?.pages.find(
                  (candidate) => candidate.id === id,
                );
                const title = (page?.title ?? row.title) || "Untitled row";
                return (
                  <tr key={row.id}>
                    <th className="lotion-database-row-title">
                      <input
                        type="checkbox"
                        className="lotion-database-select"
                        aria-label={`Select ${title}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelected(row.id)}
                      />
                      <button
                        type="button"
                        disabled={!id || !page || !actions}
                        onClick={() => id && actions?.openPage(id)}
                      >
                        {page?.icon ?? "📄"} {title}
                      </button>
                      <button
                        type="button"
                        className="lotion-database-more"
                        aria-label="Row actions"
                        title={`Actions for ${title}`}
                        aria-expanded={
                          menu?.kind === "row" && menu.id === row.id
                        }
                        onClick={(event) =>
                          setMenu(
                            menu?.kind === "row" && menu.id === row.id
                              ? null
                              : {
                                  kind: "row",
                                  id: row.id,
                                  anchor: event.currentTarget,
                                },
                          )
                        }
                      >
                        ⋯
                      </button>
                      {menu?.kind === "row" && menu.id === row.id && (
                        <RowMenu
                          anchor={menu.anchor}
                          index={state.rows.indexOf(row)}
                          count={state.rows.length}
                          canPage={
                            !!id && !!page && !!actions?.duplicateRowPage
                          }
                          onSummarize={
                            id && page && rowPages
                              ? (style?: SummaryStyle) => {
                                  setMenu(null);
                                  void rowPages
                                    .summarize({
                                      pages: [{ id }],
                                      parentId: id,
                                      style,
                                    })
                                    .catch(() => undefined);
                                }
                              : undefined
                          }
                          isTemplate={
                            !!block.props.template &&
                            block.props.template === row.href
                          }
                          onTemplate={() => {
                            setMenu(null);
                            editor.updateBlock(block, {
                              props: {
                                template:
                                  block.props.template === row.href
                                    ? ""
                                    : row.href,
                              },
                            });
                          }}
                          onClose={() => setMenu(null)}
                          onMove={(delta) =>
                            update(moveRow(state, row.id, delta))
                          }
                          onDuplicate={() => {
                            if (!id || !actions?.duplicateRowPage) return;
                            setMenu(null);
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
                              .catch((reason) =>
                                setError((reason as Error).message),
                              );
                          }}
                          onDelete={() => {
                            setMenu(null);
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
                      )}
                    </th>
                    {shownColumns.map((column) => {
                      const value =
                        row.values[column.id] ?? emptyValue(column.type);
                      const label = `${column.name} for ${title}`;
                      return (
                        <td key={column.id}>
                          {column.type === "checkbox" ? (
                            <input
                              type="checkbox"
                              aria-label={label}
                              checked={value === true}
                              onChange={(event) =>
                                setValue(row, column, event.target.checked)
                              }
                            />
                          ) : column.type === "select" ? (
                            <select
                              aria-label={label}
                              value={String(value ?? "")}
                              onChange={(event) =>
                                setValue(row, column, event.target.value)
                              }
                            >
                              <option value="">No selection</option>
                              {column.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                column.type === "date" ? "date" : column.type
                              }
                              aria-label={label}
                              maxLength={
                                column.type === "text" ? 500 : undefined
                              }
                              value={value === null ? "" : String(value)}
                              onChange={(event) =>
                                setValue(
                                  row,
                                  column,
                                  column.type === "number"
                                    ? event.target.value === ""
                                      ? null
                                      : Number(event.target.value)
                                    : event.target.value,
                                )
                              }
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {selected.size > 0 && (
        <div
          className="lotion-database-selection"
          role="toolbar"
          aria-label="Selected rows"
        >
          <strong>{selected.size} selected</strong>
          {shownRows.some((row) => !selected.has(row.id)) && (
            <button
              type="button"
              onClick={() =>
                setSelected(
                  new Set([...selected, ...shownRows.map((r) => r.id)]),
                )
              }
            >
              Select all {shownRows.length} shown
            </button>
          )}
          {rowPages && (
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
          <button type="button" onClick={() => setSelected(new Set())}>
            Clear
          </button>
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
        </div>
      )}
      <div className="lotion-database-actions">
        <button
          type="button"
          disabled={!actions || adding || state.rows.length >= 500}
          onClick={() => {
            if (!actions || adding) return;
            setAdding(true);
            setError("");
            void createEntry()
              .catch((reason) => setError((reason as Error).message))
              .finally(() => setAdding(false));
          }}
        >
          {adding
            ? "Creating…"
            : active.type === "feed"
              ? "+ New meeting"
              : "New row page"}
        </button>
        <label>
          Property type
          <select
            value={propertyType}
            onChange={(event) =>
              setPropertyType(event.target.value as DatabasePropertyType)
            }
          >
            {DATABASE_PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={state.columns.length >= 20}
          onClick={() => {
            const count =
              state.columns.filter((column) => column.type === propertyType)
                .length + 1;
            update({
              ...state,
              columns: [
                ...state.columns,
                {
                  id: crypto.randomUUID(),
                  name: `${propertyType[0].toUpperCase()}${propertyType.slice(1)} ${count}`,
                  type: propertyType,
                  ...(propertyType === "select"
                    ? { options: ["Option 1", "Option 2"] }
                    : {}),
                },
              ],
            });
          }}
        >
          Add property
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
