import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "./fixtures";
import { seed } from "./helpers";

/** A key as a browser in Korean (두벌식) input mode reports it. */
async function koreanKey(page: Page, key: string, code: string, shift = false) {
  await page.evaluate(
    ([key, code, shift]) => {
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: key as string,
          code: code as string,
          shiftKey: shift as boolean,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [key, code, shift] as const,
  );
}

test("board shortcuts and g i / g h work in Korean input mode", async ({
  page,
}) => {
  const prefix = `H${randomUUID().slice(0, 6)}`;
  const issue = await (
    await page.request.post("/api/issues", { data: { title: `${prefix} one` } })
  ).json();
  await seed(page, `Korean ${prefix}`);
  await page.locator(".topbar").click({ position: { x: 600, y: 10 } });
  // ㅎ ㅑ = g i
  await koreanKey(page, "ㅎ", "KeyG");
  await koreanKey(page, "ㅑ", "KeyI");
  await expect(page).toHaveURL(/#\/issues$/);
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();

  // filter to our issue, then ㅓ (j) focuses it and ㅐ (o) opens it
  await page.getByRole("textbox", { name: "Filter issues" }).fill(prefix);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await koreanKey(page, "ㅓ", "KeyJ");
  const card = page.locator(`.issue-card[data-issue="${issue.number}"]`);
  await expect(card).toBeFocused();
  // ⇧L under Korean input: move to Todo
  await koreanKey(page, "ㅣ", "KeyL", true);
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/issues/${issue.number}`)).json())
          .status,
    )
    .toBe("todo");
  await koreanKey(page, "ㅐ", "KeyO");
  await expect(page).toHaveURL(new RegExp(`#/issues/${issue.number}$`));
  await page.keyboard.press("Escape");
  // ? (Shift+Slash) opens the shortcut list
  await koreanKey(page, "?", "Slash", true);
  await expect(
    page.getByRole("dialog", { name: "Issue shortcuts" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // ㅎ ㅗ = g h: Home, leaving the board
  await koreanKey(page, "ㅎ", "KeyG");
  await koreanKey(page, "ㅗ", "KeyH");
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole("heading", { name: "Issues" })).toHaveCount(0);
  await expect(page.locator(".home-content").first()).toBeVisible();
});

test("the logo goes Home, and Home shows recent changes that open the page", async ({
  page,
}) => {
  const title = `Recent ${randomUUID().slice(0, 6)}`;
  const doc = await seed(page, title, [
    {
      id: "r1",
      type: "paragraph",
      content: [{ type: "text", text: "changed text", styles: {} }],
      children: [],
    },
  ]);
  await page.goto("/#/issues");
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
  const recent = page.getByRole("region", { name: "Recent changes" });
  await expect(recent).toBeVisible();
  const row = recent.locator(".change-row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(doc.id));

  // the logo itself
  await page.getByRole("button", { name: "Lotion home" }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await page
    .getByRole("region", { name: "Recent changes" })
    .getByRole("button", { name: "See all" })
    .click();
  await expect(page).toHaveURL(/#\/changes$/);
});
