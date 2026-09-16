import { randomUUID } from "node:crypto";
import { expect, test } from "./fixtures";
import { seed } from "./helpers";

test("workspace search merges the current draft with the backend index", async ({
  page,
}) => {
  const current = await seed(page, "Current draft", [
    {
      id: "draft-search-block",
      type: "paragraph",
      content: [{ type: "text", text: "Initial text", styles: {} }],
    },
  ]);
  const remote = await page.request.post("/api/documents", {
    data: { title: "Remote page", mutationId: randomUUID() },
  });
  const remoteDocument = await remote.json();
  await page.request.put(`/api/documents/${remoteDocument.id}/content`, {
    headers: { "If-Match": "1" },
    data: {
      title: "Remote page",
      blocks: [
        {
          id: "remote-search-block",
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "A backend-only constellation phrase",
              styles: {},
            },
          ],
        },
      ],
      mutationId: randomUUID(),
    },
  });

  await page
    .locator('[data-id="draft-search-block"] .bn-inline-content')
    .fill("An unsaved browser-draft nebula phrase");
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("textbox", { name: "Search workspace" });
  await search.fill("nebula phrase");
  const draftResult = page.getByRole("button", {
    name: /Current draft.*unsaved browser-draft nebula phrase/i,
  });
  await expect(draftResult).toBeVisible();
  await expect(page.locator(".search-summary")).toContainText("1 result");
  await draftResult.click();
  await expect(page).toHaveURL(
    new RegExp(`#/page/${current.id}#block=draft-search-block$`),
  );
  await expect(page.locator(".direct-link-highlight")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  await search.fill("constellation phrase");
  const backendResult = page.getByRole("button", {
    name: /Remote page.*backend-only constellation phrase.*Content/i,
  });
  await expect(backendResult).toBeVisible();
  await backendResult.click();
  await expect(page).toHaveURL(
    new RegExp(`#/page/${remoteDocument.id}#block=remote-search-block$`),
  );
  await expect(page.locator(".direct-link-highlight")).toBeVisible();
});

test("workspace search reports no matches and restores editor focus", async ({
  page,
}) => {
  await seed(page, "Focus page", [
    {
      id: "focus-search-block",
      type: "paragraph",
      content: [{ type: "text", text: "Keep editing here", styles: {} }],
    },
  ]);
  const editorContent = page.locator(
    '[data-id="focus-search-block"] .bn-inline-content',
  );
  await editorContent.click();
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("textbox", { name: "Search workspace" });
  await search.fill("no-such-workspace-result");
  await expect(
    page.getByText("No matching titles or document content."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).not.toBeVisible();
  await expect(page.locator(".tiptap")).toBeFocused();
});
