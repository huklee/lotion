import { test, expect } from "./fixtures";
import { seed } from "./helpers";

const t = (text: string, styles = {}) => ({ type: "text", text, styles });

async function seedPage(page: import("@playwright/test").Page) {
  await seed(page, "Confluence 보고", [
    { id: "h", type: "heading", props: { level: 2 }, content: [t("요약")] },
    {
      id: "p",
      type: "paragraph",
      content: [t("핵심은 "), t("캐시", { bold: true }), t(" 입니다.")],
    },
    {
      id: "b1",
      type: "bulletListItem",
      content: [t("검색")],
      children: [{ id: "b2", type: "bulletListItem", content: [t("Phase 2")] }],
    },
    {
      id: "c1",
      type: "checkListItem",
      props: { checked: true },
      content: [t("완료")],
    },
    {
      id: "code",
      type: "codeBlock",
      props: { language: "python" },
      content: [t("print('hi')")],
    },
  ]);
}

test("Export → Preview as Confluence shows the converted page and its storage format", async ({
  page,
}) => {
  await seedPage(page);
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /Preview as Confluence/ }).click();
  const frame = page.frameLocator('iframe[title="Confluence preview"]');
  await expect(frame.locator("h1")).toHaveText("Confluence 보고");
  await expect(frame.locator("h2")).toHaveText("요약");
  await expect(frame.locator("strong")).toHaveText("캐시");
  await expect(frame.locator("ul > li > ul > li")).toHaveText("Phase 2");
  await expect(frame.locator("ul.task-list input[checked]")).toHaveCount(1);
  await expect(frame.locator(".code-panel code")).toHaveText("print('hi')");
  // the preview cannot run scripts
  expect(
    await page
      .locator('iframe[title="Confluence preview"]')
      .getAttribute("sandbox"),
  ).toBe("");
  await page.getByRole("tab", { name: "Storage format" }).click();
  const source = page.getByLabel("Confluence storage format");
  await expect(source).toContainText("<ac:task-list>");
  await expect(source).toContainText(
    '<ac:structured-macro ac:name="code" ac:schema-version="1"><ac:parameter ac:name="language">python</ac:parameter>',
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Copy page for Confluence/ }),
  ).toBeVisible();
});

test("Copy page for Confluence puts formatted HTML and the storage format on the clipboard", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "clipboard reading is only granted in Chromium tests",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seedPage(page);
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /Copy page for Confluence/ }).click();
  await expect(
    page.getByText("Copied this page for Confluence."),
  ).toBeVisible();
  const copied = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return {
      html: await (await item.getType("text/html")).text(),
      text: await (await item.getType("text/plain")).text(),
    };
  });
  expect(copied.html).toContain("<h1>Confluence 보고</h1>");
  expect(copied.html).toContain("<strong>캐시</strong>");
  expect(copied.text).toContain('<ac:structured-macro ac:name="code"');
});
