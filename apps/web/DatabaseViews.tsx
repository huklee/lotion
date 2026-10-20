import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileText,
  ListFilter,
  Rows3,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";
import { Floating } from "./DatabaseMenus";
import { SummarySettingsForm } from "./summaries";
import type { DatabaseColumn } from "../../packages/database/model";
import {
  FILTER_OPS,
  MAX_VIEWS,
  NO_VALUE_OPS,
  TITLE_COLUMN,
  datePreset,
  defaultView,
  withDatePreset,
  type DatabaseView,
  type DatePreset,
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

type Menu =
  | "summary"
  | "add"
  | "sort"
  | "filter"
  | "properties"
  | `view:${string}`
  | null;

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
  query,
  onQuery,
  primary,
  filterRequest,
  meetings = false,
  onVariant,
}: {
  views: DatabaseView[];
  active: DatabaseView;
  columns: DatabaseColumn[];
  shown: number;
  total: number;
  onSelect: (id: string) => void;
  onChange: (views: DatabaseView[]) => void;
  /** Quick search (not saved with the view). */
  query: string;
  onQuery: (query: string) => void;
  /** The "New" button. */
  primary?: React.ReactNode;
  /** Meeting logs (summary settings shown) or a basic database. */
  meetings?: boolean;
  onVariant?: (variant: "" | "meetings") => void;
  /** Bumped by the table to open the filter editor (e.g. "Filter by this property"). */
  filterRequest?: number;
}) {
  const [menu, setMenu] = useState<{ kind: Menu; anchor: HTMLElement } | null>(
    null,
  );
  const filterButton = useRef<HTMLButtonElement>(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (filterRequest && filterButton.current)
      setMenu({ kind: "filter", anchor: filterButton.current });
  }, [filterRequest]);
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
              {view.type === "feed" ? (
                <Rows3 size={14} aria-hidden />
              ) : (
                <Table2 size={14} aria-hidden />
              )}{" "}
              {view.name || "Untitled view"}
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
        {columns.some((c) => c.type === "date") && (
          <select
            className="lotion-database-period"
            aria-label="Period"
            value={datePreset(active) ?? ""}
            onChange={(event) =>
              onChange(
                views.map((view) =>
                  view.id === active.id
                    ? withDatePreset(
                        view,
                        columns,
                        (event.target.value || null) as DatePreset | null,
                      )
                    : view,
                ),
              )
            }
          >
            <option value="">All dates</option>
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="this_month">This month</option>
          </select>
        )}
        {(active.filters.length > 0 || shown !== total) && (
          <small aria-live="polite">
            {shown} of {total}
          </small>
        )}
        <button
          ref={filterButton}
          type="button"
          className={active.filters.length ? "on" : undefined}
          aria-expanded={menu?.kind === "filter"}
          onClick={toggle("filter")}
        >
          <ListFilter size={14} aria-hidden />
          Filter{active.filters.length ? ` (${active.filters.length})` : ""}
        </button>
        <button
          type="button"
          className={active.sort.length ? "on" : undefined}
          aria-expanded={menu?.kind === "sort"}
          onClick={toggle("sort")}
        >
          <ArrowUpDown size={14} aria-hidden />
          Sort{active.sort.length ? ` (${active.sort.length})` : ""}
        </button>
        {searching || query ? (
          <input
            className="ldb-search"
            type="search"
            aria-label="Search this database"
            placeholder="Search…"
            autoFocus={!query}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onBlur={() => !query && setSearching(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onQuery("");
                setSearching(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            aria-label="Search"
            title="Search"
            onClick={() => setSearching(true)}
          >
            <Search size={14} aria-hidden />
          </button>
        )}
        <button
          type="button"
          className={active.hidden.length ? "on" : undefined}
          aria-label={`Properties${active.hidden.length ? ` (${active.hidden.length} hidden)` : ""}`}
          title="Visible properties"
          aria-expanded={menu?.kind === "properties"}
          onClick={toggle("properties")}
        >
          <SlidersHorizontal size={14} aria-hidden />
        </button>
        {meetings && (
          <button
            type="button"
            aria-label="Summary settings"
            title="Summary settings: engine, format, skill, Slack channel"
            aria-expanded={menu?.kind === "summary"}
            onClick={toggle("summary")}
          >
            <FileText size={14} aria-hidden />
          </button>
        )}
        {primary}
      </div>
      {(active.filters.length > 0 || active.sort.length > 0) && (
        <div className="ldb-rules" aria-label="Active sorts and filters">
          {active.sort.map((rule, index) => {
            const field = fields.find((f) => f.id === rule.columnId);
            return (
              <span key={`s${index}`} className="ldb-chip">
                <button
                  type="button"
                  onClick={(event) =>
                    setMenu({ kind: "sort", anchor: event.currentTarget })
                  }
                >
                  {rule.direction === "asc" ? (
                    <ArrowUp size={12} aria-hidden />
                  ) : (
                    <ArrowDown size={12} aria-hidden />
                  )}{" "}
                  {field?.name ?? "?"}
                </button>
                <button
                  type="button"
                  aria-label={`Remove sort by ${field?.name ?? ""}`}
                  onClick={() =>
                    patch({ sort: active.sort.filter((_, i) => i !== index) })
                  }
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            );
          })}
          {active.filters.map((rule) => {
            const field = fields.find((f) => f.id === rule.columnId);
            const value = NO_VALUE_OPS.has(rule.op) ? "" : (rule.value ?? "…");
            return (
              <span key={rule.id} className="ldb-chip">
                <button
                  type="button"
                  onClick={(event) =>
                    setMenu({ kind: "filter", anchor: event.currentTarget })
                  }
                >
                  <strong>{field?.name ?? "?"}</strong> {OP_LABEL[rule.op]}{" "}
                  {value}
                </button>
                <button
                  type="button"
                  aria-label={`Remove filter on ${field?.name ?? ""}`}
                  onClick={() =>
                    patch({
                      filters: active.filters.filter((r) => r.id !== rule.id),
                    })
                  }
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {menu?.kind === "summary" && (
        <Floating anchor={menu.anchor} label="Summary settings" onClose={close}>
          <SummarySettingsForm />
        </Floating>
      )}

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
          {onVariant && (
            <label>
              Database type
              <select
                aria-label="Database type"
                value={meetings ? "meetings" : ""}
                onChange={(event) =>
                  onVariant(event.target.value as "" | "meetings")
                }
              >
                <option value="">Database</option>
                <option value="meetings">
                  Meeting logs — new meeting, summaries
                </option>
              </select>
            </label>
          )}
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
