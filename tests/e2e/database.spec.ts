import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { seed } from "./helpers";

async function seedDatabase(page: import("@playwright/test").Page) {
  const parent = await seed(page, "Meetings DB");
  const rows = [];
  for (const [title, kind, status] of [
    ["Kickoff", "Weekly", "Open"],
    ["Review", "1:1", "Done"],
  ]) {
    const child = await (
      await page.request.post("/api/documents", {
        data: { title, parentId: parent.id, mutationId: randomUUID() },
      })
    ).json();
    rows.push({
      id: `row-${title}`,
      href: `#/page/${child.id}`,
      title,
      values: { kind, status },
    });
  }
  const columns = [
    { id: "kind", name: "Kind", type: "text" },
    { id: "status", name: "Status", type: "select", options: ["Open", "Done"] },
    { id: "notes", name: "Notes", type: "text" },
  ];
  const current = await (
    await page.request.get(`/api/documents/${parent.id}`)
  ).json();
  await page.request.put(`/api/documents/${parent.id}/content`, {
    headers: { "If-Match": String(current.revision) },
    data: {
      title: "Meetings DB",
      blocks: [
        {
          id: "db",
          type: "database",
          props: {
            columns: JSON.stringify(columns),
            rows: JSON.stringify(rows),
          },
        },
        { id: "after", type: "paragraph", content: [] },
      ],
      mutationId: randomUUID(),
    },
  });
  await page.reload();
  await expect(page.locator(".lotion-database")).toBeVisible();
  return parent;
}

test("database properties: change type, edit options, move and delete", async ({
  page,
}) => {
  const parent = await seedDatabase(page);
  const db = page.locator(".lotion-database");
  // text → select keeps the values as options
  await db.getByRole("button", { name: "Kind property settings" }).click();
  await page
    .getByRole("dialog", { name: "Kind property settings" })
    .getByLabel("Type")
    .selectOption("select");
  await expect(db.getByLabel("Kind for Kickoff")).toHaveValue("Weekly");
  await expect(db.getByLabel("Kind for Review")).toHaveValue("1:1");
  await page.keyboard.press("Escape");
  // rename an option: the value follows; remove one: its value clears
  await db.getByRole("button", { name: "Status property settings" }).click();
  const menu = page.getByRole("dialog", { name: "Status property settings" });
  await menu.getByLabel("Option 1").fill("Planned");
  await menu.getByLabel("Option 1").press("Enter");
  await expect(db.getByLabel("Status for Kickoff")).toHaveValue("Planned");
  await menu.getByRole("button", { name: "Remove option Done" }).click();
  await expect(db.getByLabel("Status for Review")).toHaveValue("");
  // move left, then delete with an in-page confirmation
  await menu.getByRole("button", { name: "← Move left" }).click();
  await page.keyboard.press("Escape");
  const headers = await db
    .locator("thead th > input")
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(headers).toEqual(["Status", "Kind", "Notes"]);
  await db.getByRole("button", { name: "Notes property settings" }).click();
  await page.getByRole("button", { name: "Delete property…" }).click();
  await page
    .getByRole("button", { name: "Delete property", exact: true })
    .click();
  await expect(db.getByLabel("Notes property name")).toHaveCount(0);
  // persisted
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const saved = await (
    await page.request.get(`/api/documents/${parent.id}`)
  ).json();
  const cols = JSON.parse(saved.blocks[0].props.columns);
  expect(cols.map((c: { name: string }) => c.name)).toEqual(["Status", "Kind"]);
  expect(cols[0].options).toEqual(["Planned"]);
  expect(cols[1]).toMatchObject({ type: "select", options: ["Weekly", "1:1"] });
});

test("database rows: duplicate, move and delete (page goes to the trash)", async ({
  page,
}) => {
  await seedDatabase(page);
  const db = page.locator(".lotion-database");
  const rowActions = (title: string) =>
    db
      .locator("tbody tr", { hasText: title })
      .first()
      .getByRole("button", { name: "Row actions" });
  await rowActions("Kickoff").click();
  await page.getByRole("button", { name: "Duplicate row" }).click();
  await expect(db.locator("tbody tr")).toHaveCount(3);
  const copy = db.locator("tbody tr").nth(1);
  await expect(copy.locator("th button").first()).toContainText("Kickoff");
  await expect(copy.getByLabel(/^Kind for /)).toHaveValue("Weekly");
  // the copy is a real child page in the tree
  await expect(
    page
      .getByRole("navigation", { name: "Pages" })
      .getByRole("link", { name: /Kickoff/ }),
  ).toHaveCount(2);

  await rowActions("Review").click();
  await page.getByRole("button", { name: "↑ Move up" }).click();
  const order = await db
    .locator("tbody tr th button:first-child")
    .allInnerTexts();
  expect(order[1]).toContain("Review");
  await page.keyboard.press("Escape");

  await rowActions("Review").click();
  await page.getByRole("button", { name: "Delete row…" }).click();
  await page.getByRole("button", { name: "Delete row", exact: true }).click();
  await expect(db.locator("tbody tr")).toHaveCount(2);
  await expect(db.getByRole("button", { name: /Review/ })).toHaveCount(0);
  // its page is in the trash (workers share a workspace, so don't rely on the trash count)
  await expect
    .poll(async () => {
      const tree = await (await page.request.get("/api/tree")).json();
      return tree.nodes
        .filter((n: { title: string }) => n.title === "Review")
        .some((n: { deletedAt: string | null }) => !!n.deletedAt);
    })
    .toBe(true);
});
