import { test, expect } from "./fixtures";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { seed } from "./helpers";

test("whole folder import, nested assets, ZIP download", async ({ page }) => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "lotion-browser-folder-"),
  );
  const topic = `topic-${path.basename(dir)}`;
  await fs.mkdir(path.join(dir, "Research"));
  await fs.mkdir(path.join(dir, "assets"));
  await fs.writeFile(
    path.join(dir, "index.md"),
    `# Imported folder\n\n![diagram](assets/pixel.png)\n\n[Topic](Research/${topic}.md)`,
  );
  await fs.writeFile(
    path.join(dir, "Research", `${topic}.md`),
    "Nested topic content",
  );
  await fs.writeFile(
    path.join(dir, "assets", "pixel.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVQ0AAAAASUVORK5CYII=",
      "base64",
    ),
  );
  try {
    await page.goto("/");
    await page
      .getByRole("complementary")
      .getByRole("button", { name: "Import", exact: true })
      .click();
    await page.locator("input[webkitdirectory]").setInputFiles(dir);
    await expect(
      page.getByRole("heading", { name: "Imported folder", level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".tiptap img")).toBeVisible();
    await expect(
      page.getByRole("navigation").getByText(topic, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Entire workspace/ }).click();
    expect((await download).suggestedFilename()).toBe("lotion-workspace.zip");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("image file drop inserts a durable image", async ({ page }) => {
  await seed(page, "Dropped image");
  const data = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVQ0AAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    transfer.items.add(new File([bytes], "pixel.png", { type: "image/png" }));
    return transfer;
  });
  await page.locator(".tiptap").dispatchEvent("drop", { dataTransfer: data });
  await expect(page.locator(".tiptap img")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator(".tiptap img")).toBeVisible();
});

test("cancelling an image during upload does not resurrect it", async ({
  page,
}) => {
  await seed(page, "Cancel upload");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/assets", async (route) => {
    await gate;
    await route.continue();
  });
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
        "pending.png",
        { type: "image/png" },
      ),
    );
    return data;
  });
  const request = page.waitForRequest("**/api/assets");
  await page
    .locator(".tiptap")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await request;
  await page
    .locator(".upload-status")
    .getByRole("button", { name: "Cancel upload" })
    .click();
  release();
  await expect(page.getByText("Uploading pending.png…")).not.toBeVisible();
  await expect(page.locator(".tiptap img")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
});

test("nested quotes, code and tables render after Markdown import", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Import", exact: true })
    .click();
  await page.locator("input[type=file]:not([webkitdirectory])").setInputFiles({
    name: "Rich Markdown.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Rich content\n\n> A quotation\n>\n> - Nested item\n\n```js\nconst saved = true;\n```\n\n| A | B |\n| - | - |\n| English | 🙂 |\n",
    ),
  });
  await expect(page.locator(".tiptap")).toContainText("Nested item");
  await expect(page.locator(".tiptap table")).toBeVisible();
  await page.locator(".tiptap").click();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator(".tiptap table")).toBeVisible();
  expect(errors).toEqual([]);
});
