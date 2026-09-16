import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export async function seed(
  page: Page,
  title = "Test page",
  blocks?: unknown[],
) {
  const created = await page.request.post("/api/documents", {
    data: { title, mutationId: randomUUID() },
  });
  const doc = await created.json();
  if (blocks) {
    await page.request.put(`/api/documents/${doc.id}/content`, {
      headers: { "If-Match": "1" },
      data: { title, blocks, mutationId: randomUUID() },
    });
  }
  await page.goto(`/#/page/${doc.id}`);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    title,
  );
  return doc;
}
