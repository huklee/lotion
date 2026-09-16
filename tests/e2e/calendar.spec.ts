import { test, expect } from "./fixtures";
import { seed } from "./helpers";

test("at-sign date accepts today with the next Enter key", async ({ page }) => {
  await seed(page, "Keyboard date");
  await page.locator(".tiptap").click();
  await page.keyboard.type("@date");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Insert date" })).toBeVisible();
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Insert date" })).toHaveCount(
    0,
  );
  await expect(page.locator(".tiptap")).toContainText(`📅 ${today}`);
});

test("at-sign calendar inserts a chosen date, persists and cancels without insertion", async ({
  page,
}) => {
  await seed(page, "Dates");
  await page.locator(".tiptap").click();
  await page.keyboard.type("@date");
  await page
    .getByRole("option")
    .filter({ hasText: "Choose a date from the calendar" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Insert date" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Date", { exact: true }).fill("2026-09-15");
  await dialog.getByRole("button", { name: "Next month" }).click();
  await dialog.getByRole("button", { name: "2026-10-20", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Insert date", exact: true })
    .click();
  await expect(page.locator(".tiptap")).toContainText("📅 2026-10-20");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator(".tiptap")).toContainText("📅 2026-10-20");
  await page.locator(".bn-inline-content").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" @date");
  await page
    .getByRole("option")
    .filter({ hasText: "Choose a date from the calendar" })
    .click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect((await page.locator(".tiptap").innerText()).match(/📅/g)).toHaveLength(
    1,
  );
});
