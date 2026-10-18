import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { seed } from "./helpers";

test("new meetings and summaries appear in the bell; clicking opens the page; new meetings are linked at the page end", async ({
  page,
}) => {
  // (each test has its own server/workspace? workers share one, so count from now)
  const host = await seed(page, `Notify ${randomUUID().slice(0, 4)}`, [
    { id: "here", type: "paragraph", content: [] },
  ]);
  await page.request.post("/api/notifications/seen", { data: {} });
  await page.reload();
  const bell = page.getByRole("button", { name: /^Notifications/ });
  await expect(bell).toHaveAccessibleName("Notifications");

  await page.locator('[data-id="here"] .bn-inline-content').click();
  await page.keyboard.type("/meeting logs");
  await page
    .getByRole("option")
    .filter({ hasText: "one-button summaries" })
    .click();
  const logs = page.locator(".lotion-database");
  await page.request.put("/api/summary/settings", { data: { skill: "" } });
  await logs.getByRole("button", { name: "+ New meeting" }).click();
  await expect(logs.locator(".lotion-feed-entry")).toHaveCount(1);
  const d = new Date();
  const title = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 회의`;

  // a link to the new meeting at the end of the page
  const editor = page.locator(".bn-editor").first();
  await expect(
    editor
      .locator(`a, [data-inline-content-type="mention"]`)
      .filter({ hasText: title })
      .last(),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const doc = await (
        await page.request.get(`/api/documents/${host.id}`)
      ).json();
      const last = doc.blocks
        .filter((b: any) => (b.content ?? []).length)
        .at(-1);
      return last?.content?.[0]?.props?.label ?? "";
    })
    .toBe(title);

  // the bell shows it
  await expect(bell).toHaveAccessibleName(/1 unread/);
  // a summary adds another event
  await logs.getByRole("button", { name: "요약", exact: true }).click();
  await expect(page.locator(".summary-toast").first()).toContainText(
    "요약 완료",
    { timeout: 15000 },
  );
  await expect(bell).toHaveAccessibleName(/2 unread/);
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  const items = panel.locator(".notification-item");
  await expect(items.first()).toContainText("Summary written");
  await expect(items.first()).toContainText(`요약 · ${title}`);
  await expect(items.nth(1)).toContainText("New meeting");
  await expect(items.nth(1)).toContainText(title);
  await expect(panel.getByText("오늘")).toBeVisible();
  // opening marked them read
  await expect(bell).toHaveAccessibleName("Notifications");
  // click → opens the meeting page
  await items.nth(1).click();
  await expect(page.getByLabel("Page title")).toHaveValue(title);
  await expect(panel).toHaveCount(0);
});
