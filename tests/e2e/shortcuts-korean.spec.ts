import { test, expect, type Page } from "./fixtures";
import { seed } from "./helpers";

/**
 * Modifier shortcuts as a browser reports them with Korean (두벌식) input:
 * ⌘K arrives as key "ㅏ" (code KeyK). Playwright's own keyboard is a US
 * layout, so these events are dispatched by hand.
 */
async function pressKorean(
  page: Page,
  target: string,
  init: { key: string; code: string; shiftKey?: boolean; altKey?: boolean },
) {
  await page
    .locator(target)
    .first()
    .evaluate((el, init) => {
      const mac = navigator.platform.includes("Mac");
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          metaKey: mac,
          ctrlKey: !mac,
          ...init,
        }),
      );
    }, init);
}

const blocks = [
  {
    id: "ko-1",
    type: "paragraph",
    content: [{ type: "text", text: "First line", styles: {} }],
  },
  {
    id: "ko-2",
    type: "paragraph",
    content: [{ type: "text", text: "Second line", styles: {} }],
  },
];

test("⌘K opens search and ⌘S saves with Korean input", async ({ page }) => {
  await seed(page, "Korean shortcuts", blocks);
  await page.locator('[data-id="ko-2"] .bn-inline-content').click();
  await page.keyboard.type(" edited");
  await pressKorean(page, ".tiptap", { key: "ㄴ", code: "KeyS" });
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await pressKorean(page, ".tiptap", { key: "ㅏ", code: "KeyK" });
  await expect(
    page.getByRole("textbox", { name: "Search workspace" }),
  ).toBeVisible();
  // ⌘⇧K is a different shortcut: it does not toggle search again
  await pressKorean(page, "body", { key: "ㅏ", code: "KeyK", shiftKey: true });
  await expect(
    page.getByRole("textbox", { name: "Search workspace" }),
  ).toBeVisible();
});

test("⌘C and ⌘X on selected blocks work with Korean input", async ({
  page,
}) => {
  await seed(page, "Korean block copy", blocks);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as any).copied = text;
        },
      },
    });
  });
  const gutter = (await page.locator(".selection-gutter").boundingBox())!;
  const first = (await page.locator('[data-id="ko-1"]').first().boundingBox())!;
  const last = (await page.locator('[data-id="ko-2"]').first().boundingBox())!;
  await page.mouse.move(gutter.x + 5, first.y + 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width - 8, last.y + 2, { steps: 10 });
  await page.mouse.up();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("2 selected");
  await pressKorean(page, "body", { key: "ㅊ", code: "KeyC" });
  await expect
    .poll(() => page.evaluate(() => (window as any).copied ?? ""))
    .toContain("Second line");
  await expect(page.getByText("First line")).toBeVisible();
  await page.evaluate(() => ((window as any).copied = ""));
  await pressKorean(page, "body", { key: "ㅌ", code: "KeyX" });
  await expect
    .poll(() => page.evaluate(() => (window as any).copied ?? ""))
    .toContain("First line");
  await expect(page.locator(".tiptap").getByText("First line")).toHaveCount(0);
});
