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
    .locator("thead th.lotion-database-property .ldb-th-button span")
    .allInnerTexts();
  expect(headers).toEqual(["Status", "Kind", "Notes"]);
  await db.getByRole("button", { name: "Notes property settings" }).click();
  await page.getByRole("button", { name: "Delete property…" }).click();
  await page
    .getByRole("button", { name: "Delete property", exact: true })
    .click();
  await expect(
    db.getByRole("button", { name: "Notes property settings" }),
  ).toHaveCount(0);
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
  const parent = await seedDatabase(page);
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
  // (checked through the API: workers share a workspace with other "Kickoff" pages)
  await expect
    .poll(async () => {
      const tree = await (await page.request.get("/api/tree")).json();
      return tree.nodes.filter(
        (node: any) =>
          node.parentId === parent.id &&
          !node.deletedAt &&
          /Kickoff/.test(node.title),
      ).length;
    })
    .toBe(2);

  await rowActions("Review").click();
  await page.getByRole("button", { name: "↑ Move up" }).click();
  const order = await db
    .locator("tbody tr th button:first-of-type")
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

test("database views: filter, sort, hide properties and saved views", async ({
  page,
}) => {
  const parent = await seedDatabase(page);
  const db = page.locator(".lotion-database");
  const titles = () =>
    db
      .locator(".lotion-database-row-title button:first-of-type")
      .allInnerTexts();
  await expect(db.getByRole("tab", { name: /Table/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // filter: Status is Done
  await db.getByRole("button", { name: "Filter" }).click();
  const filter = page.getByRole("dialog", { name: "Filter" });
  await filter.getByRole("button", { name: "+ Add filter" }).click();
  await filter
    .getByLabel("Filter 1 property")
    .selectOption({ label: "Status" });
  await filter.getByLabel("Filter 1 condition").selectOption("is");
  await filter.getByLabel("Filter 1 value").selectOption("Done");
  await page.keyboard.press("Escape");
  await expect.poll(titles).toEqual(["📄 Review"]);
  await expect(db.getByText("1 of 2")).toBeVisible();
  // a new row in a filtered view satisfies the filter
  await db.getByRole("button", { name: "New row page" }).click();
  await expect.poll(async () => (await titles()).length).toBe(2);
  await expect(db.getByLabel("Status for Untitled row")).toHaveValue("Done");
  // second view: sort by Page descending, hide Notes
  await db.getByRole("button", { name: "Add view" }).click();
  await page
    .getByRole("dialog", { name: "Add view" })
    .getByRole("button", { name: "▦ Table" })
    .click();
  await expect(db.getByRole("tab", { name: /Table 2/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect.poll(async () => (await titles()).length).toBe(3);
  await db.getByRole("button", { name: "Sort" }).click();
  const sort = page.getByRole("dialog", { name: "Sort" });
  await sort.getByRole("button", { name: "+ Add sort" }).click();
  await sort.getByLabel("Sort 1 direction").selectOption("desc");
  await page.keyboard.press("Escape");
  await expect
    .poll(titles)
    .toEqual(["📄 Untitled row", "📄 Review", "📄 Kickoff"]);
  await db.getByRole("button", { name: /^Properties/ }).click();
  await page
    .getByRole("dialog", { name: "Visible properties" })
    .getByLabel("Notes")
    .uncheck();
  await page.keyboard.press("Escape");
  await expect(
    db.getByRole("button", { name: "Notes property settings" }),
  ).toHaveCount(0);
  // views are stored in the block and survive a reload
  await expect
    .poll(async () => {
      const doc = await (
        await page.request.get(`/api/documents/${parent.id}`)
      ).json();
      const block = doc.blocks.find((b: any) => b.type === "database");
      return JSON.parse(block.props.views || "[]").length;
    })
    .toBe(2);
  await page.reload();
  await db.getByRole("tab", { name: /^Table$/ }).click();
  await expect.poll(async () => (await titles()).length).toBe(2);
  await expect(
    db.getByRole("button", { name: "Notes property settings" }),
  ).toBeVisible();
  await db.getByRole("tab", { name: /Table 2/ }).click();
  await expect(
    db.getByRole("button", { name: "Notes property settings" }),
  ).toHaveCount(0);
  // delete the second view
  await db.getByRole("button", { name: "Table 2 view settings" }).click();
  await page
    .getByRole("dialog", { name: "View settings" })
    .getByRole("button", { name: "Delete view" })
    .click();
  await expect(db.getByRole("tab")).toHaveCount(1);
});

async function seedMeetings(page: import("@playwright/test").Page) {
  const parent = await seed(page, "Weekly sync");
  const rows = [];
  for (const [title, date, text] of [
    ["Older meeting", "2026-10-01", "older body text"],
    ["Newest meeting", "2026-10-15", "newest body text"],
    ["Middle meeting", "2026-10-08", "middle body text"],
  ]) {
    const child = await (
      await page.request.post("/api/documents", {
        data: { title, parentId: parent.id, mutationId: randomUUID() },
      })
    ).json();
    await page.request.put(`/api/documents/${child.id}/content`, {
      headers: { "If-Match": String(child.revision) },
      data: {
        title,
        blocks: [
          {
            id: randomUUID(),
            type: "paragraph",
            content: [{ type: "text", text, styles: {} }],
          },
        ],
        mutationId: randomUUID(),
      },
    });
    rows.push({
      id: `row-${date}`,
      href: `#/page/${child.id}`,
      title,
      values: { date },
    });
  }
  const current = await (
    await page.request.get(`/api/documents/${parent.id}`)
  ).json();
  await page.request.put(`/api/documents/${parent.id}/content`, {
    headers: { "If-Match": String(current.revision) },
    data: {
      title: "Weekly sync",
      blocks: [
        {
          id: "db",
          type: "database",
          props: {
            variant: "meetings",
            columns: JSON.stringify([
              { id: "date", name: "Date", type: "date" },
              { id: "kind", name: "Kind", type: "text" },
            ]),
            rows: JSON.stringify(rows),
          },
        },
      ],
      mutationId: randomUUID(),
    },
  });
  await page.reload();
  await expect(page.locator(".lotion-database")).toBeVisible();
  return { parent, rows };
}

async function pageText(
  page: import("@playwright/test").Page,
  href: string,
): Promise<string> {
  const id = href.replace("#/page/", "");
  const doc = await (await page.request.get(`/api/documents/${id}`)).json();
  return JSON.stringify(doc.blocks);
}

test("database feed: newest first, edit in place, new meeting from a template", async ({
  page,
}) => {
  const { rows } = await seedMeetings(page);
  const db = page.locator(".lotion-database");
  await db.getByRole("button", { name: "Add view" }).click();
  await page
    .getByRole("dialog", { name: "Add view" })
    .getByRole("button", { name: /Feed/ })
    .click();
  const entries = db.locator(".lotion-feed-entry");
  await expect(entries).toHaveCount(3);
  await expect(entries.locator(".lotion-feed-title")).toHaveText([
    "📄 Newest meeting",
    "📄 Middle meeting",
    "📄 Older meeting",
  ]);
  // older entries are read inline
  await expect(entries.nth(1).locator(".lotion-feed-body")).toContainText(
    "middle body text",
  );
  await expect(entries.nth(2).locator(".lotion-feed-body")).toContainText(
    "older body text",
  );
  // the newest is editable in place and saves to its own page
  const newest = entries
    .nth(0)
    .locator(".lotion-feed-editor [contenteditable=true]");
  await expect(newest).toContainText("newest body text");
  await newest.getByText("newest body text").click();
  // End scrolls instead of moving the caret on macOS.
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowRight" : "End",
  );
  await page.keyboard.type(" edited inline");
  await expect
    .poll(() => pageText(page, rows[1].href), { timeout: 15000 })
    .toContain("newest body text edited inline");
  // any other entry can be edited too
  await entries.nth(2).getByRole("button", { name: "Edit here" }).click();
  await expect(
    entries.nth(2).locator(".lotion-feed-editor [contenteditable=true]"),
  ).toContainText("older body text");
  await entries.nth(2).getByRole("button", { name: "Done" }).click();
  await expect(entries.nth(2).locator(".lotion-feed-body")).toBeVisible();
  // the parent page itself is untouched by inline edits
  await expect(page.getByText("Unsaved draft")).toHaveCount(0);

  // new meeting without a template: today's date and the skeleton
  await db.getByRole("button", { name: "+ New meeting" }).click();
  await expect(entries).toHaveCount(4);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await expect(entries.nth(0).locator(".lotion-feed-title")).toHaveText(
    `📄 ${today} 회의`,
  );
  await expect(entries.nth(0)).toContainText(today);
  await expect(entries.nth(0).locator(".lotion-feed-editor")).toContainText(
    "결정 사항",
  );

  // middle meeting as the template
  await db.getByRole("tab", { name: /Table/ }).click();
  await db
    .getByRole("row", { name: /Middle meeting/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page
    .getByRole("dialog", { name: "Row actions" })
    .getByRole("button", { name: "Use as template for new entries" })
    .click();
  await db.getByRole("tab", { name: /Feed/ }).click();
  await expect(entries).toHaveCount(4);
  await expect(entries.nth(0).locator(".lotion-feed-editor")).toBeVisible();
  // bodies load lazily and shift the layout; click once the feed has settled
  await expect(db.getByText("Loading…")).toHaveCount(0);
  await db.getByRole("button", { name: "+ New meeting" }).click();
  await expect(entries).toHaveCount(5, { timeout: 15000 });
  await expect(entries.nth(0).locator(".lotion-feed-title")).toHaveText(
    `📄 ${today} 회의`,
  );
  await expect(entries.nth(0).locator(".lotion-feed-editor")).toContainText(
    "middle body text",
  );
  // the earlier entry stays open where the user was editing it
  await expect(entries.nth(1)).toContainText("결정 사항");
  // clicking inside the database never selects the whole block in the page editor
  await entries
    .nth(0)
    .locator(".lotion-feed-editor [contenteditable=true]")
    .click();
  expect(
    await db.evaluate(
      (element) => getComputedStyle(element, "::after").display,
    ),
  ).not.toBe("block");
  if (process.env.SHOT)
    await page.screenshot({ path: process.env.SHOT, fullPage: true });
});

test("database period presets and bulk delete of selected rows", async ({
  page,
}) => {
  const { rows } = await seedMeetings(page);
  const db = page.locator(".lotion-database");
  const titles = () =>
    db
      .locator(".lotion-database-row-title button:first-of-type")
      .allInnerTexts();
  await expect.poll(async () => (await titles()).length).toBe(3);
  // no seeded meeting is dated today
  await db.getByLabel("Period").selectOption("today");
  await expect(
    db.getByText("No rows match this view's filters."),
  ).toBeVisible();
  await expect(db.getByRole("button", { name: "Filter (1)" })).toBeVisible();
  await db.getByLabel("Period").selectOption("");
  await expect.poll(async () => (await titles()).length).toBe(3);
  // select two rows, delete them together
  await db.getByLabel("Select Older meeting").check();
  await db.getByLabel("Select Middle meeting").check();
  const bar = db.getByRole("toolbar", { name: "Selected rows" });
  await expect(bar).toContainText("2 selected");
  await bar.getByRole("button", { name: "Delete…" }).click();
  await bar.getByRole("button", { name: "Delete rows" }).click();
  await expect.poll(titles).toEqual(["📄 Newest meeting"]);
  await expect(bar).toHaveCount(0);
  await expect
    .poll(async () => {
      const tree = await (await page.request.get("/api/tree")).json();
      return [rows[0].href, rows[2].href].map(
        (href) =>
          !!tree.nodes.find((n: any) => `#/page/${n.id}` === href)?.deletedAt,
      );
    })
    .toEqual([true, true]);
});

test("Meeting logs block vs basic database, and the Table | Feed layout switch", async ({
  page,
}) => {
  await seedDatabase(page);
  const basic = page.locator(".lotion-database").first();
  // a basic database: no meeting or summary features
  await expect(
    basic.getByRole("button", { name: "Summary settings" }),
  ).toHaveCount(0);
  await expect(
    basic.getByRole("button", { name: "New row page" }),
  ).toBeVisible();
  // switch the current view's layout to Feed and back
  await basic.getByRole("button", { name: "Feed layout" }).click();
  await expect(
    basic.getByRole("button", { name: "Feed layout" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(basic.locator(".lotion-feed-entry")).toHaveCount(2);
  await expect(
    basic.getByRole("button", { name: "요약", exact: true }),
  ).toHaveCount(0);
  await basic.getByRole("button", { name: "Table layout" }).click();
  await expect(basic.locator("tbody tr")).toHaveCount(2);

  // the basic database can become Meeting logs from its view menu
  await basic.getByRole("button", { name: "Table view settings" }).click();
  await page.getByLabel("Database type").selectOption("meetings");
  await page.keyboard.press("Escape");
  await expect(
    basic.getByRole("button", { name: "Summary settings" }),
  ).toBeVisible();
  await expect(
    basic.getByRole("button", { name: "+ New meeting" }),
  ).toBeVisible();
});

test("/Meeting logs inserts the meeting preset", async ({ page }) => {
  // "/Meeting logs" inserts the meeting preset
  await seed(page, "Logs page", [
    { id: "logs-here", type: "paragraph", content: [] },
  ]);
  await page.locator('[data-id="logs-here"] .bn-inline-content').click();
  await page.keyboard.type("/meeting logs");
  await page
    .getByRole("option")
    .filter({ hasText: "one-button summaries" })
    .click();
  const logs = page.locator(".lotion-database");
  await expect(logs.getByLabel("Database title")).toHaveValue("Meeting logs");
  await expect(logs.getByRole("tab", { name: "Feed" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    logs.getByRole("button", { name: "Summary settings" }),
  ).toBeVisible();
  await logs.getByRole("button", { name: "+ New meeting" }).click();
  await expect(logs.locator(".lotion-feed-entry")).toHaveCount(1);
  await expect(logs.locator(".lotion-feed-entry").first()).toContainText(
    "회의",
  );
  await expect(logs.locator(".lotion-feed-entry").first()).toContainText(
    "결정 사항",
  );
  await expect(
    logs.getByRole("button", { name: "요약", exact: true }),
  ).toBeVisible();
});
