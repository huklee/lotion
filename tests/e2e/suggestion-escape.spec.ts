import { test, expect } from "./fixtures";
import { seed } from "./helpers";

const line = '[data-id="esc-line"] .bn-inline-content';

test("Esc closes the / menu, also while a Korean character is being composed", async ({
  page,
  browserName,
}) => {
  await seed(page, "Suggestion Esc", [
    { id: "esc-line", type: "paragraph", content: [] },
  ]);
  const menu = page.locator(".bn-suggestion-menu");
  await page.locator(line).first().click();

  // ordinary: "/hea", Esc → closed, the text stays, typing on does not reopen it
  await page.keyboard.type("/hea");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.locator(line).first()).toHaveText("/hea");
  await page.keyboard.type("d");
  await expect(menu).toBeHidden();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");

  // Esc while composing: real IME composition in Chromium, otherwise the
  // keydown a browser sends during composition (isComposing, keyCode 229)
  await page.keyboard.type("/");
  await expect(menu).toBeVisible();
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.imeSetComposition", {
      text: "제",
      selectionStart: 1,
      selectionEnd: 1,
    });
    await expect(page.locator(line).first()).toContainText("/제");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await page
      .locator(line)
      .first()
      .evaluate((el) =>
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 229,
            isComposing: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
  }
  await expect(menu).toBeHidden();
});

test("Esc closes the @ menu as well, keeping the typed text", async ({
  page,
}) => {
  await seed(page, "Mention Esc", [
    { id: "esc-line", type: "paragraph", content: [] },
  ]);
  const menu = page.locator(".bn-suggestion-menu");
  await page.locator(line).first().click();
  await page.keyboard.type("@");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.locator(line).first()).toHaveText("@");
});
