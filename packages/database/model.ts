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
