import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { seed } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("on a phone the page tree and the page are shown one at a time", async ({
  page,
}) => {
  const first = await seed(page, `Phone A ${randomUUID().slice(0, 4)}`);
  const second = await (
    await page.request.post("/api/documents", {
      data: {
        title: `Phone B ${randomUUID().slice(0, 4)}`,
        mutationId: randomUUID(),
      },
    })
  ).json();
  await page.reload();
  const tree = page.getByRole("navigation", { name: "Pages" });
  const title = page.getByRole("textbox", { name: "Page title" });
  const tabs = page.getByRole("navigation", { name: "View" });
  // starts on the page, full width, tree hidden
  await expect(title).toHaveValue(first.title);
  await expect(tree).toBeHidden();
  const mainWidth = await page
    .locator("main")
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(mainWidth).toBeGreaterThan(380);
  // Pages: the tree fills the screen, the page is hidden
  await tabs.getByRole("button", { name: "Pages", exact: true }).click();
  await expect(tree).toBeVisible();
  await expect(page.locator("main")).toBeHidden();
  const sidebarWidth = await page
    .locator(".sidebar")
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(sidebarWidth).toBeGreaterThan(380);
  // choosing a page opens it in the page view
  await tree.getByRole("link", { name: second.title, exact: true }).click();
  await expect(title).toHaveValue(second.title);
  await expect(tree).toBeHidden();
  await expect(
    tabs.getByRole("button", { name: "Page", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // the top bar's ☰ also opens the tree; choosing the open page goes back to it
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expect(tree).toBeVisible();
  await tree.getByRole("link", { name: second.title, exact: true }).click();
  await expect(tree).toBeHidden();
  await expect(title).toHaveValue(second.title);
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("desktop keeps the tree and the page side by side, without the phone tab bar", async ({
    page,
  }) => {
    await seed(page, "Desktop layout");
    await expect(page.getByRole("navigation", { name: "Pages" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Page title" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "View" })).toHaveCount(0);
  });
});
