import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "./fixtures";

// Workers share one server; every test filters the board to its own issues.
async function setup(page: Page) {
  const prefix = `S${randomUUID().slice(0, 6)}`;
  const issue = await (
    await page.request.post("/api/issues", { data: { title: `${prefix} A` } })
  ).json();
  await page.goto("/#/issues");
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
  const filter = page.getByRole("textbox", { name: "Filter issues" });
  await filter.fill(prefix);
  await filter.press("Enter");
  return { prefix, number: issue.number as number };
}

const get = async (page: Page, n: number) =>
  (await page.request.get(`/api/issues/${n}`)).json();

test("⌘ shortcuts act on the open issue, even while typing in its title", async ({
  page,
}) => {
  const { number } = await setup(page);
  await page.locator(`.issue-card[data-issue="${number}"]`).click();
  const panel = page.getByRole("complementary", { name: `Issue #${number}` });
  await expect(panel).toBeVisible();
  const title = panel.getByRole("textbox").first();
  await title.focus();

  await page.keyboard.press("ControlOrMeta+Shift+F");
  await expect
    .poll(async () => (await get(page, number)).focusedAt)
    .not.toBeNull();
  await page.keyboard.press("ControlOrMeta+Shift+F");
  await expect.poll(async () => (await get(page, number)).focusedAt).toBeNull();

  await page.keyboard.press("ControlOrMeta+Shift+1");
  await expect.poll(async () => (await get(page, number)).due).not.toBeNull();
  const firstDue = Date.parse((await get(page, number)).due);
  await page.keyboard.press("ControlOrMeta+Shift+7");
  await expect
    .poll(async () => Date.parse((await get(page, number)).due) - firstDue)
    .toBeGreaterThan(6 * 86_400_000);

  await page.keyboard.press("ControlOrMeta+Shift+D");
  await expect.poll(async () => (await get(page, number)).status).toBe("done");
  await expect(title).toBeFocused();

  await page.keyboard.press("ControlOrMeta+Shift+E");
  await expect
    .poll(async () => (await get(page, number)).archivedAt)
    .not.toBeNull();

  await page.keyboard.press("ControlOrMeta+Shift+K");
  await expect(
    page.getByRole("textbox", { name: "Filter issues" }),
  ).toBeFocused();
});

test("issue shortcuts can be changed in the Control panel", async ({
  page,
}) => {
  const { number } = await setup(page);
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const settings = page.getByRole("dialog", { name: "Control panel" });
  const field = settings.getByLabel("Mark done shortcut");
  await expect(field).toHaveValue(/D$/);
  await field.focus();
  await page.keyboard.press("ControlOrMeta+C");
  await expect(settings.getByRole("status")).toContainText("kept for");
  await page.keyboard.press("ControlOrMeta+Shift+J");
  await expect(field).toHaveValue(/J$/);
  await settings.getByRole("button", { name: "Close dialog" }).click();

  await page.locator(`.issue-card[data-issue="${number}"]`).click();
  await page.keyboard.press("ControlOrMeta+Shift+D");
  await page.waitForTimeout(500);
  expect((await get(page, number)).status).not.toBe("done");
  await page.keyboard.press("ControlOrMeta+Shift+J");
  await expect.poll(async () => (await get(page, number)).status).toBe("done");

  await page.reload();
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  await expect(settings.getByLabel("Mark done shortcut")).toHaveValue(/J$/);
  await settings.getByRole("button", { name: "Reset issue shortcuts" }).click();
  await expect(settings.getByLabel("Mark done shortcut")).toHaveValue(/D$/);
});
