import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { seed } from "./helpers";

// Workers share one server; every test uses its own titles.
test("Create issue from a block links both ways; the panel links pages and moves the description", async ({
  page,
}) => {
  const tag = randomUUID().slice(0, 6);
  const doc = await seed(page, `Sync ${tag}`, [
    {
      id: "todo",
      type: "checkListItem",
      props: { checked: false },
      content: [{ type: "text", text: `Ship paste fix ${tag}`, styles: {} }],
      children: [
        {
          id: "step",
          type: "paragraph",
          content: [
            { type: "text", text: "add a regression test", styles: {} },
          ],
          children: [],
        },
      ],
    },
  ]);
  await page.locator('[data-id="todo"] .bn-inline-content').first().hover();
  await page.locator(".bn-side-menu [data-test='dragHandle']").first().click();
  await page.getByRole("menuitem", { name: "Create issue" }).click();
  const toast = page.locator(".issue-toast");
  await expect(toast).toContainText(`Ship paste fix ${tag}`);

  // the page lists it under its title
  const linked = page.getByRole("navigation", { name: "Linked issues" });
  await expect(linked).toContainText(`Ship paste fix ${tag}`);
  await linked.getByRole("button").filter({ hasText: tag }).click();
  await expect(page).toHaveURL(/#\/issues\/\d+$/);
  const panel = page.getByRole("complementary", { name: /Issue #\d+/ });
  await expect(
    panel.getByRole("region", { name: "Description" }).locator("li"),
  ).toContainText("add a regression test");
  await expect(
    panel
      .getByRole("region", { name: "Linked pages" })
      .or(panel.locator(".issue-pages")),
  ).toContainText(`Sync ${tag}`);

  // link a second page from the panel
  await page.request.post("/api/documents", {
    data: { title: `Notes ${tag}`, mutationId: randomUUID() },
  });
  await page.reload();
  await panel.getByRole("button", { name: "Link a page" }).click();
  await panel
    .getByRole("textbox", { name: "Find a page to link" })
    .fill(`Notes ${tag}`);
  await panel.getByRole("button", { name: `Notes ${tag}` }).click();
  await expect(panel.locator(".issue-pages")).toContainText(`Notes ${tag}`);

  // move the description into a page of its own
  await panel
    .getByRole("button", { name: "Move description to a page" })
    .click();
  await expect(
    panel.getByRole("region", { name: "Description" }),
  ).toContainText("moved to the page");
  await expect(panel.locator(".issue-page-chip")).toHaveCount(3);

  // back to the block it came from
  await panel.getByRole("button", { name: /Made from a block in/ }).click();
  await expect(page).toHaveURL(new RegExp(doc.id));
  await expect(page.locator('[data-id="todo"]').first()).toBeVisible();
});

test("archive the Done column, board settings, export menu and stats", async ({
  page,
}) => {
  const tag = randomUUID().slice(0, 6);
  const done = await (
    await page.request.post("/api/issues", {
      data: { title: `Finished ${tag}`, status: "done", labels: [`l${tag}`] },
    })
  ).json();
  await page.goto("/#/issues");
  const card = page.locator(`.issue-card[data-issue="${done.number}"]`);
  await expect(card).toBeVisible();
  await expect(page.getByLabel("Board summary")).toContainText(
    "done this week",
  );

  await page
    .getByRole("listitem", { name: "Done" })
    .getByRole("button", { name: "Archive" })
    .click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Board menu" }).click();
  await expect(
    page.getByRole("menu", { name: "Board menu" }).getByRole("menuitem", {
      name: "Export Markdown",
    }),
  ).toHaveAttribute("href", "/api/issues/export?format=md");
  await page.getByRole("menuitemcheckbox", { name: "Show archived" }).click();
  await expect(card).toBeVisible();

  // label rename in board settings
  await page.getByRole("button", { name: "Board menu" }).click();
  await page.getByRole("menuitem", { name: "Board settings…" }).click();
  const settings = page.getByRole("dialog", { name: "Board settings" });
  await settings
    .getByRole("textbox", { name: `Rename label l${tag}` })
    .fill(`r${tag}`);
  await settings
    .locator("li")
    .filter({
      has: page.getByRole("textbox", { name: `Rename label l${tag}` }),
    })
    .getByRole("button", { name: "Rename" })
    .click();
  await expect(card).toContainText(`r${tag}`);
  await settings.getByRole("button", { name: "Close board settings" }).click();
  await expect(settings).toBeHidden();
});
