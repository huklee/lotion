import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Document, TreeNode } from "../../packages/document-schema/index";
import {
  DATABASE_PROPERTY_TYPES,
  DEFAULT_DATABASE_COLUMNS_JSON,
  DEFAULT_DATABASE_ROWS_JSON,
  readDatabaseState,
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
  const [adding, setAdding] = useState(false);
  const [propertyType, setPropertyType] =
    useState<DatabasePropertyType>("text");
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
      <div className="lotion-database-scroll">
        <table>
          <thead>
            <tr>
              <th>Page</th>
              {state.columns.map((column) => (
                <th key={column.id}>
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
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => {
              const id = pageId(row.href);
              const page = actions?.pages.find(
                (candidate) => candidate.id === id,
              );
              const title = (page?.title ?? row.title) || "Untitled row";
              return (
                <tr key={row.id}>
                  <th>
                    <button
                      type="button"
                      disabled={!id || !page || !actions}
                      onClick={() => id && actions?.openPage(id)}
                    >
                      {page?.icon ?? "📄"} {title}
                    </button>
                  </th>
                  {state.columns.map((column) => {
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
              .then((page) =>
                update({
                  ...state,
                  rows: [
                    ...state.rows,
                    {
                      id: crypto.randomUUID(),
                      href: `#/page/${page.id}`,
                      title: page.title,
                      values: {},
                    },
                  ],
                }),
              )
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
