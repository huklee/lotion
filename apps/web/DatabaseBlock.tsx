import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Document, TreeNode } from "../../packages/document-schema/index";
import { PropertyMenu, RowMenu } from "./DatabaseMenus";
import { DatabaseViewBar } from "./DatabaseViews";
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
    (change: (current: DatabaseState) => DatabaseState) => {
      const current = editor.getBlock(block.id);
      if (!current) return;
      let latest: DatabaseState;
      try {
        latest = readDatabaseState(current.props.columns, current.props.rows);
      } catch {
        return;
      }
      update(change(latest));
    },
    [block.id, editor, update],
  );

  useEffect(() => {
    if (!actions) return;
    let changed = false;
    const rows = state.rows.map((row) => {
      const id = pageId(row.href);
      const title = actions.pages.find((page) => page.id === id)?.title;
      if (!title || title === row.title) return row;
      changed = true;
      return { ...row, title };
    });
    if (changed) update({ ...state, rows });
  }, [actions, state, update]);

  const rowTitle = (row: DatabaseRow) => {
    const id = pageId(row.href);
    return actions?.pages.find((page) => page.id === id)?.title ?? row.title;
  };
  const shownRows = applyView(state, active, rowTitle);
  const shownColumns = state.columns.filter(
    (column) => !active.hidden.includes(column.id),
  );

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
    <section className="lotion-database" contentEditable={false}>
      <DatabaseViewBar
        views={views}
        active={active}
        columns={state.columns}
        shown={shownRows.length}
        total={state.rows.length}
        onSelect={selectView}
        onChange={updateViews}
      />
      <div className="lotion-database-scroll">
        <table>
          <thead>
            <tr>
              <th>Page</th>
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
                      aria-expanded={menu?.kind === "row" && menu.id === row.id}
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
                        canPage={!!id && !!page && !!actions?.duplicateRowPage}
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
                            type={column.type === "date" ? "date" : column.type}
                            aria-label={label}
                            maxLength={column.type === "text" ? 500 : undefined}
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
      <div className="lotion-database-actions">
        <button
          type="button"
          disabled={!actions || adding || state.rows.length >= 500}
          onClick={() => {
            if (!actions || adding) return;
            setAdding(true);
            setError("");
            void actions
              .createRowPage("Untitled row")
              .then((page) => {
                const values = filterDefaults(active, state.columns);
                updateLatest((latest) => ({
                  ...latest,
                  rows: [
                    ...latest.rows,
                    {
                      id: crypto.randomUUID(),
                      href: `#/page/${page.id}`,
                      title: page.title,
                      values,
                    },
                  ],
                }));
              })
              .catch((reason) => setError((reason as Error).message))
              .finally(() => setAdding(false));
          }}
        >
          {adding ? "Creating row…" : "New row page"}
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
