import { describe, expect, it } from "vitest";
import {
  changeColumnType,
  insertRowCopy,
  moveColumn,
  moveRow,
  readDatabaseState,
  removeColumn,
  removeRow,
  setSelectOptions,
  type DatabaseState,
} from "../../packages/database/model";

const base = (): DatabaseState => ({
  columns: [
    { id: "kind", name: "Kind", type: "text" },
    { id: "n", name: "N", type: "text" },
    { id: "status", name: "Status", type: "select", options: ["Open", "Done"] },
    { id: "ok", name: "OK", type: "checkbox" },
  ],
  rows: [
    {
      id: "r1",
      href: "#/page/p1",
      title: "One",
      values: { kind: "Weekly", n: "1,200", status: "Open", ok: true },
    },
    {
      id: "r2",
      href: "#/page/p2",
      title: "Two",
      values: { kind: "1:1", n: "abc", status: "Done", ok: false },
    },
    { id: "r3", href: "#/page/p3", title: "Three", values: { kind: "Weekly" } },
  ],
});
// every operation must produce state the validator still accepts
const valid = (s: DatabaseState) =>
  readDatabaseState(JSON.stringify(s.columns), JSON.stringify(s.rows));

describe("database schema and row operations", () => {
  it("converts text to select using the existing distinct values as options", () => {
    const s = valid(changeColumnType(base(), "kind", "select"));
    expect(s.columns[0]).toEqual({
      id: "kind",
      name: "Kind",
      type: "select",
      options: ["Weekly", "1:1"],
    });
    expect(s.rows.map((r) => r.values.kind)).toEqual([
      "Weekly",
      "1:1",
      "Weekly",
    ]);
  });

  it("converts text to number and drops what does not parse", () => {
    const s = valid(changeColumnType(base(), "n", "number"));
    expect(s.rows[0].values.n).toBe(1200);
    expect("n" in s.rows[1].values).toBe(false);
  });

  it("converts checkbox to text and select to checkbox-free text", () => {
    const s = valid(changeColumnType(base(), "ok", "text"));
    expect(s.rows.map((r) => r.values.ok)).toEqual(["Yes", "No", undefined]);
    const t = valid(changeColumnType(base(), "status", "text"));
    expect(t.columns[2].options).toBeUndefined();
    expect(t.rows[1].values.status).toBe("Done");
  });

  it("renames options with their values and clears values of removed options", () => {
    const renamed = valid(
      setSelectOptions(base(), "status", ["Todo", "Done", "Later"], {
        Open: "Todo",
      }),
    );
    expect(renamed.columns[2].options).toEqual(["Todo", "Done", "Later"]);
    expect(renamed.rows[0].values.status).toBe("Todo");
    const removed = valid(setSelectOptions(base(), "status", ["Open"]));
    expect("status" in removed.rows[1].values).toBe(false);
    expect(() => setSelectOptions(base(), "status", ["  "])).toThrow();
  });

  it("moves and removes properties and rows", () => {
    expect(moveColumn(base(), "status", -1).columns.map((c) => c.id)).toEqual([
      "kind",
      "status",
      "n",
      "ok",
    ]);
    expect(moveColumn(base(), "kind", -1).columns[0].id).toBe("kind"); // already first
    const removed = valid(removeColumn(base(), "n"));
    expect(removed.columns.map((c) => c.id)).toEqual(["kind", "status", "ok"]);
    expect(removed.rows.every((r) => !("n" in r.values))).toBe(true);
    expect(moveRow(base(), "r3", -2).rows.map((r) => r.id)).toEqual([
      "r3",
      "r1",
      "r2",
    ]);
    expect(removeRow(base(), "r2").rows.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("inserts a copied row right after the original with the same values", () => {
    const s = valid(
      insertRowCopy(base(), "r1", {
        id: "r9",
        href: "#/page/p9",
        title: "One (copy)",
      }),
    );
    expect(s.rows.map((r) => r.id)).toEqual(["r1", "r9", "r2", "r3"]);
    expect(s.rows[1].values).toEqual(s.rows[0].values);
    expect(s.rows[1].values).not.toBe(s.rows[0].values);
  });
});
