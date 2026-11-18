import { readFileSync } from "node:fs";
import { test, expect, type Page } from "./fixtures";
import { seed } from "./helpers";

const t = (text: string, styles = {}) => ({ type: "text", text, styles });

async function seedPage(page: Page) {
  await seed(page, "주간 보고", [
    {
      id: "h",
      type: "heading",
      props: { level: 2 },
      content: [t("세부 내용")],
    },
    {
      id: "p",
      type: "paragraph",
      content: [t("핵심은 "), t("캐시", { bold: true })],
    },
    { id: "b1", type: "bulletListItem", content: [t("검색")] },
    { id: "b2", type: "bulletListItem", content: [t("추천")] },
    {
      id: "c1",
      type: "checkListItem",
      props: { checked: true },
      content: [t("완료")],
    },
  ]);
}
const view = (page: Page) =>
  page.getByRole("dialog", { name: "Confluence wiki view" });
const unit = (page: Page, id: string) =>
  view(page).locator(`.cf-unit[data-block-id="${id}"]`);
const markup = async (page: Page) => {
  await view(page).getByRole("tab", { name: "Wiki markup" }).click();
  const text = await view(page)
    .getByLabel("Confluence wiki markup")
    .innerText();
  await view(page).getByRole("tab", { name: "Wiki", exact: true }).click();
  return text;
};

test("the Control panel switches the Confluence entry point; it is on by default", async ({
  page,
}) => {
  await seedPage(page);
  const entry = page.getByRole("button", { name: "Confluence", exact: true });
  await expect(entry).toBeVisible();
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Control panel" });
  const toggle = panel.getByLabel("Confluence wiki view");
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(entry).toBeHidden();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "주간 보고",
  );
  await expect(entry).toBeHidden();
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Control panel" })
    .getByLabel("Confluence wiki view")
    .check();
  await expect(entry).toBeVisible();
});

test("the view shows the whole page in Confluence wiki markup and renders it", async ({
  page,
}) => {
  await seedPage(page);
  await page.getByRole("button", { name: "Confluence", exact: true }).click();
  await expect(view(page).locator(".cf-page h1")).toHaveText("주간 보고");
  await expect(unit(page, "h").locator("h2")).toHaveText("세부 내용");
  await expect(unit(page, "p").locator("strong")).toHaveText("캐시");
  await expect(unit(page, "c1").locator(".cf-tick")).toBeVisible();
  expect(await markup(page)).toBe(
    "h1. 주간 보고\n\nh2. 세부 내용\n\n핵심은 *캐시*\n\n* 검색\n* 추천\n* (/) 완료\n",
  );
  await page.keyboard.press("Escape");
  await expect(view(page)).toBeHidden();
});

test("select blocks and turn them into an Info panel or an Expand; change, rename, remove; kept on reopen", async ({
  page,
}) => {
  await seedPage(page);
  await page.getByRole("button", { name: "Confluence", exact: true }).click();
  const toolbar = view(page).getByRole("toolbar", {
    name: "Confluence layout",
  });

  // click + Shift-click selects a range; Info wraps it
  await unit(page, "b1").click();
  await unit(page, "b2").click({ modifiers: ["Shift"] });
  await expect(toolbar).toContainText("2 blocks selected");
  await toolbar.getByRole("button", { name: "Info" }).click();
  await expect(
    view(page).locator('.cf-panel[data-wrap="info"] .cf-unit'),
  ).toHaveCount(2);
  expect(await markup(page)).toContain(
    "핵심은 *캐시*\n\n{info}\n* 검색\n* 추천\n{info}\n\n* (/) 완료",
  );

  // the selected macro: switch to Warning and give it a title
  await view(page)
    .locator('.cf-panel[data-wrap="info"]')
    .click({ position: { x: 4, y: 4 } });
  await expect(toolbar).toContainText("Info selected");
  await toolbar.getByRole("button", { name: "Warning" }).click();
  await toolbar.getByLabel("Macro title").fill("주의");
  await expect(
    view(page).locator('.cf-panel[data-wrap="warning"] .cf-panel-title'),
  ).toHaveText("주의");
  expect(await markup(page)).toContain(
    "{warning:title=주의}\n* 검색\n* 추천\n{warning}",
  );

  // heading + paragraph → Expand titled by the heading
  await unit(page, "h").click();
  await unit(page, "p").click({ modifiers: ["Shift"] });
  await toolbar.getByRole("button", { name: "Expand" }).click();
  await expect(
    view(page).locator('.cf-expand[data-wrap="expand"] .cf-expand-title'),
  ).toHaveText("세부 내용");
  expect(await markup(page)).toContain(
    "h1. 주간 보고\n\n{expand:세부 내용}\n핵심은 *캐시*\n{expand}",
  );

  // kept for this page after closing and reopening
  await view(page)
    .getByRole("button", { name: "Close Confluence view" })
    .click();
  await page.getByRole("button", { name: "Confluence", exact: true }).click();
  await expect(view(page).locator('[data-wrap="expand"]')).toHaveCount(1);
  await expect(view(page).locator('[data-wrap="warning"]')).toHaveCount(1);

  // Remove one; Reset layout removes the rest
  await view(page)
    .locator('[data-wrap="warning"]')
    .click({ position: { x: 4, y: 4 } });
  await toolbar.getByRole("button", { name: "Remove" }).click();
  await expect(view(page).locator('[data-wrap="warning"]')).toHaveCount(0);
  await view(page).getByRole("button", { name: "Reset layout" }).click();
  await expect(view(page).locator("[data-wrap]")).toHaveCount(0);
  expect(await markup(page)).toContain("h2. 세부 내용");
});

test("export: Download .txt saves the wiki markup; Copy wiki markup puts it on the clipboard", async ({
  page,
  context,
  browserName,
}) => {
  await seedPage(page);
  await page.getByRole("button", { name: "Confluence", exact: true }).click();
  await unit(page, "b1").click();
  await view(page)
    .getByRole("toolbar", { name: "Confluence layout" })
    .getByRole("button", { name: "Tip" })
    .click();
  const expected =
    "h1. 주간 보고\n\nh2. 세부 내용\n\n핵심은 *캐시*\n\n{tip}\n* 검색\n{tip}\n\n* 추천\n* (/) 완료\n";
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    view(page).getByRole("button", { name: "Download .txt" }).click(),
  ]);
  // browsers may tidy the suggested name: WebKit decomposes Hangul (NFD) on
  // macOS and turns spaces into "_" on Linux
  expect(download.suggestedFilename().normalize("NFC").replace(/_/g, " ")).toBe(
    "주간 보고.confluence.txt",
  );
  expect(readFileSync((await download.path())!, "utf8")).toBe(expected);

  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await view(page).getByRole("button", { name: "Copy wiki markup" }).click();
    await expect(
      page.getByText("Copied the page as Confluence wiki markup."),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      expected,
    );
  }
});
