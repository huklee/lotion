import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "./fixtures";

// Workers share one server: each test filters the board to its own issues.
async function setup(page: Page, count: number, status = "backlog") {
  const prefix = `U${randomUUID().slice(0, 6)}`;
  const numbers: number[] = [];
  for (let i = 0; i < count; i++)
    numbers.push(
      (
        await (
          await page.request.post("/api/issues", {
            data: { title: `${prefix} ${i + 1}`, status },
          })
        ).json()
      ).number,
    );
  await page.goto("/#/issues");
  await page.getByRole("textbox", { name: "Filter issues" }).fill(prefix);
  await expect(page.locator(".issue-card")).toHaveCount(count);
  return Object.assign(numbers, { prefix });
}
const card = (page: Page, n: number) =>
  page.locator(`.issue-card[data-issue="${n}"]`);
const archived = async (page: Page, n: number) =>
  !!(await (await page.request.get(`/api/issues/${n}`)).json()).archivedAt;
const toast = (page: Page) => page.locator(".issue-toast.archive-undo");

test("archiving with a shows Undo; ⌘Z right after brings the issue back", async ({
  page,
}) => {
  const [a, b] = await setup(page, 2);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("j");
  await expect(card(page, a)).toBeFocused();
  await page.keyboard.press("a");
  await expect(toast(page)).toContainText(`Archived #${a}`);
  await expect(card(page, a)).toHaveCount(0);
  await expect.poll(() => archived(page, a)).toBe(true);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(toast(page)).toBeHidden();
  await expect(card(page, a)).toBeVisible();
  await expect.poll(() => archived(page, a)).toBe(false);
  expect(await archived(page, b)).toBe(false);
});

test("the Undo toast goes away after about 3 seconds, and ⌘Z then does nothing", async ({
  page,
}) => {
  const [a] = await setup(page, 1);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("j");
  await page.keyboard.press("a");
  await expect(toast(page)).toBeVisible();
  await expect(toast(page)).toBeHidden({ timeout: 5000 });
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(500);
  expect(await archived(page, a)).toBe(true);
  await expect(card(page, a)).toHaveCount(0);
});

test("bulk archive, the panel and the Done column offer Undo too; ⌘Z in a text field is left alone", async ({
  page,
}) => {
  const issues = await setup(page, 3);
  const [a, b, c] = issues;
  // bulk: two selected, Archive in the toolbar, then the Undo button
  await card(page, a).click({ modifiers: ["ControlOrMeta"] });
  await card(page, b).click({ modifiers: ["ControlOrMeta"] });
  const bar = page.getByRole("toolbar", { name: "Selected issues" });
  await bar.getByRole("button", { name: /^Archive/ }).click();
  await expect(toast(page)).toContainText("Archived 2 issues");
  await expect(page.locator(".issue-card")).toHaveCount(1);
  // ⌘Z while typing in the filter box is the box's own undo (it may undo the
  // filter text itself, so set the filter again afterwards)
  const filter = page.getByRole("textbox", { name: "Filter issues" });
  await filter.focus();
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(300);
  expect(await archived(page, a)).toBe(true);
  await expect(toast(page)).toBeVisible();
  await filter.fill(issues.prefix);
  await toast(page).getByRole("button", { name: /Undo/ }).click();
  await expect(page.locator(".issue-card")).toHaveCount(3);
  await expect.poll(() => archived(page, b)).toBe(false);

  // the issue panel's Archive button
  await card(page, c).click();
  const panel = page.getByRole("complementary", { name: `Issue #${c}` });
  await panel.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(toast(page)).toContainText(`Archived #${c}`);
  await expect.poll(() => archived(page, c)).toBe(true);
  await toast(page).getByRole("button", { name: /Undo/ }).click();
  await expect.poll(() => archived(page, c)).toBe(false);
});

test("archiving the Done column offers Undo for every issue it archived", async ({
  page,
}) => {
  const [a, b] = await setup(page, 2, "done");
  await page
    .locator('.issues-column[data-status="done"]')
    .getByRole("button", { name: "Archive" })
    .click();
  await expect(toast(page)).toContainText("Archived 2 issues");
  await expect.poll(() => archived(page, a)).toBe(true);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => archived(page, a)).toBe(false);
  expect(await archived(page, b)).toBe(false);
  await expect(page.locator(".issue-card")).toHaveCount(2);
});

test("the archive icon in the header shows and hides archived issues", async ({
  page,
}) => {
  const [a, b] = await setup(page, 2);
  await page.request.patch(`/api/issues/${a}`, { data: { archived: true } });
  await expect(card(page, a)).toHaveCount(0, { timeout: 12000 });
  const toggle = page.getByRole("button", { name: "Show archived issues" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(card(page, a)).toBeVisible();
  await expect(card(page, a)).toHaveClass(/archived/);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(card(page, a)).toHaveCount(0);
  await expect(card(page, b)).toBeVisible();
  // it is no longer inside the board menu
  await page.getByRole("button", { name: "Board menu" }).click();
  await expect(
    page.getByRole("menu", { name: "Board menu" }).getByText(/archived/i),
  ).toHaveCount(0);
});
