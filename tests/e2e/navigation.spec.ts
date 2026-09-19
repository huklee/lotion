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

test("topbar duplicates the current saved draft and opens the copy", async ({
  page,
}) => {
  const source = await seed(page, `Topbar copy ${randomUUID().slice(0, 5)}`, [
    {
      id: "topbar-copy-content",
      type: "paragraph",
      content: [{ type: "text", text: "Original body", styles: {} }],
    },
  ]);
  const title = page.getByRole("textbox", { name: "Page title" });
  await title.fill("Edited before duplicate");
  await page
    .locator('[data-id="topbar-copy-content"] .bn-inline-content')
    .fill("Edited body before duplicate");

  await page.getByRole("button", { name: "Duplicate page" }).click();
  await expect(title).toHaveValue("Edited before duplicate (copy)");
  await expect(page).not.toHaveURL(new RegExp(`${source.id}$`));
  await expect(
    page.locator('[data-id="topbar-copy-content"] .bn-inline-content'),
  ).toHaveText("Edited body before duplicate");
  await expect(page.locator(".save-status")).toHaveText("Saved");
});

test("move dialog shows a collapsible document tree and excludes descendants", async ({
  page,
}) => {
  const parent = await seed(page, `Move parent ${randomUUID().slice(0, 5)}`);
  const child = await (
    await page.request.post("/api/documents", {
      data: {
        title: "Move child",
        parentId: parent.id,
        mutationId: randomUUID(),
      },
    })
  ).json();
  await page.request.post("/api/documents", {
    data: {
      title: "Move grandchild",
      parentId: child.id,
      mutationId: randomUUID(),
    },
  });
  const moving = await (
    await page.request.post("/api/documents", {
      data: { title: "Moving page", mutationId: randomUUID() },
    })
  ).json();
  await page.request.post("/api/documents", {
    data: {
      title: "Excluded descendant",
      parentId: moving.id,
      mutationId: randomUUID(),
    },
  });
  await page.goto(`/#/page/${moving.id}`);

  await page.getByRole("button", { name: "Move page", exact: true }).click();
  const tree = page.getByRole("tree", { name: "Document tree" });
  await expect(
    tree.getByRole("treeitem", { name: /Move parent/ }),
  ).toHaveAttribute("aria-level", "1");
  await expect(
    page.getByRole("button", { name: "Move to Move child" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Move to Move grandchild" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Move to Excluded descendant" }),
  ).toHaveCount(0);

  await tree.getByRole("button", { name: `Collapse ${parent.title}` }).click();
  await expect(
    page.getByRole("button", { name: "Move to Move child" }),
  ).toHaveCount(0);
  await tree.getByRole("button", { name: `Expand ${parent.title}` }).click();
  await page.getByRole("button", { name: "Move to Move child" }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/documents/${moving.id}`)).json())
          .parentId,
    )
    .toBe(child.id);
  await expect(page.getByRole("dialog", { name: "move" })).toHaveCount(0);
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
  const updatedParent = await (
    await page.request.get(`/api/documents/${parent.id}`)
  ).json();
  expect(JSON.stringify(updatedParent.blocks)).toContain(`#/page/${d.id}`);
  await expect(page.locator(`.tiptap a[href="#/page/${d.id}"]`)).toHaveCount(1);
});

test("sidebar child creation and duplication add links to the parent page", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const parent = await seed(page, `Linked parent ${randomUUID().slice(0, 5)}`);
  await revealSidebarPage(page, parent.id);
  const row = page.locator(".page-row").filter({
    has: page.getByRole("link", { name: parent.title, exact: true }),
  });
  await row
    .getByRole("button", { name: `Add child to ${parent.title}` })
    .click();
  await expect
    .poll(() => page.url(), { timeout: 15_000 })
    .not.toContain(parent.id);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Untitled",
  );
  const childId = new URL(page.url()).hash.split("/").at(-1)!;

  await revealSidebarPage(page, childId);
  const childRow = page.locator(".page-row").filter({
    has: page.locator(`a[href="#/page/${childId}"]`),
  });
  await childRow
    .getByRole("button", { name: "Duplicate Untitled", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Untitled (copy)",
  );
  const copyId = new URL(page.url()).hash.split("/").at(-1)!;
  const updatedParent = await (
    await page.request.get(`/api/documents/${parent.id}`)
  ).json();
  const serialized = JSON.stringify(updatedParent.blocks);
  expect(serialized).toContain(`#/page/${childId}`);
  expect(serialized).toContain(`#/page/${copyId}`);

  await page.goto(`/#/page/${parent.id}`);
  await expect(page.locator(`.tiptap a[href="#/page/${childId}"]`)).toHaveCount(
    1,
  );
  await expect(page.locator(`.tiptap a[href="#/page/${copyId}"]`)).toHaveCount(
    1,
  );
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
