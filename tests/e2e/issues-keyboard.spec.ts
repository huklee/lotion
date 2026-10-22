import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "./fixtures";
import { seed } from "./helpers";

// Workers share one server; every test filters the board to its own issues.
async function setup(page: Page, count = 2) {
  const prefix = `K${randomUUID().slice(0, 6)}`;
  const numbers: number[] = [];
  for (let i = 0; i < count; i++) {
    const issue = await (
      await page.request.post("/api/issues", {
        data: { title: `${prefix} ${String.fromCharCode(65 + i)}` },
      })
    ).json();
    numbers.push(issue.number);
  }
  await page.goto("/#/issues");
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  const filter = page.getByRole("textbox", { name: "Filter issues" });
  await expect(filter).toBeFocused();
  await filter.fill(prefix);
  await filter.press("Enter");
  return { prefix, numbers };
}

const card = (page: Page, n: number) =>
  page.locator(`.issue-card[data-issue="${n}"]`);
const issue = async (page: Page, n: number) =>
  (await page.request.get(`/api/issues/${n}`)).json();

test("board keys: filter, j/k focus, ⇧K reorder, ⇧L and x move, m adds a note", async ({
  page,
}) => {
  const { numbers } = await setup(page);
  const [a, b] = numbers;
  await expect(card(page, a)).toBeFocused();
  await page.keyboard.press("j");
  await expect(card(page, b)).toBeFocused();

  // ⇧K: B above A in Backlog
  await page.keyboard.press("Shift+K");
  await expect
    .poll(async () => (await issue(page, b)).rank < (await issue(page, a)).rank)
    .toBe(true);
  await expect(card(page, b)).toBeFocused();

  // ⇧L: B to Todo, focus stays on it
  await page.keyboard.press("Shift+L");
  await expect.poll(async () => (await issue(page, b)).status).toBe("todo");
  await expect(
    page.getByRole("listitem", { name: "Todo" }).locator(`[data-issue="${b}"]`),
  ).toBeVisible();
  await expect(card(page, b)).toBeFocused();

  // x: done
  await page.keyboard.press("x");
  await expect.poll(async () => (await issue(page, b)).status).toBe("done");

  // m: open with the note box focused
  await page.keyboard.press("m");
  await expect(page).toHaveURL(new RegExp(`#/issues/${b}$`));
  const panel = page.getByRole("complementary", { name: `Issue #${b}` });
  const note = panel.getByRole("textbox", { name: "Add a status note" });
  await expect(note).toBeFocused();
  await page.keyboard.type("키보드로 기록");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(panel.getByRole("list", { name: "Status notes" })).toContainText(
    "키보드로 기록",
  );
  await expect(panel.getByRole("list", { name: "Status notes" })).toContainText(
    "Todo → Done",
  );

  // Esc leaves the note box, Esc again closes the panel and focuses the card
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/issues$/);
  await expect(panel).toBeHidden();
  await expect(card(page, b)).toBeFocused();

  // e: edit the title
  await page.keyboard.press("e");
  const title = page
    .getByRole("complementary", { name: `Issue #${b}` })
    .getByRole("textbox", { name: "Title" });
  await expect(title).toBeFocused();
});

test("hints open a card; ? lists the shortcuts; priority filter", async ({
  page,
}) => {
  const { numbers } = await setup(page, 3);
  const [, , c] = numbers;
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("f");
  const hint = card(page, c).locator(".issue-hint");
  await expect(hint).toBeVisible();
  const label = (await hint.getAttribute("data-hint"))!;
  await page.keyboard.type(label);
  await expect(page).toHaveURL(new RegExp(`#/issues/${c}$`));
  await expect(page.locator(".issue-hint")).toHaveCount(0);

  // priority in the panel, then filter by it
  const panel = page.getByRole("complementary", { name: `Issue #${c}` });
  await panel.getByRole("combobox", { name: "Priority" }).selectOption("high");
  await expect(card(page, c)).toContainText("High");
  await page
    .getByRole("combobox", { name: "Priority filter" })
    .selectOption("high");
  await expect(page.locator(".issue-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear filters" }).click();

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Escape");
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Issue shortcuts" });
  await expect(help).toContainText("Move the card to the left / right column");
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
});

test("⌘K finds and creates issues; g i opens the board from a page", async ({
  page,
}) => {
  const prefix = `Q${randomUUID().slice(0, 6)}`;
  const created = await (
    await page.request.post("/api/issues", {
      data: { title: `${prefix} existing` },
    })
  ).json();
  await seed(page, `Keys page ${prefix}`);
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("textbox", { name: "Search workspace" });
  await search.fill(prefix);
  await page
    .getByRole("button", { name: new RegExp(`#${created.number} ${prefix}`) })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/issues/${created.number}$`));

  await page.keyboard.press("ControlOrMeta+k");
  await page
    .getByRole("textbox", { name: "Search workspace" })
    .fill(`${prefix} from palette`);
  await page.getByRole("button", { name: /^New issue: / }).click();
  await expect(page).toHaveURL(/#\/issues\/\d+$/);
  await expect(
    page.getByRole("complementary").getByRole("textbox", { name: "Title" }),
  ).toHaveValue(`${prefix} from palette`);

  // g i from a page
  await seed(page, `Another ${prefix}`);
  await page.locator(".topbar").click({ position: { x: 600, y: 10 } });
  await page.keyboard.press("g");
  await page.keyboard.press("i");
  await expect(page).toHaveURL(/#\/issues$/);
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
});

test("a slow keyboard move never pulls focus out of the note box", async ({
  page,
}) => {
  const { numbers } = await setup(page, 1);
  const [a] = numbers;
  await expect(card(page, a)).toBeFocused();
  // the server answers the move late, after m has opened the note box
  await page.route("**/api/issues/*/move", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.keyboard.press("x");
  await page.keyboard.press("m");
  const note = page
    .getByRole("complementary", { name: `Issue #${a}` })
    .getByRole("textbox", { name: "Add a status note" });
  await expect(note).toBeFocused();
  await expect.poll(async () => (await issue(page, a)).status).toBe("done");
  await page.waitForTimeout(800);
  await expect(note).toBeFocused();
});
