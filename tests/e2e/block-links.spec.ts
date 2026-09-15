import { expect, test } from "./fixtures";
import { seed } from "./helpers";

test("copies a direct block link and reveals that block on a fresh navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) =>
          localStorage.setItem("direct-block-link", value),
      },
    });
  });
  const blocks = Array.from({ length: 24 }, (_, index) => ({
    id: `direct-${index}`,
    type: "paragraph",
    content: [{ type: "text", text: `Direct link block ${index}`, styles: {} }],
  }));
  const doc = await seed(page, "Direct block link", blocks);
  await page.locator('[data-id="direct-20"] .bn-inline-content').click();
  await page
    .getByRole("button", { name: "Copy block link", exact: true })
    .click();
  await expect(page.locator(".message.notice")).toContainText(
    "Copied a direct link to this block.",
  );
  const copied = await page.evaluate(() =>
    localStorage.getItem("direct-block-link"),
  );
  expect(copied).toBe(
    `${new URL(page.url()).origin}/#/page/${doc.id}#block=direct-20`,
  );

  await page.goto(copied!);
  await expect(page).toHaveURL(/#\/page\/[^#]+#block=direct-20$/);
  const target = page.locator('.bn-block-outer[data-id="direct-20"]');
  await expect(
    page.locator('[data-direct-link-target="direct-20"]'),
  ).toBeVisible();
  await expect(target).toBeInViewport();

  await target.locator(".bn-inline-content").click();
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Clipboard denied");
    };
  });
  await page
    .getByRole("button", { name: "Copy block link", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Clipboard denied");

  await page.goto(
    `${new URL(page.url()).origin}/#/page/${doc.id}#block=deleted-block`,
  );
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Direct block link",
  );
  await expect(page).toHaveURL(/#block=deleted-block$/);
  await expect(page.locator("[data-direct-link-target]")).toHaveCount(0);
});
