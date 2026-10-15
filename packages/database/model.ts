export const DATABASE_PROPERTY_TYPES = [
  "text",
  "number",
  "select",
  "checkbox",
  "date",
] as const;

export type DatabasePropertyType = (typeof DATABASE_PROPERTY_TYPES)[number];
export type DatabaseValue = string | number | boolean | null;
export type DatabaseColumn = {
  id: string;
  name: string;
  type: DatabasePropertyType;
  options?: string[];
};
export type DatabaseRow = {
  id: string;
  href: string;
  title: string;
  values: Record<string, DatabaseValue>;
};
export type DatabaseState = {
  columns: DatabaseColumn[];
  rows: DatabaseRow[];
};

export const DEFAULT_DATABASE_COLUMNS: DatabaseColumn[] = [
  {
    id: "status",
    name: "Status",
    type: "select",
    options: ["Not started", "In progress", "Done"],
  },
  { id: "done", name: "Done", type: "checkbox" },
  { id: "due", name: "Due", type: "date" },
  { id: "estimate", name: "Estimate", type: "number" },
  { id: "notes", name: "Notes", type: "text" },
];

export const DEFAULT_DATABASE_COLUMNS_JSON = JSON.stringify(
  DEFAULT_DATABASE_COLUMNS,
);
export const DEFAULT_DATABASE_ROWS_JSON = "[]";

const identifier = /^[a-zA-Z0-9_-]{1,100}$/;

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

export function readDatabaseState(
  columnsSource: unknown,
  rowsSource: unknown,
): DatabaseState {
  if (
    typeof columnsSource !== "string" ||
    typeof rowsSource !== "string" ||
    columnsSource.length > 20_000 ||
    rowsSource.length > 500_000
  )
    throw new Error("Invalid database storage");
  let columns: unknown;
  let rows: unknown;
  try {
    columns = JSON.parse(columnsSource);
    rows = JSON.parse(rowsSource);
  } catch {
    throw new Error("Invalid database JSON");
  }
  if (!Array.isArray(columns) || columns.length > 20)
    throw new Error("Invalid database properties");
  if (!Array.isArray(rows) || rows.length > 500)
    throw new Error("Invalid database rows");
  const columnIds = new Set<string>();
  for (const value of columns) {
    const column = value as DatabaseColumn;
    if (
      !column ||
      typeof column !== "object" ||
      !identifier.test(column.id) ||
      columnIds.has(column.id) ||
      typeof column.name !== "string" ||
      column.name.length > 100 ||
      !DATABASE_PROPERTY_TYPES.includes(column.type)
    )
      throw new Error("Invalid database property");
    columnIds.add(column.id);
    if (column.type === "select") {
      if (
        !Array.isArray(column.options) ||
        column.options.length > 20 ||
        column.options.some(
          (option) =>
            typeof option !== "string" || !option.trim() || option.length > 100,
        ) ||
        new Set(column.options).size !== column.options.length
      )
        throw new Error("Invalid database select options");
    } else if (column.options !== undefined) {
      throw new Error("Only select properties can have options");
    }
  }
  const rowIds = new Set<string>();
  for (const value of rows) {
    const row = value as DatabaseRow;
    if (
      !row ||
      typeof row !== "object" ||
      !identifier.test(row.id) ||
      rowIds.has(row.id) ||
      !/^#\/page\/[a-zA-Z0-9_-]{1,100}$/.test(row.href) ||
      typeof row.title !== "string" ||
      row.title.length > 500 ||
      !row.values ||
      typeof row.values !== "object" ||
      Array.isArray(row.values)
    )
      throw new Error("Invalid database row");
    rowIds.add(row.id);
    for (const [columnId, cell] of Object.entries(row.values)) {
      const column = columns.find(
        (candidate) => (candidate as DatabaseColumn).id === columnId,
      ) as DatabaseColumn | undefined;
      if (!column) throw new Error("Unknown database property value");
      const valid =
        cell === null ||
        (column.type === "text" &&
          typeof cell === "string" &&
          cell.length <= 500) ||
        (column.type === "number" &&
          typeof cell === "number" &&
          Number.isFinite(cell)) ||
        (column.type === "select" &&
          typeof cell === "string" &&
          (cell === "" || column.options!.includes(cell))) ||
        (column.type === "checkbox" && typeof cell === "boolean") ||
        (column.type === "date" &&
          typeof cell === "string" &&
          (cell === "" || isIsoDate(cell)));
      if (!valid) throw new Error("Invalid typed database value");
    }
  }
  return {
    columns: structuredClone(columns) as DatabaseColumn[],
    rows: structuredClone(rows) as DatabaseRow[],
  };
}

export function databaseText(state: DatabaseState): string {
  return [
    ["Page", ...state.columns.map((column) => column.name)].join("\t"),
    ...state.rows.map((row) =>
      [
        row.title,
        ...state.columns.map((column) => {
          const value = row.values[column.id];
          if (column.type === "checkbox") return value ? "Yes" : "No";
          return value === null || value === undefined ? "" : String(value);
        }),
      ].join("\t"),
    ),
  ].join("\n");
}

/* ---------- schema and row operations (pure; the block saves the result) ---------- */

const MAX_OPTIONS = 20;

function convertValue(
  value: DatabaseValue | undefined,
  from: DatabasePropertyType,
  to: DatabasePropertyType,
  options: string[],
): DatabaseValue {
  if (value === undefined || value === null || value === "") return null;
  const asText =
    from === "checkbox" ? (value ? "Yes" : "No") : String(value).trim();
  switch (to) {
    case "text":
      return asText.slice(0, 500);
    case "number": {
      if (from === "checkbox") return value ? 1 : 0;
      const n = Number(asText.replace(/,/g, ""));
      return asText !== "" && Number.isFinite(n) ? n : null;
    }
    case "checkbox":
      if (from === "checkbox") return value as boolean;
      return /^(yes|true|1|y|✓|done|o)$/i.test(asText);
    case "date":
      return isIsoDate(asText) ? asText : null;
    case "select":
      return options.includes(asText) ? asText : null;
  }
}

/** Change a property's type, converting every value that has a meaningful equivalent. */
export function changeColumnType(
  state: DatabaseState,
  columnId: string,
  type: DatabasePropertyType,
): DatabaseState {
  const column = state.columns.find((c) => c.id === columnId);
  if (!column || column.type === type) return state;
  let options: string[] = [];
  if (type === "select") {
    // keep existing distinct values as options (bounded)
    const seen = new Set<string>();
    for (const row of state.rows) {
      const value = convertValue(row.values[columnId], column.type, "text", []);
      if (typeof value === "string" && value && !seen.has(value))
        seen.add(value);
    }
    options = [...seen].map((o) => o.slice(0, 100)).slice(0, MAX_OPTIONS);
    if (!options.length) options = ["Option 1", "Option 2"];
  }
  const next: DatabaseColumn = { id: column.id, name: column.name, type };
  if (type === "select") next.options = options;
  return {
    columns: state.columns.map((c) => (c.id === columnId ? next : c)),
    rows: state.rows.map((row) => {
      const values = { ...row.values };
      const converted = convertValue(
        values[columnId],
        column.type,
        type,
        options,
      );
      if (converted === null) delete values[columnId];
      else values[columnId] = converted;
      return { ...row, values };
    }),
  };
}

/**
 * Replace a select property's options. `renames` maps old option → new option so
 * existing values follow a rename; values of removed options are cleared.
 */
export function setSelectOptions(
  state: DatabaseState,
  columnId: string,
  options: string[],
  renames: Record<string, string> = {},
): DatabaseState {
  const column = state.columns.find((c) => c.id === columnId);
  if (!column || column.type !== "select") return state;
  const clean = [
    ...new Set(options.map((o) => o.trim().slice(0, 100)).filter(Boolean)),
  ].slice(0, MAX_OPTIONS);
  if (!clean.length)
    throw new Error("A select property needs at least one option");
  return {
    columns: state.columns.map((c) =>
      c.id === columnId ? { ...c, options: clean } : c,
    ),
    rows: state.rows.map((row) => {
      const current = row.values[columnId];
      if (typeof current !== "string" || current === "") return row;
      const renamed = renames[current] ?? current;
      const values = { ...row.values };
      if (clean.includes(renamed)) values[columnId] = renamed;
      else delete values[columnId];
      return { ...row, values };
    }),
  };
}

export function removeColumn(
  state: DatabaseState,
  columnId: string,
): DatabaseState {
  return {
    columns: state.columns.filter((c) => c.id !== columnId),
    rows: state.rows.map((row) => {
      if (!(columnId in row.values)) return row;
      const values = { ...row.values };
      delete values[columnId];
      return { ...row, values };
    }),
  };
}

function move<T extends { id: string }>(
  items: T[],
  id: string,
  delta: number,
): T[] {
  const from = items.findIndex((item) => item.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function moveColumn(
  state: DatabaseState,
  columnId: string,
  delta: number,
): DatabaseState {
  return { ...state, columns: move(state.columns, columnId, delta) };
}

export function moveRow(
  state: DatabaseState,
  rowId: string,
  delta: number,
): DatabaseState {
  return { ...state, rows: move(state.rows, rowId, delta) };
}

export function removeRow(state: DatabaseState, rowId: string): DatabaseState {
  return { ...state, rows: state.rows.filter((row) => row.id !== rowId) };
}

/** Insert a reference to a copied row page right after the original, with the same values. */
export function insertRowCopy(
  state: DatabaseState,
  rowId: string,
  copy: { id: string; href: string; title: string },
): DatabaseState {
  const index = state.rows.findIndex((row) => row.id === rowId);
  if (index < 0 || state.rows.length >= 500) return state;
  const rows = [...state.rows];
  rows.splice(index + 1, 0, {
    ...copy,
    values: structuredClone(state.rows[index].values),
  });
  return { ...state, rows };
}
