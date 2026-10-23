import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "./fixtures";

// Workers share one server: each test filters the board to its own issues.
async function setup(page: Page, count: number) {
  const prefix = `B${randomUUID().slice(0, 6)}`;
  const numbers: number[] = [];
  for (let i = 0; i < count; i++)
    numbers.push(
      (
        await (
          await page.request.post("/api/issues", {
            data: { title: `${prefix} ${i + 1}` },
          })
        ).json()
      ).number,
    );
  await page.goto("/#/issues");
  await page.getByRole("textbox", { name: "Filter issues" }).fill(prefix);
  await expect(page.locator(".issue-card")).toHaveCount(count);
  return numbers;
}
const card = (page: Page, n: number) =>
  page.locator(`.issue-card[data-issue="${n}"]`);
const get = async (page: Page, n: number) =>
  (await page.request.get(`/api/issues/${n}`)).json();

test("select with the mouse, then bulk status, priority, labels from the toolbar", async ({
  page,
}) => {
  const [a, b, c, d] = await setup(page, 4);
  await card(page, a).click({ modifiers: ["ControlOrMeta"] });
  await card(page, c).click({ modifiers: ["Shift"] }); // a..c
  const bar = page.getByRole("toolbar", { name: "Selected issues" });
  await expect(bar).toContainText("3 selected");
  await expect(page).toHaveURL(/#\/issues$/); // selecting opens nothing
  await card(page, b).click({ modifiers: ["ControlOrMeta"] }); // drop b
  await expect(bar).toContainText("2 selected");

  await bar.getByRole("button", { name: /^Status/ }).click();
  await page.keyboard.press("4");
  await expect
    .poll(async () => [
      (await get(page, a)).status,
      (await get(page, c)).status,
    ])
    .toEqual(["done", "done"]);
  expect((await get(page, b)).status).toBe("backlog");

  await bar.getByRole("button", { name: /^Priority/ }).click();
  await page.keyboard.press("3");
  await expect.poll(async () => (await get(page, c)).priority).toBe("high");

  await bar.getByRole("button", { name: /^Labels/ }).click();
  await page.getByRole("textbox", { name: "Label changes" }).fill("+bulk");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await get(page, a)).labels).toEqual(["bulk"]);
  expect((await get(page, d)).labels).toEqual([]);

  // the checkbox on a card toggles too; Esc clears
  await card(page, d).locator(".issue-select").click();
  await expect(bar).toContainText("3 selected");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Escape");
  await expect(bar).toBeHidden();
});

test("keyboard: v and ⇧V select, s / x apply to all, a archives, Delete asks first", async ({
  page,
}) => {
  const [a, b, c] = await setup(page, 3);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("j");
  await expect(card(page, a)).toBeFocused();
  await page.keyboard.press("v");
  await page.keyboard.press("j");
  await page.keyboard.press("v");
  const bar = page.getByRole("toolbar", { name: "Selected issues" });
  await expect(bar).toContainText("2 selected");
  await page.keyboard.press("s");
  await expect(
    page.getByRole("dialog", { name: "Status of 2 issues" }),
  ).toBeVisible();
  await page.keyboard.press("2");
  await expect
    .poll(async () => [
      (await get(page, a)).status,
      (await get(page, b)).status,
    ])
    .toEqual(["todo", "todo"]);
  expect((await get(page, c)).status).toBe("backlog");

  await page.keyboard.press("x");
  await expect.poll(async () => (await get(page, a)).status).toBe("done");

  // ⇧V selects all three, Delete asks; Esc / Cancel keeps them
  await page.keyboard.press("Shift+V");
  await expect(bar).toContainText("3 selected");
  await page.keyboard.press("Delete");
  const confirm = page.getByRole("dialog", { name: /^Delete 3 issues/ });
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Enter"); // the default is Cancel
  await expect(confirm).toBeHidden();
  expect((await get(page, c)).number).toBe(c);

  // a archives the selection and clears it
  await page.keyboard.press("a");
  await expect.poll(async () => !!(await get(page, b)).archivedAt).toBe(true);
  await expect(bar).toBeHidden();
  await expect(page.locator(".issue-card")).toHaveCount(0);

  // show archived, select all, delete for real with 1
  await page.getByRole("button", { name: "Board menu" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Show archived" }).click();
  await expect(page.locator(".issue-card")).toHaveCount(3);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Shift+V");
  await page.keyboard.press("Delete");
  await page.keyboard.press("1");
  await expect(page.locator(".issue-card")).toHaveCount(0);
  expect((await page.request.get(`/api/issues/${a}`)).status()).toBe(404);
});
