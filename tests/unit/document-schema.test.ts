import { expect, it } from "vitest";
import { contentSchema } from "../../packages/document-schema/index";
import {
  DEFAULT_DATABASE_COLUMNS_JSON,
  DEFAULT_DATABASE_ROWS_JSON,
} from "../../packages/database/model";

const content = (mention: unknown) => ({
  title: "Mentions",
  blocks: [
    {
      id: "mention-block",
      type: "paragraph",
      content: [mention],
    },
  ],
});

it("accepts bounded page and external mention content", () => {
  for (const kind of ["page", "external"]) {
    expect(
      contentSchema.safeParse(
        content({
          type: "mention",
          props: {
            kind,
            href: kind === "page" ? "#/page/target" : "https://example.com",
            label: "Reference",
            icon: kind === "page" ? "📄" : "🌐",
          },
        }),
      ).success,
    ).toBe(true);
  }
});

it("accepts canonical file and date mention content", () => {
  expect(
    contentSchema.safeParse(
      content({
        type: "mention",
        props: {
          kind: "file",
          href: `/api/assets/${"a".repeat(64)}.bin`,
          label: "brief.txt",
          icon: "📎",
          value: "",
        },
      }),
    ).success,
  ).toBe(true);
  expect(
    contentSchema.safeParse(
      content({
        type: "mention",
        props: {
          kind: "date",
          href: "",
          label: "2026-09-17",
          icon: "📅",
          value: "2026-09-17",
        },
      }),
    ).success,
  ).toBe(true);
});

it.each([
  { kind: "unknown", href: "https://example.com", label: "Label", icon: "🌐" },
  { kind: "external", href: "file:///etc/passwd", label: "Label", icon: "🌐" },
  { kind: "page", href: "#/page/target", label: "x".repeat(501), icon: "📄" },
  { kind: "file", href: "https://example.com/file", label: "x", icon: "📎" },
  {
    kind: "date",
    href: "",
    label: "2026-02-30",
    icon: "📅",
    value: "2026-02-30",
  },
  {
    kind: "date",
    href: "#/date/2026-09-17",
    label: "2026-09-17",
    icon: "📅",
    value: "2026-09-17",
  },
  {
    kind: "external",
    href: "https://example.com",
    label: "x",
    icon: "🌐",
    value: "unexpected",
  },
])("rejects invalid mention properties", (props) => {
  expect(
    contentSchema.safeParse(content({ type: "mention", props })).success,
  ).toBe(false);
});

it("accepts a bounded database and rejects malformed database properties", () => {
  const database = (columns: string, rows = DEFAULT_DATABASE_ROWS_JSON) => ({
    title: "Database",
    blocks: [
      {
        id: "database-block",
        type: "database",
        props: { columns, rows },
      },
    ],
  });
  expect(
    contentSchema.safeParse(database(DEFAULT_DATABASE_COLUMNS_JSON)).success,
  ).toBe(true);
  expect(contentSchema.safeParse(database("not json")).success).toBe(false);
  expect(
    contentSchema.safeParse(
      database(JSON.stringify([{ id: "bad", name: "Bad", type: "formula" }])),
    ).success,
  ).toBe(false);
});
