import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "./fixtures";

async function setup(page: Page) {
  const prefix = `F${randomUUID().slice(0, 6)}`;
  const make = async (title: string, data: Record<string, unknown> = {}) =>
    (
      await (
        await page.request.post("/api/issues", {
          data: { title: `${prefix} ${title}`, ...data },
        })
      ).json()
    ).number as number;
  const plain = await make("plain");
  const soon = await make("soon", {
    due: new Date(Date.now() + 5 * 3600_000).toISOString(),
  });
  const later = await make("later", {
    due: new Date(Date.now() + 72 * 3600_000).toISOString(),
  });
  await page.goto("/#/issues");
  await page.getByRole("textbox", { name: "Filter issues" }).fill(prefix);
  await expect(page.locator(".issue-card")).toHaveCount(3);
  return { plain, soon, later };
}
const card = (page: Page, n: number) =>
  page.locator(`.issue-card[data-issue="${n}"]`);

test("Focus now with n and the panel; due within 24 h is in focus; done clears it", async ({
  page,
}) => {
  const { plain, soon, later } = await setup(page);
  // the deadline 5 h away is in focus already; 3 days away is not
  await expect(card(page, soon)).toHaveClass(/focus-now/);
  await expect(card(page, soon)).toHaveAttribute("data-focus", "due");
  await expect(card(page, soon)).toContainText("Due in 5h");
  await expect(card(page, later)).not.toHaveClass(/focus-now/);
  await expect(card(page, later)).toContainText("Due in 3d");
  // the red border and the orbiting dot (default effect)
  await expect(card(page, soon)).toHaveCSS(
    "border-top-color",
    "rgb(224, 49, 49)",
  );
  // one clock on the board drives every card's dot
  const board = page.locator(".issues-board");
  expect(await board.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "focus-orbit",
  );
  expect(
    await card(page, soon).evaluate(
      (el) => getComputedStyle(el, "::after").opacity,
    ),
  ).toBe("1");

  // n turns Focus now on for the focused card, and off again
  await card(page, plain).focus();
  await page.keyboard.press("n");
  await expect(card(page, plain)).toHaveAttribute("data-focus", "manual");
  // set by hand: blue; a deadline within 24 h on the same issue: red wins
  await expect(card(page, plain)).toHaveCSS(
    "border-top-color",
    "rgb(28, 126, 214)",
  );
  await page.request.patch(`/api/issues/${plain}`, {
    data: { due: new Date(Date.now() + 3 * 3600_000).toISOString() },
  });
  await expect(card(page, plain)).toHaveAttribute("data-focus", "due", {
    timeout: 12000,
  });
  await expect(card(page, plain)).toHaveCSS(
    "border-top-color",
    "rgb(224, 49, 49)",
  );
  await page.request.patch(`/api/issues/${plain}`, { data: { due: null } });
  await expect(card(page, plain)).toHaveAttribute("data-focus", "manual", {
    timeout: 12000,
  });
  await card(page, plain).focus();
  await page.keyboard.press("n");
  await expect(card(page, plain)).not.toHaveClass(/focus-now/);

  // the panel toggle, then moving to Done clears it
  await card(page, later).click();
  const panel = page.getByRole("complementary", { name: `Issue #${later}` });
  const toggle = panel.getByRole("button", { name: "Focus now" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(card(page, later)).toHaveAttribute("data-focus", "manual");
  await panel.getByRole("combobox", { name: "Status" }).selectOption("done");
  await expect(card(page, later)).not.toHaveClass(/focus-now/);
  await expect(toggle).toBeDisabled();
  expect(
    (await (await page.request.get(`/api/issues/${later}`)).json()).focusedAt,
  ).toBeNull();

  // a deadline set in the panel: within 24 h → in focus automatically
  await card(page, plain).click();
  const plainPanel = page.getByRole("complementary", {
    name: `Issue #${plain}`,
  });
  // pick the deadline with the mouse: the calendar dialog, a day, a time
  const inTwoHours = new Date(Date.now() + 2 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${inTwoHours.getFullYear()}-${pad(inTwoHours.getMonth() + 1)}-${pad(inTwoHours.getDate())}`;
  await plainPanel
    .getByRole("button", { name: "Deadline", exact: true })
    .click();
  const picker = page.getByRole("dialog", { name: "Set deadline" });
  await expect(picker).toBeVisible();
  if (inTwoHours.getMonth() !== new Date().getMonth())
    await picker.getByRole("button", { name: "Next month" }).click();
  await picker.getByRole("button", { name: day, exact: true }).click();
  await picker
    .getByLabel("Time")
    .fill(`${pad(inTwoHours.getHours())}:${pad(inTwoHours.getMinutes())}`);
  await picker
    .getByRole("button", { name: "Set deadline", exact: true })
    .click();
  await expect(picker).toBeHidden();
  await expect(plainPanel.getByRole("status")).toContainText(
    "in focus automatically",
  );
  await expect(card(page, plain)).toHaveAttribute("data-focus", "due");
  const saved = (await (await page.request.get(`/api/issues/${plain}`)).json())
    .due;
  expect(Math.abs(Date.parse(saved) - inTwoHours.getTime())).toBeLessThan(
    60_000,
  );

  // quick choice: Tomorrow (23:59 kept from the field) — more than 24 h? not
  // necessarily, so just check the date moved to tomorrow
  await plainPanel
    .getByRole("button", { name: "Deadline", exact: true })
    .click();
  await picker.getByRole("button", { name: "Tomorrow" }).click();
  await picker.getByLabel("Time").fill("23:59");
  await picker
    .getByRole("button", { name: "Set deadline", exact: true })
    .click();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await expect
    .poll(async () => {
      const due = (
        await (await page.request.get(`/api/issues/${plain}`)).json()
      ).due;
      const d = new Date(due);
      return `${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
    })
    .toBe(`${tomorrow.getDate()} 23:59`);

  // Clear in the dialog removes it
  await plainPanel
    .getByRole("button", { name: "Deadline", exact: true })
    .click();
  await picker.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    plainPanel.getByRole("button", { name: "Deadline", exact: true }),
  ).toHaveText(/Set deadline/);
  await expect(card(page, plain)).not.toHaveClass(/focus-now/);
});

test("Focus several at once from the toolbar; the effect follows the Control panel", async ({
  page,
}) => {
  const { plain, later } = await setup(page);
  await card(page, plain).click({ modifiers: ["ControlOrMeta"] });
  await card(page, later).click({ modifiers: ["ControlOrMeta"] });
  await page
    .getByRole("toolbar", { name: "Selected issues" })
    .getByRole("button", { name: /^Focus/ })
    .click();
  await expect(card(page, plain)).toHaveAttribute("data-focus", "manual");
  await expect(card(page, later)).toHaveAttribute("data-focus", "manual");

  // Control panel: pulse, then off (static red border, no animation)
  await page.getByRole("button", { name: "Control panel" }).click();
  const dialog = page.getByRole("dialog", { name: "Control panel" });
  await dialog
    .getByRole("combobox", { name: "Focus now effect" })
    .selectOption("pulse");
  await dialog
    .getByRole("combobox", { name: "Focus effect speed" })
    .selectOption("fast");
  await expect(page.locator("html")).toHaveAttribute(
    "data-focus-effect",
    "pulse",
  );
  await page.keyboard.press("Escape");
  const board = page.locator(".issues-board");
  expect(await board.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "focus-glow",
  );
  expect(
    await board.evaluate((el) => getComputedStyle(el).animationDuration),
  ).toBe("3s");
  await page.getByRole("button", { name: "Control panel" }).click();
  await dialog
    .getByRole("combobox", { name: "Focus now effect" })
    .selectOption("off");
  await page.keyboard.press("Escape");
  await page.reload(); // the choice is kept
  await expect(page.locator("html")).toHaveAttribute(
    "data-focus-effect",
    "off",
  );
  await page.getByRole("textbox", { name: "Filter issues" }).fill("");
  expect(await board.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "none",
  );
  expect(
    await card(page, plain).evaluate(
      (el) => getComputedStyle(el, "::after").opacity,
    ),
  ).toBe("0");
  await expect(card(page, plain)).toHaveCSS(
    "border-top-color",
    "rgb(28, 126, 214)",
  );
});

test("dots of several cards in focus move together; a newly focused card joins at the same angle", async ({
  page,
}) => {
  const { plain, later } = await setup(page);
  await card(page, plain).focus();
  await page.keyboard.press("n");
  await expect(card(page, plain)).toHaveAttribute("data-focus", "manual");
  await page.waitForTimeout(1300); // the first dot has gone round a good way
  // watch every frame from the key press on
  await page.evaluate(
    `(() => { window.frames = []; const t0 = performance.now();
      const angle = (n) => { const el = document.querySelector('.issue-card[data-issue="' + n + '"]');
        return el && el.classList.contains("focus-now") ? parseFloat(getComputedStyle(el, "::after").getPropertyValue("--focus-angle")) : null; };
      const tick = () => { window.frames.push([angle(${plain}), angle(${later})]);
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick); };
      requestAnimationFrame(tick); })()`,
  );
  await card(page, later).focus();
  await page.keyboard.press("n");
  await expect(card(page, later)).toHaveAttribute("data-focus", "manual");
  await page.waitForTimeout(1600);
  const frames = (await page.evaluate("window.frames")) as (number | null)[][];
  const both = frames.filter(([a, b]) => a !== null && b !== null);
  expect(both.length).toBeGreaterThan(5);
  // from its very first frame the new dot is where the first one is (it did
  // not start over at 0°), and they stay together
  for (const [a, b] of both) expect(Math.abs(a! - b!)).toBeLessThan(0.5);
  expect(both[0][0]).toBeGreaterThan(30);
});

test("issues in focus move to the top of their column", async ({ page }) => {
  const { plain, soon, later } = await setup(page);
  const order = () =>
    page
      .locator(".issue-card")
      .evaluateAll((cards) =>
        cards.map((c) => Number((c as HTMLElement).dataset.issue)),
      );
  // created plain, soon, later: the deadline within 24 h is already on top
  await expect.poll(order).toEqual([soon, plain, later]);
  // Focus now by hand: after the deadline issues, above the rest
  await card(page, later).focus();
  await page.keyboard.press("n");
  await expect.poll(order).toEqual([soon, later, plain]);
  // a sooner deadline goes first
  await page.request.patch(`/api/issues/${plain}`, {
    data: { due: new Date(Date.now() + 2 * 3600_000).toISOString() },
  });
  await expect.poll(order, { timeout: 12000 }).toEqual([plain, soon, later]);
  // focus ends: back to its place in board order
  await card(page, later).focus();
  await page.keyboard.press("n");
  await page.request.patch(`/api/issues/${plain}`, { data: { due: null } });
  await expect.poll(order, { timeout: 12000 }).toEqual([soon, plain, later]);
});
