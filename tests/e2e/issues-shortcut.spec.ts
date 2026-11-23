import { test, expect } from "./fixtures";
import { seed } from "./helpers";

test("⌘⇧I opens Issues from a page, also while typing; changeable in the Control panel", async ({
  page,
}) => {
  await seed(page, "Shortcut page");
  const title = page.getByRole("textbox", { name: "Page title" });
  await title.focus();
  await page.keyboard.press("ControlOrMeta+Shift+I");
  await expect(page).toHaveURL(/#\/issues$/);
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();

  await page.goBack();
  await expect(title).toHaveValue("Shortcut page");
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const settings = page.getByRole("dialog", { name: "Control panel" });
  const field = settings.getByLabel("Open Issues shortcut");
  await expect(field).toHaveValue(/I$/);
  await field.focus();
  await page.keyboard.press("ControlOrMeta+C");
  await expect(settings.getByRole("status")).toContainText("kept for");
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect(settings.getByRole("status")).toContainText(
    "formatting shortcut",
  );
  // pressing the current shortcut in the field does not navigate
  await page.keyboard.press("ControlOrMeta+Shift+I");
  await expect(page).not.toHaveURL(/#\/issues/);
  await page.keyboard.press("ControlOrMeta+Shift+J");
  await expect(field).toHaveValue(/J$/);
  await settings.getByRole("button", { name: "Close dialog" }).click();

  await title.focus();
  await page.keyboard.press("ControlOrMeta+Shift+I");
  await page.waitForTimeout(300);
  await expect(page).not.toHaveURL(/#\/issues/);
  await page.keyboard.press("ControlOrMeta+Shift+J");
  await expect(page).toHaveURL(/#\/issues$/);

  await page.reload();
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  await expect(settings.getByLabel("Open Issues shortcut")).toHaveValue(/J$/);
  await settings.getByRole("button", { name: "Reset Issues shortcut" }).click();
  await expect(settings.getByLabel("Open Issues shortcut")).toHaveValue(/I$/);
});
