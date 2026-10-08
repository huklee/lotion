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
  await expect(
    page.locator('.bn-block-outer[data-id="h-usage"]'),
  ).toBeInViewport();
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

test("table-of-contents jumps on long pages finish within a bounded time", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const many = (id: string, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${id}-${index}`,
      type: "paragraph",
      content: text(`Long paragraph ${index + 1} of ${id}.`),
    }));
  await seed(page, "Long outline page", [
    { id: "toc-inline", type: "tableOfContents" },
    {
      id: "h-first",
      type: "heading",
      props: { level: 1 },
      content: text("First"),
    },
    ...many("first", 800),
    {
      id: "h-far",
      type: "heading",
      props: { level: 1 },
      content: text("Far away"),
    },
    ...many("far", 40),
  ]);
  const outline = page.getByRole("complementary", { name: "Page outline" });
  await expect(outline.getByRole("button")).toHaveText(["First", "Far away"]);

  // Click inside the page and sample scrollTop every frame until it settles.
  const jump = (selector: string) =>
    page.evaluate(async (sel) => {
      const scroller = document.querySelector<HTMLElement>(".main-scroll")!;
      const button = [
        ...document.querySelectorAll<HTMLButtonElement>(sel),
      ].pop()!;
      const start = scroller.scrollTop;
      const t0 = performance.now();
      button.click();
      const samples: number[] = [];
      let still = 0;
      let last = scroller.scrollTop;
      while (performance.now() - t0 < 5_000) {
        await new Promise((r) => requestAnimationFrame(r));
        samples.push(scroller.scrollTop);
        still = scroller.scrollTop === last ? still + 1 : 0;
        last = scroller.scrollTop;
        if (still >= 8 && last !== start) break;
      }
      // time of the last frame that moved
      const lastMove = samples.length - still;
      return {
        distance: Math.abs(last - start),
        settledMs: ((performance.now() - t0) * lastMove) / samples.length,
        distinct: new Set(samples).size,
      };
    }, selector);

  const outlineJump = await jump(
    'aside[aria-label="Page outline"] button:last-of-type',
  );
  expect(outlineJump.distance).toBeGreaterThan(15_000);
  expect(outlineJump.distinct).toBeGreaterThan(4); // animated, not an instant jump
  expect(outlineJump.settledMs).toBeLessThan(1_000); // bounded: 650 ms cap + frame slack
  await expect(
    page.locator('.bn-block-outer[data-id="h-far"]'),
  ).toBeInViewport();
  await expect(
    outline.getByRole("button", { name: "Far away" }),
  ).toHaveAttribute("aria-current", "location");

  // the inline /toc block (back at the top) uses the same bounded scroll
  await page.locator(".main-scroll").evaluate((el) => (el.scrollTop = 0));
  const inlineJump = await jump('nav[aria-label="Table of contents"] button');
  expect(inlineJump.distance).toBeGreaterThan(15_000);
  expect(inlineJump.distinct).toBeGreaterThan(4);
  expect(inlineJump.settledMs).toBeLessThan(1_000);
  await expect(
    page.locator('.bn-block-outer[data-id="h-far"]'),
  ).toBeInViewport();
});
