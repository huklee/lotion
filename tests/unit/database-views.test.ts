import { describe, expect, it } from "vitest";
import type { DatabaseState } from "../../packages/database/model";
import {
  applyView,
  defaultView,
  filterDefaults,
  readViews,
  relativeRange,
  viewsJson,
  type DatabaseView,
} from "../../packages/database/views";

const state: DatabaseState = {
  columns: [
    { id: "date", name: "Date", type: "date" },
    {
      id: "kind",
      name: "Type",
      type: "select",
      options: ["Weekly", "1:1", "Review"],
    },
    { id: "done", name: "Done", type: "checkbox" },
    { id: "n", name: "N", type: "number" },
  ],
  rows: [
    {
      id: "a",
      href: "#/page/a",
      title: "Kickoff",
      values: { date: "2026-10-01", kind: "Weekly", n: 3 },
    },
    {
      id: "b",
      href: "#/page/b",
      title: "Design review",
      values: { date: "2026-10-14", kind: "Review", done: true, n: 10 },
    },
    { id: "c", href: "#/page/c", title: "Sync", values: { kind: "1:1", n: 2 } },
    {
      id: "d",
      href: "#/page/d",
      title: "weekly sync",
      values: { date: "2026-10-15", kind: "Weekly" },
    },
  ],
};
const view = (patch: Partial<DatabaseView>): DatabaseView => ({
  ...defaultView(),
  ...patch,
});
const ids = (v: DatabaseView, today = new Date(2026, 9, 16)) =>
  applyView(state, v, undefined, today).map((r) => r.id);

describe("database views", () => {
  it("defaults old blocks to one table view", () => {
    expect(readViews(undefined, state.columns)).toEqual([defaultView()]);
    expect(readViews("", state.columns)).toEqual([defaultView()]);
  });

  it("round-trips and drops rules for deleted properties", () => {
    const stored = viewsJson([
      view({
        sort: [
          { columnId: "gone", direction: "asc" },
          { columnId: "date", direction: "desc" },
        ],
        filters: [
          { id: "f1", columnId: "gone", op: "is", value: "x" },
          { id: "f2", columnId: "done", op: "checked" },
        ],
        hidden: ["n", "gone"],
      }),
    ]);
    const [read] = readViews(stored, state.columns);
    expect(read.sort).toEqual([{ columnId: "date", direction: "desc" }]);
    expect(read.filters).toEqual([
      { id: "f2", columnId: "done", op: "checked" },
    ]);
    expect(read.hidden).toEqual(["n"]);
  });

  it("rejects malformed views", () => {
    expect(() => readViews("{", state.columns)).toThrow();
    expect(() =>
      readViews(JSON.stringify([{ id: "x" }]), state.columns),
    ).toThrow();
    expect(() =>
      readViews(JSON.stringify([view({}), view({})]), state.columns),
    ).toThrow();
  });

  it("sorts by date descending with empty values last, stable otherwise", () => {
    expect(
      ids(view({ sort: [{ columnId: "date", direction: "desc" }] })),
    ).toEqual(["d", "b", "a", "c"]);
    expect(
      ids(view({ sort: [{ columnId: "date", direction: "asc" }] })),
    ).toEqual(["a", "b", "d", "c"]);
    expect(
      ids(
        view({
          sort: [
            { columnId: "kind", direction: "asc" },
            { columnId: "title", direction: "asc" },
          ],
        }),
      ),
    ).toEqual(["a", "d", "c", "b"]);
    expect(ids(view({ sort: [{ columnId: "n", direction: "desc" }] }))).toEqual(
      ["b", "a", "c", "d"],
    );
  });

  it("filters by text, select, checkbox, number and date (AND)", () => {
    expect(
      ids(
        view({
          filters: [
            { id: "f", columnId: "title", op: "contains", value: "SYNC" },
          ],
        }),
      ),
    ).toEqual(["c", "d"]);
    expect(
      ids(
        view({
          filters: [{ id: "f", columnId: "kind", op: "is", value: "Weekly" }],
        }),
      ),
    ).toEqual(["a", "d"]);
    expect(
      ids(view({ filters: [{ id: "f", columnId: "done", op: "unchecked" }] })),
    ).toEqual(["a", "c", "d"]);
    expect(
      ids(
        view({ filters: [{ id: "f", columnId: "n", op: "gt", value: "2" }] }),
      ),
    ).toEqual(["a", "b"]);
    expect(
      ids(view({ filters: [{ id: "f", columnId: "date", op: "is_empty" }] })),
    ).toEqual(["c"]);
    expect(
      ids(
        view({
          filters: [
            {
              id: "f1",
              columnId: "date",
              op: "on_or_after",
              value: "2026-10-10",
            },
            { id: "f2", columnId: "kind", op: "is_not", value: "Review" },
          ],
        }),
      ),
    ).toEqual(["d"]);
  });

  it("supports relative date ranges", () => {
    const today = new Date(2026, 9, 16); // Friday
    expect(relativeRange("this_week", today)).toEqual([
      "2026-10-12",
      "2026-10-18",
    ]);
    expect(relativeRange("last_7_days", today)).toEqual([
      "2026-10-10",
      "2026-10-16",
    ]);
    expect(relativeRange("this_month", today)).toEqual([
      "2026-10-01",
      "2026-10-31",
    ]);
    expect(
      ids(
        view({ filters: [{ id: "f", columnId: "date", op: "this_week" }] }),
        today,
      ),
    ).toEqual(["b", "d"]);
  });

  it("does not hide everything for an incomplete rule", () => {
    expect(
      ids(
        view({
          filters: [{ id: "f", columnId: "title", op: "contains", value: "" }],
        }),
      ),
    ).toHaveLength(4);
    expect(
      ids(view({ filters: [{ id: "f", columnId: "date", op: "before" }] })),
    ).toEqual(["a", "b", "d"]);
  });

  it("gives new rows values that satisfy equality filters", () => {
    const today = new Date(2026, 9, 16);
    expect(
      filterDefaults(
        view({
          filters: [
            { id: "f1", columnId: "kind", op: "is", value: "1:1" },
            { id: "f2", columnId: "done", op: "checked" },
            { id: "f3", columnId: "date", op: "this_week" },
            { id: "f4", columnId: "title", op: "is", value: "x" },
          ],
        }),
        state.columns,
        today,
      ),
    ).toEqual({ kind: "1:1", done: true, date: "2026-10-16" });
  });
});

describe("date presets", () => {
  it("adds, replaces and removes one period filter on the date property", async () => {
    const { datePreset, withDatePreset } =
      await import("../../packages/database/views");
    const base = view({
      filters: [{ id: "k", columnId: "kind", op: "is", value: "Weekly" }],
    });
    const week = withDatePreset(base, state.columns, "this_week");
    expect(datePreset(week)).toBe("this_week");
    expect(week.filters).toHaveLength(2);
    expect(ids(week)).toEqual(["d"]);
    const month = withDatePreset(week, state.columns, "this_month");
    expect(month.filters).toHaveLength(2);
    expect(datePreset(month)).toBe("this_month");
    const all = withDatePreset(month, state.columns, null);
    expect(datePreset(all)).toBeNull();
    expect(all.filters).toEqual(base.filters);
    expect(
      withDatePreset(base, [{ id: "t", name: "T", type: "text" }], "today")
        .filters,
    ).toEqual(base.filters);
  });
});
