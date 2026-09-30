import { test, expect } from "./fixtures";
import { seed } from "./helpers";

const text = (value: string) => [{ type: "text", text: value, styles: {} }];
const filler = (id: string) =>
  Array.from({ length: 14 }, (_, index) => ({
    id: `${id}-${index}`,
    type: "paragraph",
    content: text(`Paragraph ${index + 1} of ${id}.`),
  }));

test("right-hand outline lists headings, follows edits and scrolls to a section", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, "Outline page", [
    {
      id: "h-intro",
      type: "heading",
      props: { level: 1 },
      content: text("Introduction"),
    },
    ...filler("intro"),
    {
      id: "h-setup",
      type: "heading",
      props: { level: 2 },
      content: text("Setup"),
    },
    ...filler("setup"),
    {
      id: "h-usage",
      type: "heading",
      props: { level: 2 },
      content: text("Usage"),
    },
    ...filler("usage"),
    { id: "tail", type: "paragraph", content: [] },
  ]);

  const outline = page.getByRole("complementary", { name: "Page outline" });
  await expect(outline.getByRole("button")).toHaveText([
    "Introduction",
    "Setup",
    "Usage",
  ]);
  await expect(
    outline.getByRole("button", { name: "Introduction" }),
  ).toHaveAttribute("aria-current", "location");

  await outline.getByRole("button", { name: "Usage" }).click();
  await expect(page.locator('.bn-block-outer[data-id="h-usage"]')).toBeInViewport();
  await expect(outline.getByRole("button", { name: "Usage" })).toHaveAttribute(
    "aria-current",
    "location",
  );

  // A heading typed into the page appears without saving or reloading.
  await page.locator('[data-id="tail"] .bn-inline-content').click();
  await page.keyboard.type("## Troubleshooting");
  await expect(outline.getByRole("button")).toHaveText([
    "Introduction",
    "Setup",
    "Usage",
    "Troubleshooting",
  ]);
});

test("outline is hidden on pages without headings and on narrow windows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, "Plain page", [
    { id: "only", type: "paragraph", content: text("No headings here.") },
  ]);
  await expect(
    page.getByRole("complementary", { name: "Page outline" }),
  ).toHaveCount(0);

  await seed(page, "Narrow page", [
    { id: "h", type: "heading", props: { level: 1 }, content: text("Title") },
  ]);
  const outline = page.getByRole("complementary", { name: "Page outline" });
  await expect(outline).toBeVisible();
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(outline).toBeHidden();
});
