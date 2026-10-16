import { useState, type ReactNode } from "react";
import { Ellipsis, Plus } from "lucide-react";
import type { TreeNode } from "../../packages/document-schema/index";
import {
  DATABASE_PROPERTY_TYPES,
  type DatabaseColumn,
  type DatabasePropertyType,
  type DatabaseRow,
  type DatabaseState,
  type DatabaseValue,
} from "../../packages/database/model";
import { Floating, PropertyMenu } from "./DatabaseMenus";
import { TYPE_NAMES, TypeIcon, optionColor, pillStyle } from "./database-ui";

export type RowInfo = {
  row: DatabaseRow;
  pageId: string | null;
  page: TreeNode | undefined;
  title: string;
};

type Menu =
  | { kind: "property"; id: string; anchor: HTMLElement }
  | { kind: "add"; anchor: HTMLElement }
  | { kind: "row"; id: string; anchor: HTMLElement }
  | null;

function Cell({
  column,
  value,
  label,
  onChange,
}: {
  column: DatabaseColumn;
  value: DatabaseValue | undefined;
  label: string;
  onChange: (value: DatabaseValue) => void;
}) {
  if (column.type === "checkbox")
    return (
      <input
        type="checkbox"
        className="ldb-check"
        aria-label={label}
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  if (column.type === "select") {
    const text = String(value ?? "");
    return (
      <select
        aria-label={label}
        className={`ldb-pill-select${text ? " filled" : ""}`}
        style={text ? pillStyle(optionColor(column.options, text)) : undefined}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">—</option>
        {column.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={`ldb-cell-input ldb-${column.type}`}
      type={
        column.type === "date"
          ? "date"
          : column.type === "number"
            ? "number"
            : "text"
      }
      aria-label={label}
      maxLength={column.type === "text" ? 500 : undefined}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(event) =>
        onChange(
          column.type === "number"
            ? event.target.value === ""
              ? null
              : Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

/**
 * Notion-style table: typed headers that open a property menu, a "+" header to add
 * properties, plain-looking cells, row checkbox and actions on hover, "+ New" footer.
 */
export function DatabaseTable({
  state,
  columns,
  rows,
  selected,
  onToggle,
  onToggleAll,
  update,
  setValue,
  openRow,
  addRow,
  adding,
  canAdd,
  emptyText,
  renderRowMenu,
  view,
}: {
  state: DatabaseState;
  columns: DatabaseColumn[];
  rows: RowInfo[];
  selected: Set<string>;
  onToggle: (rowId: string) => void;
  onToggleAll: (checked: boolean) => void;
  update: (next: DatabaseState) => void;
  setValue: (
    row: DatabaseRow,
    column: DatabaseColumn,
    value: DatabaseValue,
  ) => void;
  openRow: (info: RowInfo) => void;
  addRow: () => void;
  adding: boolean;
  canAdd: boolean;
  emptyText: string;
  renderRowMenu: (
    info: RowInfo,
    anchor: HTMLElement,
    close: () => void,
  ) => ReactNode;
  view: {
    sort: (columnId: string, direction: "asc" | "desc") => void;
    filter: (columnId: string) => void;
    hide: (columnId: string) => void;
  };
}) {
  const [menu, setMenu] = useState<Menu>(null);
  const close = () => setMenu(null);
  const allChecked =
    rows.length > 0 && rows.every((r) => selected.has(r.row.id));
  const selecting = selected.size > 0;
  const addProperty = (type: DatabasePropertyType, anchor: HTMLElement) => {
    const count = state.columns.filter((c) => c.type === type).length + 1;
    const column: DatabaseColumn = {
      id: crypto.randomUUID(),
      name: `${TYPE_NAMES[type]} ${count}`,
      type,
      ...(type === "select" ? { options: ["Option 1", "Option 2"] } : {}),
    };
    update({ ...state, columns: [...state.columns, column] });
    // continue in the new property's menu (rename, options)
    setMenu({ kind: "property", id: column.id, anchor });
  };
  const menuColumn =
    menu?.kind === "property"
      ? state.columns.find((c) => c.id === menu.id)
      : undefined;

  return (
    <div className={`ldb-table-wrap${selecting ? " selecting" : ""}`}>
      <div className="lotion-database-scroll">
        <table className="ldb-table">
          <thead>
            <tr>
              <th className="ldb-gutter">
                <input
                  type="checkbox"
                  className="lotion-database-select"
                  aria-label="Select all shown rows"
                  checked={allChecked}
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </th>
              <th className="ldb-th ldb-th-title">
                <span className="ldb-th-label">
                  <TypeIcon type="title" /> Page
                </span>
              </th>
              {columns.map((column) => (
                <th key={column.id} className="ldb-th lotion-database-property">
                  <button
                    type="button"
                    className="ldb-th-button"
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
                    <TypeIcon type={column.type} />
                    <span>{column.name || "Untitled"}</span>
                  </button>
                </th>
              ))}
              <th className="ldb-th ldb-th-add">
                <button
                  type="button"
                  className="ldb-icon-button"
                  aria-label="Add a property"
                  title="Add a property"
                  disabled={state.columns.length >= 20}
                  aria-expanded={menu?.kind === "add"}
                  onClick={(event) =>
                    setMenu(
                      menu?.kind === "add"
                        ? null
                        : { kind: "add", anchor: event.currentTarget },
                    )
                  }
                >
                  <Plus size={15} aria-hidden />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td />
                <td
                  className="lotion-database-empty"
                  colSpan={columns.length + 2}
                >
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map((info) => {
              const { row, page, title } = info;
              const isSelected = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={isSelected ? "selected" : undefined}
                >
                  <td className="ldb-gutter">
                    <input
                      type="checkbox"
                      className="lotion-database-select"
                      aria-label={`Select ${title}`}
                      checked={isSelected}
                      onChange={() => onToggle(row.id)}
                    />
                  </td>
                  <th className="lotion-database-row-title ldb-title-cell">
                    <button
                      type="button"
                      className="ldb-title"
                      disabled={!info.pageId || !page}
                      onClick={() => openRow(info)}
                      title="Open as a page"
                    >
                      {page?.icon ?? "📄"} {title}
                    </button>
                    <button
                      type="button"
                      className="lotion-database-more ldb-row-more"
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
                      <Ellipsis size={15} aria-hidden />
                    </button>
                    {menu?.kind === "row" &&
                      menu.id === row.id &&
                      renderRowMenu(info, menu.anchor, close)}
                  </th>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`ldb-td ldb-td-${column.type}`}
                    >
                      <Cell
                        column={column}
                        value={row.values[column.id]}
                        label={`${column.name} for ${title}`}
                        onChange={(value) => setValue(row, column, value)}
                      />
                    </td>
                  ))}
                  <td className="ldb-td-filler" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="ldb-new-row"
        aria-label="Add a row"
        disabled={!canAdd || adding}
        onClick={addRow}
      >
        <Plus size={15} aria-hidden /> {adding ? "Creating…" : "New"}
      </button>
      <div className="ldb-count" aria-live="polite">
        <span>Count</span> {rows.length}
      </div>
      {menu?.kind === "add" && (
        <Floating anchor={menu.anchor} label="Add a property" onClose={close}>
          <p className="lotion-database-hint">Property type</p>
          <div className="ldb-menu-list">
            {DATABASE_PROPERTY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addProperty(type, menu.anchor)}
              >
                <TypeIcon type={type} /> {TYPE_NAMES[type]}
              </button>
            ))}
          </div>
        </Floating>
      )}
      {menu?.kind === "property" && menuColumn && (
        <PropertyMenu
          anchor={menu.anchor}
          column={menuColumn}
          state={state}
          index={state.columns.indexOf(menuColumn)}
          update={update}
          onClose={close}
          view={{
            sort: (direction) => {
              view.sort(menuColumn.id, direction);
              close();
            },
            filter: () => {
              close();
              view.filter(menuColumn.id);
            },
            hide: () => {
              view.hide(menuColumn.id);
              close();
            },
          }}
        />
      )}
    </div>
  );
}
