import { test, expect } from "./fixtures";
import { randomUUID } from "node:crypto";
import { seed } from "./helpers";

test("page mentions support at-sign and double-bracket shortcuts plus URL chips", async ({
  page,
  context,
}) => {
  const targetName = `Mention target ${randomUUID().slice(0, 8)}`;
  const bracketName = `Bracket target ${randomUUID().slice(0, 8)}`;
  const targetResponse = await page.request.post("/api/documents", {
    data: { title: targetName, mutationId: randomUUID() },
  });
  const target = await targetResponse.json();
  const bracketResponse = await page.request.post("/api/documents", {
    data: { title: bracketName, mutationId: randomUUID() },
  });
  const bracketTarget = await bracketResponse.json();
  const source = await seed(page, "Mention source");
  const editor = page.locator(".tiptap");
  await editor.click();
  await page.keyboard.type(`Keep this text @${targetName}`);
  await page.getByRole("option").filter({ hasText: targetName }).click();
  await expect(editor.locator(`a[href="#/page/${target.id}"]`)).toHaveCount(1);
  await page.keyboard.type(`[[${bracketName}`);
  await page.keyboard.press("Enter");
  await expect(
    editor.locator(`a[href="#/page/${bracketTarget.id}"]`),
  ).toHaveCount(1);
  await page.keyboard.type(" @Mention source");
  await page.getByRole("option").filter({ hasText: "Mention source" }).click();
  const selfMention = editor.locator(`a[href="#/page/${source.id}"]`);
  await expect(selfMention).toHaveClass(/lotion-mention/);
  await page.getByRole("button", { name: "Change page icon" }).click();
  await page.getByRole("textbox", { name: "Search emojis" }).fill("compass");
  await page.getByRole("button", { name: "Use 🧭 compass icon" }).click();
  await expect(selfMention).toHaveText("🧭 Mention source");

  const external =
    "https://techblog-history-younghunjo1.tistory.com/207#google_vignette";
  const previewTitle = "Recommendation systems: Wide & Deep Learning";
  const image = await page.request.post("/api/assets", {
    multipart: {
      file: {
        name: "preview.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  const asset = await image.json();
  await page.route("**/api/link-preview", (route) =>
    route.fulfill({
      json: {
        title: previewTitle,
        description: "Article summary",
        image: asset.url,
        fetchedAt: new Date().toISOString(),
      },
    }),
  );
  await editor.evaluate((element, url) => {
    const data = new DataTransfer();
    data.setData("text/plain", url);
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    // Firefox discards clipboardData passed to synthetic ClipboardEvent constructors.
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  }, external);
  const chooser = page.getByRole("dialog", { name: "Paste link" });
  await expect(chooser).toBeVisible();
  await chooser.getByRole("button", { name: "Paste as mention" }).click();
  await expect(editor.locator(`a[href="${external}"]`)).toHaveText(
    `🌐 ${previewTitle}`,
  );
  await expect(editor.locator(`a[href="${external}"]`)).toHaveClass(
    /lotion-mention/,
  );
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const currentTarget = await (
    await page.request.get(`/api/documents/${target.id}`)
  ).json();
  await page.request.put(`/api/documents/${target.id}/content`, {
    headers: { "If-Match": String(currentTarget.revision) },
    data: {
      title: "Renamed mention target",
      icon: "⭐",
      blocks: currentTarget.blocks,
      mutationId: randomUUID(),
    },
  });
  await page.reload();
  await expect(editor.locator(`a[href="#/page/${target.id}"]`)).toHaveCount(1);
  await expect(
    editor.locator(`a[href="#/page/${bracketTarget.id}"]`),
  ).toHaveCount(1);
  await expect(
    editor.locator(`a[href="#/page/${target.id}"]`).first(),
  ).toHaveText("⭐ Renamed mention target");
  await expect(editor.locator(`a[href="${external}"]`)).toHaveText(
    `🌐 ${previewTitle}`,
  );
  await expect(editor).toContainText("Keep this text");
  await editor.locator(`a[href="${external}"]`).hover();
  await expect(page.getByRole("img", { name: "Page preview" })).toBeVisible();
  await editor.locator(`a[href="#/page/${target.id}"]`).first().click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Renamed mention target",
  );
  expect(context.pages()).toHaveLength(1);
});

test("paste chooser follows the cursor block and supports cancellation and URL insertion", async ({
  page,
}) => {
  await seed(
    page,
    "Paste placement",
    Array.from({ length: 25 }, (_, index) => ({
      id: `paste-line-${index}`,
      type: "paragraph",
      content: [{ type: "text", text: `Line ${index} keep this`, styles: {} }],
    })),
  );
  const line = page.locator('[data-id="paste-line-18"] .bn-inline-content');
  await page.evaluate(() => document.fonts.ready);
  await line.click();
  await page.keyboard.press("End");
  async function paste() {
    await line.evaluate((element) => {
      const transfer = new DataTransfer();
      transfer.setData("text/plain", "https://example.com/article#section");
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "clipboardData", { value: transfer });
      element.dispatchEvent(event);
    });
  }
  await paste();
  const chooser = page.getByRole("dialog", { name: "Paste link" });
  await expect(chooser).toBeVisible();
  const scroller = page.locator(".main-scroll");
  // Caret scrolling and floating UI can keep adjusting layout after a paste.
  // Require stable geometry across frames before measuring the scroll delta.
  let previousGeometry = "";
  let stableSamples = 0;
  await expect
    .poll(
      async () => {
        const geometry = JSON.stringify([
          await scroller.evaluate((element) => element.scrollTop),
          await line.boundingBox(),
          await chooser.boundingBox(),
        ]);
        stableSamples = geometry === previousGeometry ? stableSamples + 1 : 0;
        previousGeometry = geometry;
        return stableSamples;
      },
      { intervals: [100] },
    )
    .toBeGreaterThanOrEqual(3);
  const lineBox = await line.boundingBox(),
    menuBox = await chooser.boundingBox();
  expect(Math.abs(menuBox!.y - lineBox!.y)).toBeLessThan(100);
  const scrollBefore = await scroller.evaluate((element) => element.scrollTop);
  expect(scrollBefore).toBeGreaterThanOrEqual(35);
  await scroller.evaluate((element, before) => {
    element.scrollTop = before - 35;
  }, scrollBefore);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeCloseTo(scrollBefore - 35, 0);
  await expect
    .poll(async () => (await line.boundingBox())!.y)
    .toBeCloseTo(lineBox!.y + 35, 0);
  await expect
    .poll(async () => (await chooser.boundingBox())!.y)
    .toBeCloseTo(menuBox!.y + 35, 0);
  await chooser.getByRole("button", { name: "Cancel paste" }).click();
  await expect(chooser).toHaveCount(0);
  await expect(line).toHaveText("Line 18 keep this");
  await line.click();
  await page.keyboard.press("End");
  await paste();
  await chooser.getByRole("button", { name: "Paste as URL" }).click();
  await expect(line.locator("a")).toHaveAttribute(
    "href",
    "https://example.com/article#section",
  );
  await expect(line.locator("a")).not.toHaveClass(/lotion-mention/);
  await expect(line.locator("a")).toHaveCSS(
    "text-decoration-line",
    "underline",
  );
  await expect(chooser).toHaveCount(0);
});

test("at-sign file references upload, download, save and reload", async ({
  page,
}) => {
  await seed(page, "File references");
  const editor = page.locator(".tiptap");
  await editor.click();
  await page.keyboard.type("@file");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Insert file reference" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("File", { exact: true }).setInputFiles({
    name: "keyboard-reference.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("downloadable reference"),
  });
  await dialog.getByRole("button", { name: "Insert file" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  const mention = editor.locator(
    'a.lotion-mention[data-lotion-mention="file"]',
  );
  await expect(mention).toHaveText("📎 keyboard-reference.txt");
  await expect(mention).toHaveAttribute(
    "href",
    /\/api\/assets\/[a-f0-9]{64}\.bin/,
  );
  const download = page.waitForEvent("download");
  await mention.click();
  expect((await download).suggestedFilename()).toBe("keyboard-reference.txt");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    editor.locator('a.lotion-mention[data-lotion-mention="file"]'),
  ).toHaveText("📎 keyboard-reference.txt");
});

test("stale external mentions refresh metadata once and persist the new title", async ({
  page,
}) => {
  const href = "https://example.com/stale-preview";
  const created = await page.request.post("/api/documents", {
    data: { title: "Refresh preview", mutationId: randomUUID() },
  });
  const document = await created.json();
  await page.request.put(`/api/documents/${document.id}/content`, {
    headers: { "If-Match": "1" },
    data: {
      title: "Refresh preview",
      blocks: [
        {
          id: "stale-mention",
          type: "paragraph",
          content: [
            {
              type: "mention",
              props: {
                kind: "external",
                href,
                label: "Old preview title",
                icon: "🌐",
              },
            },
          ],
        },
      ],
      linkPreviews: {
        [href]: {
          title: "Old preview title",
          description: "Old summary",
          fetchedAt: "2020-01-01T00:00:00.000Z",
        },
      },
      mutationId: randomUUID(),
    },
  });
  let requests = 0;
  await page.route("**/api/link-preview", (route) => {
    requests++;
    return route.fulfill({
      json: {
        title: "Fresh preview title",
        description: "Fresh summary",
        fetchedAt: new Date().toISOString(),
      },
    });
  });
  await page.goto(`/#/page/${document.id}`);
  const mention = page.locator(`a.lotion-mention[href="${href}"]`);
  await mention.hover();
  await expect(mention).toHaveText("🌐 Fresh preview title");
  await expect(page.getByText("Fresh summary")).toBeVisible();
  expect(requests).toBe(1);
  await mention.hover();
  await page.waitForTimeout(100);
  expect(requests).toBe(1);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator(`a.lotion-mention[href="${href}"]`)).toHaveText(
    "🌐 Fresh preview title",
  );
});
