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
  expect(
    await card(page, soon).evaluate(
      (el) => getComputedStyle(el, "::after").animationName,
    ),
  ).toBe("focus-orbit");

  // n turns Focus now on for the focused card, and off again
  await card(page, plain).focus();
  await page.keyboard.press("n");
  await expect(card(page, plain)).toHaveAttribute("data-focus", "manual");
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
  const inTwoHours = new Date(Date.now() + 2 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  await plainPanel
    .getByLabel("Deadline")
    .fill(
      `${inTwoHours.getFullYear()}-${pad(inTwoHours.getMonth() + 1)}-${pad(inTwoHours.getDate())}T${pad(inTwoHours.getHours())}:${pad(inTwoHours.getMinutes())}`,
    );
  await expect(plainPanel.getByRole("status")).toContainText(
    "in focus automatically",
  );
  await expect(card(page, plain)).toHaveAttribute("data-focus", "due");
  await plainPanel.getByRole("button", { name: "Clear deadline" }).click();
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
  expect(
    await card(page, plain).evaluate(
      (el) => getComputedStyle(el).animationName,
    ),
  ).toBe("focus-pulse");
  expect(
    await card(page, plain).evaluate(
      (el) => getComputedStyle(el).animationDuration,
    ),
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
  expect(
    await card(page, plain).evaluate(
      (el) => getComputedStyle(el).animationName,
    ),
  ).toBe("none");
  expect(
    await card(page, plain).evaluate(
      (el) => getComputedStyle(el, "::after").animationName,
    ),
  ).toBe("none");
  await expect(card(page, plain)).toHaveCSS(
    "border-top-color",
    "rgb(224, 49, 49)",
  );
});

test("dots of several cards in focus move together, whenever focus was turned on", async ({
  page,
}) => {
  const { plain, later } = await setup(page);
  await card(page, plain).focus();
  await page.keyboard.press("n");
  await expect(card(page, plain)).toHaveAttribute("data-focus", "manual");
  await page.waitForTimeout(1300); // the second card is focused much later
  await card(page, later).focus();
  await page.keyboard.press("n");
  await expect(card(page, later)).toHaveAttribute("data-focus", "manual");
  const phases = async () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => (a as CSSAnimation).animationName === "focus-orbit")
        .map((a) => Number(a.currentTime) % 6000),
    );
  await expect
    .poll(async () => {
      const p = await phases();
      return p.length >= 3 && Math.max(...p) - Math.min(...p) < 50;
    })
    .toBe(true);
});
