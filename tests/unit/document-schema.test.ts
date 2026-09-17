import { expect, it } from "vitest";
import { contentSchema } from "../../packages/document-schema/index";

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

it.each([
  { kind: "unknown", href: "https://example.com", label: "Label", icon: "🌐" },
  { kind: "external", href: "file:///etc/passwd", label: "Label", icon: "🌐" },
  { kind: "page", href: "#/page/target", label: "x".repeat(501), icon: "📄" },
])("rejects invalid mention properties", (props) => {
  expect(
    contentSchema.safeParse(content({ type: "mention", props })).success,
  ).toBe(false);
});
