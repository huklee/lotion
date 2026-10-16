import type {
  DatabaseColumn,
  DatabaseRow,
  DatabaseState,
  DatabaseValue,
} from "./model";

/** The implicit page-title column, addressable by sorts and filters. */
export const TITLE_COLUMN = "title";

export type SortRule = { columnId: string; direction: "asc" | "desc" };

export const FILTER_OPS = {
  text: ["contains", "not_contains", "is", "is_empty", "is_not_empty"],
  number: ["eq", "neq", "gt", "lt", "is_empty", "is_not_empty"],
  select: ["is", "is_not", "is_empty", "is_not_empty"],
  checkbox: ["checked", "unchecked"],
  date: [
    "is",
    "before",
    "after",
    "on_or_before",
    "on_or_after",
    "today",
    "this_week",
    "last_7_days",
    "last_30_days",
    "this_month",
    "is_empty",
    "is_not_empty",
  ],
} as const;
export type FilterOp = (typeof FILTER_OPS)[keyof typeof FILTER_OPS][number];
/** Operators that take no value. */
export const NO_VALUE_OPS = new Set<string>([
  "is_empty",
  "is_not_empty",
  "checked",
  "unchecked",
  "today",
  "this_week",
  "last_7_days",
  "last_30_days",
  "this_month",
]);

export type FilterRule = {
  id: string;
  columnId: string;
  op: FilterOp;
  value?: string;
};

export type ViewType = "table" | "feed";
export type DatabaseView = {
  id: string;
  name: string;
  type: ViewType;
  sort: SortRule[];
  filters: FilterRule[];
  /** Property ids hidden in this view. */
  hidden: string[];
};

export const MAX_VIEWS = 20;
const MAX_SORTS = 5;
const MAX_FILTERS = 10;
const identifier = /^[a-zA-Z0-9_-]{1,100}$/;

export function defaultView(
  type: ViewType = "table",
  name = type === "feed" ? "Feed" : "Table",
): DatabaseView {
  return {
    id:
      type === "table"
        ? "default"
        : `view-${Math.random().toString(36).slice(2, 10)}`,
    name,
    type,
    sort: [],
    filters: [],
    hidden: [],
  };
}

function columnType(columns: DatabaseColumn[], id: string) {
  if (id === TITLE_COLUMN) return "text" as const;
  return columns.find((c) => c.id === id)?.type;
}

/**
 * Parse stored views. Missing or empty storage yields one default table view.
 * Rules that point at deleted properties are dropped instead of failing, so a
 * property deletion never invalidates the block.
 */
export function readViews(
  source: unknown,
  columns: DatabaseColumn[],
): DatabaseView[] {
  if (source === undefined || source === null || source === "")
    return [defaultView()];
  if (typeof source !== "string" || source.length > 50_000)
    throw new Error("Invalid database views");
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Invalid database views JSON");
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_VIEWS)
    throw new Error("Invalid database views");
  const ids = new Set<string>();
  const views: DatabaseView[] = [];
  for (const raw of parsed as Partial<DatabaseView>[]) {
    if (
      !raw ||
      typeof raw !== "object" ||
      !identifier.test(String(raw.id)) ||
      ids.has(String(raw.id)) ||
      typeof raw.name !== "string" ||
      raw.name.length > 100 ||
      (raw.type !== "table" && raw.type !== "feed") ||
      !Array.isArray(raw.sort) ||
      !Array.isArray(raw.filters) ||
      !Array.isArray(raw.hidden)
    )
      throw new Error("Invalid database view");
    ids.add(raw.id!);
    const sort = raw.sort
      .filter(
        (r) =>
          r &&
          columnType(columns, r.columnId) &&
          (r.direction === "asc" || r.direction === "desc"),
      )
      .slice(0, MAX_SORTS)
      .map((r) => ({ columnId: r.columnId, direction: r.direction }));
    const filters = raw.filters
      .filter((r) => {
        const type = r && columnType(columns, r.columnId);
        return (
          !!type &&
          identifier.test(String(r.id)) &&
          (FILTER_OPS[type] as readonly string[]).includes(r.op) &&
          (r.value === undefined ||
            (typeof r.value === "string" && r.value.length <= 500))
        );
      })
      .slice(0, MAX_FILTERS)
      .map((r) => ({
        id: r.id,
        columnId: r.columnId,
        op: r.op,
        ...(r.value !== undefined ? { value: r.value } : {}),
      }));
    const hidden = raw.hidden.filter(
      (h) => typeof h === "string" && columns.some((c) => c.id === h),
    );
    views.push({
      id: raw.id!,
      name: raw.name,
      type: raw.type,
      sort,
      filters,
      hidden,
    });
  }
  return views.length ? views : [defaultView()];
}

export function viewsJson(views: DatabaseView[]): string {
  return JSON.stringify(views);
}

/* ---------- evaluation ---------- */

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return isoDay(new Date(y, m - 1, d + n));
}

/** Inclusive [from, to] calendar range for relative date operators, in local time. */
export function relativeRange(
  op: string,
  today: Date,
): [string, string] | null {
  const t = isoDay(today);
  switch (op) {
    case "today":
      return [t, t];
    case "this_week": {
      const dow = (today.getDay() + 6) % 7; // Monday = 0
      const monday = addDays(t, -dow);
      return [monday, addDays(monday, 6)];
    }
    case "last_7_days":
      return [addDays(t, -6), t];
    case "last_30_days":
      return [addDays(t, -29), t];
    case "this_month":
      return [
        `${t.slice(0, 7)}-01`,
        addDays(
          `${isoDay(new Date(today.getFullYear(), today.getMonth() + 1, 1))}`,
          -1,
        ),
      ];
  }
  return null;
}

function cellOf(
  row: DatabaseRow,
  columnId: string,
  title: (row: DatabaseRow) => string,
): DatabaseValue | undefined {
  return columnId === TITLE_COLUMN ? title(row) : row.values[columnId];
}

function empty(value: DatabaseValue | undefined) {
  return value === undefined || value === null || value === "";
}

export function matches(
  row: DatabaseRow,
  rule: FilterRule,
  columns: DatabaseColumn[],
  title: (row: DatabaseRow) => string,
  today = new Date(),
): boolean {
  const type = columnType(columns, rule.columnId);
  const value = cellOf(row, rule.columnId, title);
  const v = rule.value ?? "";
  if (rule.op === "is_empty") return empty(value);
  if (rule.op === "is_not_empty") return !empty(value);
  switch (type) {
    case "checkbox":
      return rule.op === "checked" ? value === true : value !== true;
    case "number": {
      if (empty(value) || v === "" || !Number.isFinite(Number(v)))
        return v === "" && rule.op !== "eq";
      const a = Number(value),
        b = Number(v);
      return rule.op === "eq"
        ? a === b
        : rule.op === "neq"
          ? a !== b
          : rule.op === "gt"
            ? a > b
            : a < b;
    }
    case "select":
      return rule.op === "is" ? value === v : value !== v;
    case "date": {
      const range = relativeRange(rule.op, today);
      if (range)
        return (
          !empty(value) &&
          String(value) >= range[0] &&
          String(value) <= range[1]
        );
      if (empty(value)) return false;
      if (!v) return true; // incomplete rule: do not hide everything
      const d = String(value);
      return rule.op === "is"
        ? d === v
        : rule.op === "before"
          ? d < v
          : rule.op === "after"
            ? d > v
            : rule.op === "on_or_before"
              ? d <= v
              : d >= v;
    }
    default: {
      const text = String(value ?? "").toLowerCase();
      const needle = v.toLowerCase();
      if (rule.op === "is") return text === needle;
      if (!needle) return true;
      return rule.op === "contains"
        ? text.includes(needle)
        : !text.includes(needle);
    }
  }
}

function compare(
  a: DatabaseValue | undefined,
  b: DatabaseValue | undefined,
  type: string | undefined,
  options: string[] = [],
) {
  // empty values always last, whatever the direction (handled by caller)
  if (type === "number") return Number(a) - Number(b);
  if (type === "checkbox") return Number(a === true) - Number(b === true);
  if (type === "select")
    return options.indexOf(String(a)) - options.indexOf(String(b));
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/** Rows of `state` as `view` shows them: all filters (AND), then the sort rules in order. */
export function applyView(
  state: DatabaseState,
  view: DatabaseView,
  title: (row: DatabaseRow) => string = (row) => row.title,
  today = new Date(),
): DatabaseRow[] {
  const rows = state.rows.filter((row) =>
    view.filters.every((rule) =>
      matches(row, rule, state.columns, title, today),
    ),
  );
  if (!view.sort.length) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const rule of view.sort) {
        const column = state.columns.find((c) => c.id === rule.columnId);
        const type = rule.columnId === TITLE_COLUMN ? "text" : column?.type;
        const a = cellOf(x.row, rule.columnId, title);
        const b = cellOf(y.row, rule.columnId, title);
        if (empty(a) !== empty(b)) return empty(a) ? 1 : -1;
        if (empty(a)) continue;
        const c = compare(a, b, type, column?.options);
        if (c) return rule.direction === "asc" ? c : -c;
      }
      return x.index - y.index; // stable
    })
    .map(({ row }) => row);
}

/** Values a new row gets so it satisfies the view's simple equality filters (Notion-style). */
export function filterDefaults(
  view: DatabaseView,
  columns: DatabaseColumn[],
  today = new Date(),
): Record<string, DatabaseValue> {
  const values: Record<string, DatabaseValue> = {};
  for (const rule of view.filters) {
    const type = columnType(columns, rule.columnId);
    if (rule.columnId === TITLE_COLUMN || !type) continue;
    if (type === "checkbox" && rule.op === "checked")
      values[rule.columnId] = true;
    else if (type === "select" && rule.op === "is" && rule.value)
      values[rule.columnId] = rule.value;
    else if (type === "date" && rule.op === "is" && rule.value)
      values[rule.columnId] = rule.value;
    else if (type === "date" && relativeRange(rule.op, today))
      values[rule.columnId] = isoDay(today);
    else if (
      type === "number" &&
      rule.op === "eq" &&
      rule.value &&
      Number.isFinite(Number(rule.value))
    )
      values[rule.columnId] = Number(rule.value);
    else if (type === "text" && rule.op === "is" && rule.value)
      values[rule.columnId] = rule.value;
  }
  return values;
}

export const DATE_PRESETS = [
  "today",
  "this_week",
  "last_7_days",
  "last_30_days",
  "this_month",
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];
const PRESET_FILTER = "period";

/** The period preset currently applied to `view`, if any. */
export function datePreset(view: DatabaseView): DatePreset | null {
  const rule = view.filters.find((r) => r.id === PRESET_FILTER);
  return rule && (DATE_PRESETS as readonly string[]).includes(rule.op)
    ? (rule.op as DatePreset)
    : null;
}

/**
 * `view` limited to a period of its first date property (`null` removes the period).
 * The period is an ordinary, editable filter rule with a fixed id.
 */
export function withDatePreset(
  view: DatabaseView,
  columns: DatabaseColumn[],
  preset: DatePreset | null,
): DatabaseView {
  const others = view.filters.filter((r) => r.id !== PRESET_FILTER);
  const date = columns.find((c) => c.type === "date");
  if (!preset || !date) return { ...view, filters: others };
  const current = view.filters.find((r) => r.id === PRESET_FILTER);
  const rule: FilterRule = {
    id: PRESET_FILTER,
    columnId:
      current && columnType(columns, current.columnId) === "date"
        ? current.columnId
        : date.id,
    op: preset,
  };
  return { ...view, filters: [rule, ...others].slice(0, MAX_FILTERS) };
}
