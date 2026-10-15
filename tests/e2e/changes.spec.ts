import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { seed } from "./helpers";

const text = (value: string) => [{ type: "text", text: value, styles: {} }];

test("recent changes lists edits, renames and trash across pages and opens the page", async ({
  page,
}) => {
  const other = await seed(page, "Roadmap", [
    { id: "rm-1", type: "paragraph", content: text("Quarter goals") },
  ]);
  const doc = await seed(page, "Meeting notes", [
    { id: "mn-1", type: "paragraph", content: text("Agenda") },
  ]);
  // edit in the editor: the change is saved and then appears in the feed
  await page.locator('[data-id="mn-1"] .bn-inline-content').click();
  // line end: ⌘→ on macOS, End elsewhere
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowRight" : "End",
  );
  await page.keyboard.type(" for Thursday");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  // rename and trash the other page through the API
  const current = await (
    await page.request.get(`/api/documents/${other.id}`)
  ).json();
  await page.request.put(`/api/documents/${other.id}/content`, {
    headers: { "If-Match": String(current.revision) },
    data: {
      title: "Roadmap 2027",
      blocks: current.blocks,
      mutationId: randomUUID(),
    },
  });
  await page.request.post(`/api/documents/${other.id}/trash`, {
    headers: { "If-Match": String(current.revision + 1) },
    data: {},
  });

  await page.getByRole("button", { name: "Recent changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Recent changes" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/changes$/);
  await expect(page.locator(".breadcrumb-slash + span")).toHaveText(
    "Recent changes",
  );
  const notes = page.locator(".change-row", { hasText: "Meeting notes" });
  await expect(notes).toBeVisible();
  await expect(notes).toContainText("Edited");
  await expect(notes).toContainText("Agenda for Thursday");
  const roadmap = page.locator(".change-row", { hasText: "Roadmap 2027" });
  await expect(roadmap).toContainText("Renamed");
  await expect(roadmap).toContainText("Moved to trash");
  await expect(roadmap).toContainText("was “Roadmap”");
  await expect(roadmap).toContainText("in trash");
  // newest first: the trashed page changed last
  const titles = await page.locator(".change-title").allInnerTexts();
  expect(titles[0]).toContain("Roadmap 2027");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // opening an entry opens its page; a trashed page opens the trash
  await notes.click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Meeting notes",
  );
  expect(new URL(page.url()).hash).toContain(doc.id);
  await page.getByRole("button", { name: "Recent changes" }).click();
  await page.locator(".change-row", { hasText: "Roadmap 2027" }).click();
  await expect(page.getByRole("heading", { name: "Trash" })).toBeVisible();

  // a direct link (or reload) to #/changes shows the feed instead of the first page
  await page.goto("/#/changes");
  await expect(
    page.getByRole("heading", { name: "Recent changes" }),
  ).toBeVisible();
});

test("recent changes pages through older entries", async ({ page }) => {
  // workers share a workspace across tests, so count relative to what the API reports
  for (let i = 0; i < 35; i++)
    await page.request.post("/api/documents", {
      data: { title: `Feed item ${i}`, mutationId: randomUUID() },
    });
  let total = 0;
  let cursor: string | null = null;
  do {
    const res: { changes: unknown[]; next: string | null } = await (
      await page.request.get(
        `/api/changes?limit=30${cursor ? `&before=${encodeURIComponent(cursor)}` : ""}`,
      )
    ).json();
    total += res.changes.length;
    cursor = res.next;
  } while (cursor);
  expect(total).toBeGreaterThanOrEqual(35);
  await page.goto("/#/changes");
  await expect(page.locator(".change-row")).toHaveCount(30);
  const more = page.getByRole("button", { name: "Show older changes" });
  while (await more.count()) {
    const before = await page.locator(".change-row").count();
    await more.click();
    await expect
      .poll(() => page.locator(".change-row").count())
      .toBeGreaterThan(before);
  }
  await expect(page.locator(".change-row")).toHaveCount(total);
  // no entry is listed twice
  const keys = await page
    .locator(".change-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-change")));
  expect(new Set(keys).size).toBe(keys.length);
});
