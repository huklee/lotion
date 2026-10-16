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
            variant: "meetings",
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
  await expect(settings.getByText(/Control panel → Meeting/)).toBeVisible();

  await expect(settings.getByLabel("Summary style")).toHaveValue("brief");
  await settings.getByLabel("Summary engine").selectOption("claude");
  await settings.getByLabel("Summary skill").selectOption("");
  await settings.getByLabel("Slack channel", { exact: true }).fill("#bad");
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(settings.getByRole("status")).toContainText("Slack channel id");
  await settings.getByLabel("Slack channel", { exact: true }).fill("");
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(settings.getByRole("status")).toHaveText("Saved");
  await page.keyboard.press("Escape");

  // one button on a feed entry: summary page under that meeting
  const entries = db.locator(".lotion-feed-entry");
  await expect(entries).toHaveCount(2);
  await entries
    .nth(0)
    .getByRole("button", { name: "요약", exact: true })
    .click();
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
  expect(body).toContain("핵심·결정 (짧게)");
  expect(body).toContain("Design 회의");
  await toast.getByRole("button", { name: "Dismiss" }).click();

  // pick the condensing for one run from the ▾ menu
  await entries
    .nth(1)
    .getByRole("button", { name: "요약: choose condensing" })
    .click();
  await page
    .getByRole("dialog", { name: "Condensing" })
    .getByRole("button", { name: /결정·액션만/ })
    .click();
  await expect(page.locator(".summary-toast").first()).toContainText(
    "요약 완료 · 요약 · Kickoff 회의",
    { timeout: 15000 },
  );
  const kickoff = (
    await (await page.request.get("/api/tree")).json()
  ).nodes.find((n: any) => n.title === "요약 · Kickoff 회의");
  expect(
    JSON.stringify(
      (await (await page.request.get(`/api/documents/${kickoff.id}`)).json())
        .blocks,
    ),
  ).toContain("결정·액션만");
  await page
    .locator(".summary-toast")
    .first()
    .getByRole("button", { name: "Dismiss" })
    .click();

  // several rows: select both, summarize once, summary goes under the database page
  await entries.nth(0).getByLabel("Select Design 회의").check();
  await entries.nth(1).getByLabel("Select Kickoff 회의").check();
  await db.getByRole("button", { name: "📝 Summarize 2", exact: true }).click();
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

test("Control panel edits meeting-note formats and summaries use them", async ({
  page,
}) => {
  await seedMeetings(page);
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: "Meeting summaries" }),
  ).toBeVisible();
  // no Slack bridge in tests: the channel field falls back to an id input
  await expect(panel.getByText(/Channel list unavailable/)).toBeVisible();
  await expect(panel.getByLabel("Summary prompt")).toHaveValue(
    /Markdown 본문만/,
  );
  const presets = panel.getByRole("listbox", { name: "Presets" });
  await expect(presets.getByRole("option")).toHaveCount(4);
  await panel.getByRole("button", { name: "+ New" }).click();
  await expect(presets.getByRole("option")).toHaveCount(5);
  await panel.getByLabel("Preset name").fill("임원 보고");
  await panel.getByLabel("Preset description").fill("세 줄");
  await panel
    .getByLabel("Preset rules")
    .fill("임원 보고용 세 줄 요약만 작성하세요.");
  await panel.getByRole("button", { name: "Set as default" }).click();
  await expect(
    presets.getByRole("option", { name: /임원 보고 · default/ }),
  ).toBeVisible();
  // delete a built-in, then save
  await presets.getByRole("option", { name: /상세 회의록/ }).click();
  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(presets.getByRole("option")).toHaveCount(4);
  // the test server has no installed skills
  await panel.getByLabel("Summary skill").selectOption("");
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("status")).toHaveText("Saved");
  await page.keyboard.press("Escape");

  // summary menus list the saved formats, the default first-class
  const entries = page.locator(".lotion-feed-entry");
  await entries
    .nth(0)
    .getByRole("button", { name: "요약: choose condensing" })
    .click();
  const menu = page.getByRole("dialog", { name: "Condensing" });
  await expect(
    menu.getByRole("button", { name: /임원 보고 · default/ }),
  ).toBeVisible();
  await expect(menu.getByRole("button", { name: /상세 회의록/ })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  // one button uses the new default
  await entries
    .nth(0)
    .getByRole("button", { name: "요약", exact: true })
    .click();
  await expect(page.locator(".summary-toast").first()).toContainText(
    "요약 완료",
    {
      timeout: 15000,
    },
  );
  const summary = (
    await (await page.request.get("/api/tree")).json()
  ).nodes.find((n: any) => n.title === "요약 · Design 회의");
  expect(
    JSON.stringify(
      (await (await page.request.get(`/api/documents/${summary.id}`)).json())
        .blocks,
    ),
  ).toContain("임원 보고 로 생성");
  // restore built-ins keeps the custom format
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  await page.getByRole("button", { name: /Restore built-in formats/ }).click();
  await expect(
    page.getByRole("listbox", { name: "Presets" }).getByRole("option"),
  ).toHaveCount(5);
});
