import { test, expect, type Page } from "./fixtures";
import { randomUUID } from "node:crypto";
import { seed } from "./helpers";

test("favorites persist, follow titles and sync removal across tabs", async ({
  page,
  context,
}) => {
  const doc = await seed(page, "Favorite page");
  await page
    .getByRole("button", { name: "Add to favorites", exact: true })
    .click();
  const favorites = page.getByRole("navigation", { name: "Favorites" });
  await expect(
    favorites.getByRole("link", { name: "Favorite page", exact: true }),
  ).toHaveAttribute("href", `#/page/${doc.id}`);
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("Renamed favorite");
  await expect(
    favorites.getByRole("link", { name: "Renamed favorite", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    favorites.getByRole("link", { name: "Renamed favorite", exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto(`/#/page/${doc.id}`);
  await other
    .getByRole("button", { name: "Remove from favorites", exact: true })
    .click();
  await expect(favorites).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add to favorites", exact: true }),
  ).toBeVisible();
  await other.close();
});

test("page and Home navigation build history without duplicate entries and preserve drafts", async ({
  page,
}) => {
  const a = await seed(page, "History A");
  const b = await (
    await page.request.post("/api/documents", {
      data: { title: "History B", mutationId: randomUUID() },
    })
  ).json();
  await page.reload();
  const pages = page.getByRole("navigation", { name: "Pages" });
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("History A draft");
  await pages.locator(`a[href="#/page/${b.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(b.id));
  await pages.locator(`a[href="#/page/${b.id}"]`).click();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(a.id));
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "History A draft",
  );
  await page.goForward();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "History B",
  );
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveCount(
    0,
  );
  await page.goBack();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "History B",
  );
  await page.goForward();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveCount(
    0,
  );
});

test("modified sidebar link clicks open the target in another tab without navigating this tab", async ({
  page,
  context,
}) => {
  const a = await seed(page, "New tab source");
  const b = await (
    await page.request.post("/api/documents", {
      data: { title: "New tab target", mutationId: randomUUID() },
    })
  ).json();
  await page.reload();
  const target = page
    .getByRole("navigation", { name: "Pages" })
    .locator(`a[href="#/page/${b.id}"]`);
  await expect(target).toHaveAttribute("href", `#/page/${b.id}`);
  const [other] = await Promise.all([
    context.waitForEvent("page"),
    target.click({ modifiers: ["ControlOrMeta"] }),
  ]);
  await other.waitForURL(new RegExp(`#/page/${b.id}$`));
  await expect(page).toHaveURL(new RegExp(a.id));
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "New tab source",
  );
  await other.close();
});

test("trash and restore retain content", async ({ page }) => {
  await seed(page, "Restore me");
  await page
    .getByRole("button", { name: "Move page to trash", exact: true })
    .click();
  await page.getByRole("button", { name: /^Trash/ }).click();
  const row = page.locator(".trash-row").filter({ hasText: "Restore me" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Restore me",
  );
});
test("sidebar drop nests a page", async ({ page }) => {
  const parent = await seed(page, `Parent ${randomUUID().slice(0, 5)}`);
  const child = (
    await page.request.post("/api/documents", {
      data: {
        title: `Child ${randomUUID().slice(0, 5)}`,
        mutationId: randomUUID(),
      },
    })
  ).json();
  const d = await child;
  await page.reload();
  await revealSidebarPage(page, d.id);
  await revealSidebarPage(page, parent.id);
  const childRow = page
    .locator(".page-row")
    .filter({ has: page.getByRole("link", { name: d.title, exact: true }) });
  const parentRow = page.locator(".page-row").filter({
    has: page.getByRole("link", { name: parent.title, exact: true }),
  });
  await childRow.dragTo(parentRow);
  await expect
    .poll(async () =>
      (await page.request.get(`/api/documents/${d.id}`))
        .json()
        .then((x) => x.parentId),
    )
    .toBe(parent.id);
});

test("sidebar drop reorders siblings at the indicated edge", async ({
  page,
}) => {
  const first = await seed(page, `First ${randomUUID().slice(0, 5)}`);
  const second = await (
    await page.request.post("/api/documents", {
      data: {
        title: `Second ${randomUUID().slice(0, 5)}`,
        mutationId: randomUUID(),
      },
    })
  ).json();
  await page.reload();
  const firstRow = page.locator(".page-row").filter({
    has: page.getByRole("link", { name: first.title, exact: true }),
  });
  const secondRow = page.locator(".page-row").filter({
    has: page.getByRole("link", { name: second.title, exact: true }),
  });
  await revealSidebarPage(page, first.id);
  await revealSidebarPage(page, second.id);
  const box = await firstRow.boundingBox();
  await secondRow.dragTo(firstRow, {
    targetPosition: { x: box!.width / 2, y: 2 },
  });
  await expect
    .poll(async () => {
      const tree = await (await page.request.get("/api/tree")).json();
      return (
        tree.nodes
          .filter((n: any) => !n.parentId && !n.hidden)
          .map((n: any) => n.id)
          .indexOf(second.id) <
        tree.nodes
          .filter((n: any) => !n.parentId && !n.hidden)
          .map((n: any) => n.id)
          .indexOf(first.id)
      );
    })
    .toBe(true);
});

async function revealSidebarPage(page: Page, id: string) {
  const tree = page.getByRole("navigation", { name: "Pages" });
  await expect(tree.locator(".page-row").first()).toBeVisible();
  const link = tree.locator(`a[href="#/page/${id}"]`);
  const more = tree.getByRole("button", {
    name: "Show more pages",
    exact: true,
  });
  while (!(await link.count()) && (await more.isVisible())) await more.click();
  await expect(link).toBeVisible();
}
