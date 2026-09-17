import { describe, expect, it } from "vitest";
import { databaseText, readDatabaseState } from "../../packages/database/model";

const columns = [
  { id: "status", name: "Status", type: "select", options: ["Open", "Done"] },
  { id: "done", name: "Done", type: "checkbox" },
  { id: "due", name: "Due", type: "date" },
  { id: "estimate", name: "Estimate", type: "number" },
  { id: "notes", name: "Notes", type: "text" },
];
const row = {
  id: "row-1",
  href: "#/page/page-1",
  title: "Release",
  values: {
    status: "Open",
    done: false,
    due: "2026-09-30",
    estimate: 3,
    notes: "Ship it",
  },
};

describe("typed database model", () => {
  it("validates typed properties and produces searchable text", () => {
    const state = readDatabaseState(
      JSON.stringify(columns),
      JSON.stringify([row]),
    );
    expect(databaseText(state)).toContain(
      "Release\tOpen\tNo\t2026-09-30\t3\tShip it",
    );
  });

  it.each([
    [{ ...row, href: "https://example.com" }],
    [{ ...row, values: { ...row.values, status: "Unknown" } }],
    [{ ...row, values: { ...row.values, due: "2026-02-30" } }],
    [{ ...row, values: { ...row.values, estimate: "three" } }],
    [{ ...row, values: { ...row.values, done: "yes" } }],
  ])("rejects invalid row-page references and typed values", (rows) => {
    expect(() =>
      readDatabaseState(JSON.stringify(columns), JSON.stringify(rows)),
    ).toThrow();
  });

  it("bounds properties and rows", () => {
    expect(() =>
      readDatabaseState(
        JSON.stringify(
          Array.from({ length: 21 }, (_, index) => ({
            id: `column-${index}`,
            name: `Column ${index}`,
            type: "text",
          })),
        ),
        "[]",
      ),
    ).toThrow("Invalid database properties");
    expect(() =>
      readDatabaseState(
        "[]",
        JSON.stringify(
          Array.from({ length: 501 }, (_, index) => ({
            id: `row-${index}`,
            href: `#/page/page-${index}`,
            title: "Row",
            values: {},
          })),
        ),
      ),
    ).toThrow("Invalid database rows");
  });
});
