import { useState } from "react";
import { Floating } from "./DatabaseMenus";
import type { DatabaseColumn } from "../../packages/database/model";
import {
  FILTER_OPS,
  MAX_VIEWS,
  NO_VALUE_OPS,
  TITLE_COLUMN,
  defaultView,
  type DatabaseView,
  type FilterOp,
  type FilterRule,
  type SortRule,
} from "../../packages/database/views";

const OP_LABEL: Record<string, string> = {
  contains: "contains",
  not_contains: "does not contain",
  is: "is",
  is_not: "is not",
  eq: "=",
  neq: "≠",
  gt: ">",
  lt: "<",
  before: "is before",
  after: "is after",
  on_or_before: "is on or before",
  on_or_after: "is on or after",
  today: "is today",
  this_week: "is this week",
  last_7_days: "is in the last 7 days",
  last_30_days: "is in the last 30 days",
  this_month: "is this month",
  checked: "is checked",
  unchecked: "is unchecked",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

type Field = {
  id: string;
  name: string;
  type: DatabaseColumn["type"];
  options?: string[];
};

function fieldsOf(columns: DatabaseColumn[]): Field[] {
  return [{ id: TITLE_COLUMN, name: "Page", type: "text" }, ...columns];
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

type Menu = "add" | "sort" | "filter" | "properties" | `view:${string}` | null;

/**
 * View tabs plus the Sort / Filter / Properties controls of the active view.
 * Every change is passed up as the complete new view list.
 */
export function DatabaseViewBar({
  views,
  active,
  columns,
  shown,
  total,
  onSelect,
  onChange,
}: {
  views: DatabaseView[];
  active: DatabaseView;
  columns: DatabaseColumn[];
  shown: number;
  total: number;
  onSelect: (id: string) => void;
  onChange: (views: DatabaseView[]) => void;
}) {
  const [menu, setMenu] = useState<{ kind: Menu; anchor: HTMLElement } | null>(
    null,
  );
  const fields = fieldsOf(columns);
  const close = () => setMenu(null);
  const toggle = (kind: Menu) => (event: React.MouseEvent<HTMLButtonElement>) =>
    setMenu(menu?.kind === kind ? null : { kind, anchor: event.currentTarget });
  const patch = (change: Partial<DatabaseView>) =>
    onChange(
      views.map((view) =>
        view.id === active.id ? { ...view, ...change } : view,
      ),
    );

  return (
    <div className="lotion-database-viewbar">
      <div
        className="lotion-database-tabs"
        role="tablist"
        aria-label="Database views"
      >
        {views.map((view) => (
          <span key={view.id} className="lotion-database-tab">
            <button
              type="button"
              role="tab"
              aria-selected={view.id === active.id}
              onClick={() => onSelect(view.id)}
            >
              {view.type === "feed" ? "☰" : "▦"} {view.name || "Untitled view"}
            </button>
            {view.id === active.id && (
              <button
                type="button"
                className="lotion-database-more"
                aria-label={`${view.name} view settings`}
                aria-expanded={menu?.kind === `view:${view.id}`}
                onClick={toggle(`view:${view.id}`)}
              >
                ⋯
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          className="lotion-database-more"
          aria-label="Add view"
          title="Add view"
          aria-expanded={menu?.kind === "add"}
          disabled={views.length >= MAX_VIEWS}
          onClick={toggle("add")}
        >
          +
        </button>
      </div>
      <div className="lotion-database-tools">
        {(active.filters.length > 0 || shown !== total) && (
          <small aria-live="polite">
            {shown} of {total}
          </small>
        )}
        <button
          type="button"
          aria-expanded={menu?.kind === "filter"}
          onClick={toggle("filter")}
        >
          Filter{active.filters.length ? ` (${active.filters.length})` : ""}
        </button>
        <button
          type="button"
          aria-expanded={menu?.kind === "sort"}
          onClick={toggle("sort")}
        >
          Sort{active.sort.length ? ` (${active.sort.length})` : ""}
        </button>
        <button
          type="button"
          aria-expanded={menu?.kind === "properties"}
          onClick={toggle("properties")}
        >
          Properties
          {active.hidden.length ? ` (${active.hidden.length} hidden)` : ""}
        </button>
      </div>

      {menu?.kind === "add" && (
        <Floating anchor={menu.anchor} label="Add view" onClose={close}>
          {(["table", "feed"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                const count = views.filter((v) => v.type === type).length + 1;
                const name = `${type === "feed" ? "Feed" : "Table"}${count > 1 ? ` ${count}` : ""}`;
                const date = columns.find((c) => c.type === "date");
                const view: DatabaseView = {
                  ...defaultView(type, name),
                  id: newId(),
                  // A feed reads newest first when there is a date to sort by.
                  sort:
                    type === "feed" && date
                      ? [{ columnId: date.id, direction: "desc" }]
                      : [],
                };
                onChange([...views, view]);
                onSelect(view.id);
                close();
              }}
            >
              {type === "feed"
                ? "☰ Feed — read entries one after another"
                : "▦ Table"}
            </button>
          ))}
        </Floating>
      )}

      {menu?.kind === `view:${active.id}` && (
        <Floating anchor={menu.anchor} label="View settings" onClose={close}>
          <label>
            View name
            <input
              maxLength={100}
              value={active.name}
              onChange={(event) =>
                patch({ name: event.target.value.slice(0, 100) })
              }
            />
          </label>
          <div className="lotion-database-menu-row">
            <button
              type="button"
              disabled={views.length >= MAX_VIEWS}
              onClick={() => {
                const copy = {
                  ...structuredClone(active),
                  id: newId(),
                  name: `${active.name} copy`,
                };
                const index = views.indexOf(active);
                onChange([
                  ...views.slice(0, index + 1),
                  copy,
                  ...views.slice(index + 1),
                ]);
                onSelect(copy.id);
                close();
              }}
            >
              Duplicate view
            </button>
            <button
              type="button"
              className="danger"
              disabled={views.length <= 1}
              onClick={() => {
                const rest = views.filter((view) => view.id !== active.id);
                onChange(rest);
                onSelect(rest[0].id);
                close();
              }}
            >
              Delete view
            </button>
          </div>
        </Floating>
      )}

      {menu?.kind === "sort" && (
        <Floating anchor={menu.anchor} label="Sort" onClose={close}>
          {active.sort.length === 0 && (
            <p className="lotion-database-hint">
              No sorts. Rows keep their manual order.
            </p>
          )}
          {active.sort.map((rule, index) => (
            <div className="lotion-database-menu-row" key={index}>
              <select
                aria-label={`Sort ${index + 1} property`}
                value={rule.columnId}
                onChange={(event) =>
                  patch({
                    sort: active.sort.map((r, i) =>
                      i === index ? { ...r, columnId: event.target.value } : r,
                    ),
                  })
                }
              >
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Sort ${index + 1} direction`}
                value={rule.direction}
                onChange={(event) =>
                  patch({
                    sort: active.sort.map((r, i) =>
                      i === index
                        ? {
                            ...r,
                            direction: event.target
                              .value as SortRule["direction"],
                          }
                        : r,
                    ),
                  })
                }
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <button
                type="button"
                aria-label={`Remove sort ${index + 1}`}
                onClick={() =>
                  patch({ sort: active.sort.filter((_, i) => i !== index) })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={active.sort.length >= 5}
            onClick={() => {
              const used = new Set(active.sort.map((r) => r.columnId));
              const field = fields.find((f) => !used.has(f.id)) ?? fields[0];
              patch({
                sort: [
                  ...active.sort,
                  { columnId: field.id, direction: "asc" },
                ],
              });
            }}
          >
            + Add sort
          </button>
        </Floating>
      )}

      {menu?.kind === "filter" && (
        <Floating anchor={menu.anchor} label="Filter" onClose={close}>
          {active.filters.length === 0 && (
            <p className="lotion-database-hint">
              No filters. All rows are shown.
            </p>
          )}
          {active.filters.map((rule, index) => (
            <FilterRow
              key={rule.id}
              index={index}
              rule={rule}
              fields={fields}
              onChange={(next) =>
                patch({
                  filters: active.filters.map((r) =>
                    r.id === rule.id ? next : r,
                  ),
                })
              }
              onRemove={() =>
                patch({
                  filters: active.filters.filter((r) => r.id !== rule.id),
                })
              }
            />
          ))}
          <button
            type="button"
            disabled={active.filters.length >= 10}
            onClick={() => {
              const field = fields.find((f) => f.type === "date") ?? fields[0];
              patch({
                filters: [
                  ...active.filters,
                  {
                    id: newId(),
                    columnId: field.id,
                    op: FILTER_OPS[field.type][0],
                  },
                ],
              });
            }}
          >
            + Add filter
          </button>
          {active.filters.length > 1 && (
            <p className="lotion-database-hint">
              Rows must match every filter.
            </p>
          )}
        </Floating>
      )}

      {menu?.kind === "properties" && (
        <Floating
          anchor={menu.anchor}
          label="Visible properties"
          onClose={close}
        >
          {columns.map((column) => (
            <label key={column.id} className="lotion-database-check">
              <input
                type="checkbox"
                checked={!active.hidden.includes(column.id)}
                onChange={(event) =>
                  patch({
                    hidden: event.target.checked
                      ? active.hidden.filter((id) => id !== column.id)
                      : [...active.hidden, column.id],
                  })
                }
              />
              {column.name || "Untitled property"}
            </label>
          ))}
          <div className="lotion-database-menu-row">
            <button type="button" onClick={() => patch({ hidden: [] })}>
              Show all
            </button>
            <button
              type="button"
              onClick={() => patch({ hidden: columns.map((c) => c.id) })}
            >
              Hide all
            </button>
          </div>
        </Floating>
      )}
    </div>
  );
}

function FilterRow({
  index,
  rule,
  fields,
  onChange,
  onRemove,
}: {
  index: number;
  rule: FilterRule;
  fields: Field[];
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.id === rule.columnId) ?? fields[0];
  const ops = FILTER_OPS[field.type] as readonly FilterOp[];
  const n = index + 1;
  return (
    <fieldset className="lotion-database-filter">
      <div className="lotion-database-menu-row">
        <select
          aria-label={`Filter ${n} property`}
          value={field.id}
          onChange={(event) => {
            const next =
              fields.find((f) => f.id === event.target.value) ?? fields[0];
            onChange({
              id: rule.id,
              columnId: next.id,
              op: FILTER_OPS[next.type][0],
            });
          }}
        >
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          aria-label={`Filter ${n} condition`}
          value={rule.op}
          onChange={(event) => {
            const op = event.target.value as FilterOp;
            onChange(
              NO_VALUE_OPS.has(op)
                ? { id: rule.id, columnId: rule.columnId, op }
                : { ...rule, op },
            );
          }}
        >
          {ops.map((op) => (
            <option key={op} value={op}>
              {OP_LABEL[op]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Remove filter ${n}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
      {!NO_VALUE_OPS.has(rule.op) &&
        (field.type === "select" ? (
          <select
            aria-label={`Filter ${n} value`}
            value={rule.value ?? ""}
            onChange={(event) =>
              onChange({ ...rule, value: event.target.value })
            }
          >
            <option value="">Choose an option</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label={`Filter ${n} value`}
            type={
              field.type === "date"
                ? "date"
                : field.type === "number"
                  ? "number"
                  : "text"
            }
            maxLength={500}
            value={rule.value ?? ""}
            onChange={(event) =>
              onChange({ ...rule, value: event.target.value })
            }
          />
        ))}
    </fieldset>
  );
}
