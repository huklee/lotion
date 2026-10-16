import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { seed } from "./helpers";

async function seedMeetings(page: import("@playwright/test").Page) {
  const parent = await seed(page, `Summaries ${randomUUID().slice(0, 4)}`);
  const rows = [];
  for (const [title, date, text] of [
    ["Kickoff 회의", "2026-10-01", "kickoff raw notes"],
    ["Design 회의", "2026-10-08", "design raw notes"],
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
      title: parent.title,
      blocks: [
        {
          id: "db",
          type: "database",
          props: {
            columns: JSON.stringify([
              { id: "date", name: "Date", type: "date" },
            ]),
            rows: JSON.stringify(rows),
            views: JSON.stringify([
              {
                id: "feed",
                name: "Feed",
                type: "feed",
                sort: [{ columnId: "date", direction: "desc" }],
                filters: [],
                hidden: [],
              },
              {
                id: "default",
                name: "Table",
                type: "table",
                sort: [],
                filters: [],
                hidden: [],
              },
            ]),
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

test("one-button meeting summary, multi-row summary and summary settings", async ({
  page,
}) => {
  const { parent, rows } = await seedMeetings(page);
  const db = page.locator(".lotion-database");
  // settings: engine, skill, prompt and Slack channel are stored on the server
  await db.getByRole("button", { name: "Summary settings" }).click();
  const settings = page.getByRole("dialog", { name: "Summary settings" });
  await expect(settings.getByLabel("Summary engine")).toHaveValue("codex");
  await expect(settings.getByLabel("Summary prompt")).toHaveValue(/Confluence/);
  await settings.getByLabel("Summary engine").selectOption("claude");
  await settings.getByLabel("Summary skill").selectOption("");
  await settings.getByLabel("Slack channel").fill("#bad");
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(settings.getByRole("status")).toContainText("Slack channel id");
  await settings.getByLabel("Slack channel").fill("");
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(settings.getByRole("status")).toHaveText("Saved");
  await page.keyboard.press("Escape");

  // one button on a feed entry: summary page under that meeting
  const entries = db.locator(".lotion-feed-entry");
  await expect(entries).toHaveCount(2);
  await entries.nth(0).getByRole("button", { name: "요약" }).click();
  const toast = page.locator(".summary-toast").first();
  await expect(toast).toContainText("요약 완료 · 요약 · Design 회의", {
    timeout: 15000,
  });
  await expect(
    entries.nth(0).getByRole("button", { name: "📝 요약" }),
  ).toBeVisible();
  const tree = await (await page.request.get("/api/tree")).json();
  const summary = tree.nodes.find((n: any) => n.title === "요약 · Design 회의");
  expect(summary.parentId).toBe(rows[1].href.replace("#/page/", ""));
  const body = JSON.stringify(
    (await (await page.request.get(`/api/documents/${summary.id}`)).json())
      .blocks,
  );
  expect(body).toContain("핵심 요약 (claude)");
  expect(body).toContain("Design 회의");
  await toast.getByRole("button", { name: "Dismiss" }).click();

  // several rows: select both, summarize once, summary goes under the database page
  await entries.nth(0).getByLabel("Select Design 회의").check();
  await entries.nth(1).getByLabel("Select Kickoff 회의").check();
  await db.getByRole("button", { name: "📝 Summarize 2" }).click();
  await expect(page.locator(".summary-toast").first()).toContainText(
    "Design 회의 외 1건",
    {
      timeout: 15000,
    },
  );
  await expect(page.locator(".summary-toast").first()).toContainText(
    "요약 완료",
  );
  const after = await (await page.request.get("/api/tree")).json();
  const multi = after.nodes.find(
    (n: any) => n.title === "요약 · Design 회의 외 1건",
  );
  expect(multi.parentId).toBe(parent.id);
  const multiBody = JSON.stringify(
    (await (await page.request.get(`/api/documents/${multi.id}`)).json())
      .blocks,
  );
  expect(multiBody).toContain("Design 회의, Kickoff 회의");
  // open the result from the toast
  await page
    .locator(".summary-toast")
    .first()
    .getByRole("button", { name: "열기" })
    .click();
  await expect(page.getByLabel("Page title")).toHaveValue(
    "요약 · Design 회의 외 1건",
  );
});
