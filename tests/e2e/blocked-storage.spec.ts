import { test, expect } from "./fixtures";
import { seed } from "./helpers";

// Browsers can refuse site storage (private windows, blocked cookies and site
// data): every localStorage / sessionStorage access then throws.
test("the workspace works when the browser refuses local and session storage", async ({
  page,
}) => {
  await seed(page, "Blocked storage", [
    {
      id: "blocked-line",
      type: "paragraph",
      content: [{ type: "text", text: "Still editable", styles: {} }],
    },
  ]);
  await page.addInitScript(() => {
    const refuse = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    for (const method of ["getItem", "setItem", "removeItem", "clear", "key"])
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value: refuse,
      });
  });
  const errors: string[] = [];
  // the block is really in place
  const blocked = async () =>
    page.evaluate(() => {
      try {
        localStorage.getItem("x");
        return false;
      } catch {
        return true;
      }
    });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  expect(await blocked()).toBe(true);
  await expect(page.locator('[data-id="blocked-line"]').first()).toContainText(
    "Still editable",
  );
  // edit and save
  await page
    .locator('[data-id="blocked-line"] .bn-inline-content')
    .first()
    .click();
  await page.keyboard.press("End");
  await page.keyboard.type(" and saved");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  // a preference change applies for this page even though it cannot be stored
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Control panel" });
  await panel.getByLabel("Page width").selectOption("wide");
  await expect(page.locator("html")).toHaveAttribute("data-page-width", "wide");
  await panel.getByLabel("Color scheme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    errors.filter((m) =>
      /insecure|SecurityError|localStorage|sessionStorage/i.test(m),
    ),
  ).toEqual([]);
});
