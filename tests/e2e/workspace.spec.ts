import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

test("Mermaid slash block renders, handles invalid source and persists edits", async ({
  page,
}) => {
  await seed(page, "Diagrams");
  await page.locator(".tiptap").click();
  await page.keyboard.type("/mermaid");
  await page
    .getByRole("option")
    .filter({ hasText: "Diagram with editable Mermaid source" })
    .click();
  const source = page.getByRole("textbox", { name: "Mermaid source" });
  const preview = page.getByRole("img", { name: "Mermaid diagram preview" });
  await expect(preview).toBeVisible({ timeout: 15000 });
  await expect
    .poll(() =>
      preview.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await source.fill("this is not a diagram");
  await expect(page.locator(".yestion-mermaid [role=status]")).not.toHaveText(
    "Rendering diagram…",
  );
  await expect(preview).toHaveCount(0);
  await source.fill("sequenceDiagram\n Alice->>Bob: Hello");
  await expect(preview).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Saved", {
    timeout: 15000,
  });
  await page.reload();
  await expect(source).toHaveValue("sequenceDiagram\n Alice->>Bob: Hello");
  await expect(preview).toBeVisible({ timeout: 15000 });
});

test("code tokens remain readable on beige in light and dark themes", async ({
  page,
}) => {
  const samples = {
    json: '{"color": "red", "count": 42, "enabled": true}',
    html: '<!-- comment -->\n<div class="hello">Hello</div>',
    python: '# comment\ndef greet(name):\n    return "Hello " + name',
    go: '// comment\npackage main\nfunc main() { println("Hello") }',
    cpp: "// comment\n#include <iostream>\nint main() { return 0; }",
  };
  await seed(
    page,
    "Code contrast",
    Object.entries(samples).map(([language, text]) => ({
      id: `contrast-${language}`,
      type: "codeBlock",
      props: { language },
      content: [{ type: "text", text, styles: {} }],
    })),
  );
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => localStorage.setItem("yestion-theme", value),
      theme,
    );
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const language of Object.keys(samples)) {
      const code = page.locator(
        `[data-id="contrast-${language}"] [data-content-type="codeBlock"]`,
      );
      await expect(code.locator(".shiki").first()).toBeVisible({
        timeout: 15000,
      });
      const ratios = await code.evaluate((element) => {
        const luminance = (color: string) => {
          const channels = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              const s = v / 255;
              return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        const background = luminance(getComputedStyle(element).backgroundColor);
        return Array.from(element.querySelectorAll(".shiki"))
          .filter((el) => el.textContent?.trim())
          .map((el) => {
            const foreground = luminance(getComputedStyle(el).color);
            return (
              (Math.max(background, foreground) + 0.05) /
              (Math.min(background, foreground) + 0.05)
            );
          });
      });
      expect(ratios.length).toBeGreaterThan(0);
      expect(
        Math.min(...ratios),
        `${theme} ${language} token contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});
async function seed(page: Page, title = "Test page", blocks?: any[]) {
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
test("create, edit, immediate sidebar title, auto-save and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New page", exact: true }).click();
  const title = `Browser ${randomUUID().slice(0, 6)}`;
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Untitled",
  );
  await page.getByRole("textbox", { name: "Page title" }).fill(title);
  await expect(
    page
      .getByRole("navigation", { name: "Pages" })
      .getByText(title, { exact: true }),
  ).toBeVisible();
  const editor = page.locator(".tiptap");
  await editor.click();
  await page.keyboard.insertText("A thought worth keeping. 한글 🙂");
  await expect(page.locator(".save-status")).toHaveText("Saved", {
    timeout: 15000,
  });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    title,
  );
  await expect(page.locator(".tiptap")).toContainText(
    "A thought worth keeping. 한글 🙂",
  );
  expect(errors).toEqual([]);
});
test("slash command inserts a heading, theme persists, keyboard search works", async ({
  page,
}) => {
  await seed(page, "Slash page");
  await page.locator(".tiptap").click();
  await page.keyboard.type("/heading");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("A new heading");
  await expect(page.locator(".tiptap")).toContainText("A new heading");
  await page.getByRole("button", { name: /Appearance/ }).click();
  await page.getByRole("button", { name: /Appearance/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(
    page.getByRole("textbox", { name: "Search pages" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("trash and restore retain content", async ({ page }) => {
  await seed(page, "Restore me");
  await page
    .getByRole("button", { name: "Move page to trash", exact: true })
    .click();
  await page.getByRole("button", { name: /^Trash/ }).click();
  const row = page.locator(".trash-row").filter({ hasText: "Restore me" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Restore me",
  );
});
test("two tabs preserve conflicting drafts", async ({ page, context }) => {
  const doc = await seed(page, "Conflict source");
  const second = await context.newPage();
  await second.goto(`/#/page/${doc.id}`);
  await expect(second.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Conflict source",
  );
  await page.getByRole("textbox", { name: "Page title" }).fill("First writer");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await second
    .getByRole("textbox", { name: "Page title" })
    .fill("Second writer draft");
  await second.keyboard.press("ControlOrMeta+s");
  await expect(second.locator(".save-status")).toHaveText("Conflict");
  await expect(second.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Second writer draft",
  );
  await expect(
    second.getByRole("button", { name: "Save draft as a copy" }),
  ).toBeVisible();
  await second.close();
});
test("whole folder import, nested assets, ZIP download", async ({ page }) => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "yestion-browser-folder-"),
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
    await expect(page.locator(".tiptap")).toContainText("Imported folder");
    await expect(page.locator(".tiptap img")).toBeVisible();
    await expect(
      page.getByRole("navigation").getByText(topic, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Entire workspace/ }).click();
    expect((await download).suggestedFilename()).toBe("yestion-workspace.zip");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("section selection moves a complete section and undo restores it", async ({
  page,
}) => {
  await seed(page, "Sections", [
    {
      id: "heading-a",
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "First section", styles: {} }],
    },
    {
      id: "body-a",
      type: "paragraph",
      content: [{ type: "text", text: "First body", styles: {} }],
    },
    {
      id: "heading-b",
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "Second section", styles: {} }],
    },
  ]);
  await page.locator('[data-id="heading-a"] .bn-inline-content').click();
  await page
    .getByRole("button", { name: "Select section", exact: true })
    .click();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("2 selected");
  await page.getByRole("button", { name: "Move selection down" }).click();
  const text = await page.locator(".tiptap").innerText();
  expect(text.indexOf("Second section")).toBeLessThan(
    text.indexOf("First section"),
  );
  await page.locator(".tiptap").click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(() => page.locator(".tiptap").innerText())
    .toMatch(/^First section/);
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

test("rectangle-selects blocks without changing ordinary text content", async ({
  page,
}) => {
  await seed(page, "Box selection", [
    {
      id: "box-a",
      type: "paragraph",
      content: [{ type: "text", text: "Alpha block", styles: {} }],
    },
    {
      id: "box-b",
      type: "paragraph",
      content: [{ type: "text", text: "Beta block", styles: {} }],
    },
    {
      id: "box-c",
      type: "paragraph",
      content: [{ type: "text", text: "Gamma block", styles: {} }],
    },
  ]);
  const gutter = await page.locator(".selection-gutter").boundingBox();
  const first = await page.locator('[data-id="box-a"]').first().boundingBox();
  const second = await page.locator('[data-id="box-b"]').first().boundingBox();
  await page.mouse.move(gutter!.x + 5, Math.max(gutter!.y + 1, first!.y + 2));
  await page.mouse.down();
  await page.mouse.move(
    second!.x + second!.width - 10,
    second!.y + second!.height - 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("2 selected");
  await page.getByRole("button", { name: "Move selection down" }).click();
  expect(
    (await page.locator(".tiptap").innerText()).indexOf("Gamma block"),
  ).toBe(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  expect(
    (await page.locator(".tiptap").innerText()).indexOf("Gamma block"),
  ).toBe(0);
});

test("drags a rectangle-selected block group to a new insertion point", async ({
  page,
}) => {
  await seed(page, "Drag selected blocks", [
    {
      id: "drag-a",
      type: "paragraph",
      content: [{ type: "text", text: "Move alpha", styles: {} }],
    },
    {
      id: "drag-b",
      type: "paragraph",
      content: [{ type: "text", text: "Move beta", styles: {} }],
    },
    {
      id: "drag-c",
      type: "paragraph",
      content: [{ type: "text", text: "Keep gamma", styles: {} }],
    },
  ]);
  const first = await page.locator('[data-id="drag-a"]').first().boundingBox(),
    second = await page.locator('[data-id="drag-b"]').first().boundingBox();
  await page.mouse.move(first!.x + first!.width / 2, first!.y + 2);
  await page.mouse.down();
  await page.mouse.move(
    second!.x + second!.width - 8,
    second!.y + second!.height - 2,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("2 selected");
  const handle = page
      .getByRole("toolbar", { name: "Selected blocks" })
      .getByTitle("Drag selected blocks"),
    target = page.locator('[data-id="drag-c"]').first(),
    box = await target.boundingBox();
  await handle.dragTo(target, {
    targetPosition: { x: box!.width / 2, y: box!.height - 2 },
  });
  await expect
    .poll(() => page.locator(".tiptap").innerText())
    .toMatch(/^Keep gamma\s+Move alpha\s+Move beta/);
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(() => page.locator(".tiptap").innerText())
    .toMatch(/^Move alpha\s+Move beta\s+Keep gamma/);
});

test("pending page A save cannot overwrite page B while navigating", async ({
  page,
}) => {
  const a = await seed(page, "Navigation A");
  const b = (
    await page.request.post("/api/documents", {
      data: { title: "Navigation B", mutationId: randomUUID() },
    })
  ).json();
  const next = await b;
  await page.route(`**/api/documents/${a.id}/content`, async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("A saved in background");
  await page.keyboard.press("ControlOrMeta+s");
  await page.evaluate((id) => {
    location.hash = `#/page/${id}`;
  }, next.id);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Navigation B",
  );
  await expect
    .poll(async () =>
      (await page.request.get(`/api/documents/${a.id}`))
        .json()
        .then((d) => d.title),
    )
    .toBe("A saved in background");
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Navigation B",
  );
});

test("reload restores an offline browser draft and reconnect saves it", async ({
  page,
}) => {
  await seed(page, "Offline original");
  await page.route("**/api/documents/*/content", (route) => route.abort());
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("Offline draft retained");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Offline draft");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Offline draft retained",
  );
  await page.unroute("**/api/documents/*/content");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Offline draft retained",
  );
});

test("sidebar drop nests a page", async ({ page }) => {
  const parent = await seed(page, `Parent ${randomUUID().slice(0, 5)}`);
  const child = (
    await page.request.post("/api/documents", {
      data: {
        title: `Child ${randomUUID().slice(0, 5)}`,
        mutationId: randomUUID(),
      },
    })
  ).json();
  const d = await child;
  await page.reload();
  const childRow = page
    .locator(".page-row")
    .filter({ has: page.getByRole("button", { name: d.title, exact: true }) });
  const parentRow = page.locator(".page-row").filter({
    has: page.getByRole("button", { name: parent.title, exact: true }),
  });
  await childRow.dragTo(parentRow);
  await expect
    .poll(async () =>
      (await page.request.get(`/api/documents/${d.id}`))
        .json()
        .then((x) => x.parentId),
    )
    .toBe(parent.id);
});

test("sidebar drop reorders siblings at the indicated edge", async ({
  page,
}) => {
  const first = await seed(page, `First ${randomUUID().slice(0, 5)}`);
  const second = await (
    await page.request.post("/api/documents", {
      data: {
        title: `Second ${randomUUID().slice(0, 5)}`,
        mutationId: randomUUID(),
      },
    })
  ).json();
  await page.reload();
  const firstRow = page.locator(".page-row").filter({
    has: page.getByRole("button", { name: first.title, exact: true }),
  });
  const secondRow = page.locator(".page-row").filter({
    has: page.getByRole("button", { name: second.title, exact: true }),
  });
  const box = await firstRow.boundingBox();
  await secondRow.dragTo(firstRow, {
    targetPosition: { x: box!.width / 2, y: 2 },
  });
  await expect
    .poll(async () => {
      const tree = await (await page.request.get("/api/tree")).json();
      return (
        tree.nodes
          .filter((n: any) => !n.parentId && !n.hidden)
          .map((n: any) => n.id)
          .indexOf(second.id) <
        tree.nodes
          .filter((n: any) => !n.parentId && !n.hidden)
          .map((n: any) => n.id)
          .indexOf(first.id)
      );
    })
    .toBe(true);
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
      "# Rich content\n\n> A quotation\n>\n> - Nested item\n\n```js\nconst saved = true;\n```\n\n| A | B |\n| - | - |\n| 한글 | 🙂 |\n",
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

test("slash page creates a child and table of contents follows headings", async ({
  page,
}) => {
  const parent = await seed(page, "Parent page", [
    {
      id: "toc-heading-one",
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "First heading", styles: {} }],
    },
    {
      id: "toc-heading-two",
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: "Second heading", styles: {} }],
    },
    { id: "toc-insert", type: "paragraph", content: [] },
  ]);
  await page.locator('[data-id="toc-insert"] .bn-inline-content').click();
  await page.keyboard.type("/page");
  await page
    .getByRole("option")
    .filter({ hasText: "Create a subpage" })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Pages" }).getByText("Untitled"),
  ).toBeVisible();
  await expect(
    page.locator('.bn-inline-content a[href^="#/page/"]'),
  ).toContainText("Untitled");
  const tree = await (await page.request.get("/api/tree")).json();
  const child = tree.nodes.find(
    (node: any) => node.parentId === parent.id && node.title === "Untitled",
  );
  expect(child).toBeTruthy();

  await page.locator(".tiptap .bn-inline-content").last().click();
  await page.keyboard.type("/toc");
  await page
    .getByRole("option")
    .filter({ hasText: "Table of contents" })
    .click();
  const toc = page.getByRole("navigation", { name: "Table of contents" });
  await expect(toc).toContainText("First heading");
  await expect(toc).toContainText("Second heading");
  await page
    .locator('[data-id="toc-heading-two"] .bn-inline-content')
    .fill("Renamed heading");
  await expect(toc).toContainText("Renamed heading");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Table of contents" }),
  ).toContainText("Renamed heading");
  await page.getByRole("button", { name: "Change page icon" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Page icon picker" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Change page icon" }).click();
  await page.getByRole("textbox", { name: "Page title" }).click();
  await expect(
    page.getByRole("dialog", { name: "Page icon picker" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Change page icon" }).click();
  await page.getByRole("textbox", { name: "Search emojis" }).fill("compass");
  await page.getByRole("button", { name: "Use 🧭 compass icon" }).click();
  await expect(
    page.getByRole("dialog", { name: "Page icon picker" }),
  ).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Change page icon" }),
  ).toHaveText("🧭");
  await page.locator('.bn-inline-content a[href^="#/page/"]').click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Untitled",
  );
  await page
    .locator(".breadcrumb-page")
    .getByRole("button", {
      name: "Parent page",
    })
    .click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Parent page",
  );
});

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
  await seed(page, "Mention source");
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

  const external =
    "https://techblog-history-younghunjo1.tistory.com/207#google_vignette";
  const previewTitle = "[추천시스템] 딥러닝과 추천시스템, Wide & Deep Learning";
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
      },
    }),
  );
  await editor.evaluate((element, url) => {
    const data = new DataTransfer();
    data.setData("text/plain", url);
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    // Firefox discards clipboardData passed to synthetic ClipboardEvent constructors.
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  }, external);
  const chooser = page.getByRole("dialog", { name: "Paste link" });
  await expect(chooser).toBeVisible();
  await chooser.getByRole("button", { name: "Paste as mention" }).click();
  await expect(editor.locator(`a[href="${external}"]`)).toHaveText(
    `📄 ${previewTitle}`,
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
  ).toHaveText("📄 Renamed mention target");
  await expect(editor.locator(`a[href="${external}"]`)).toHaveText(
    `📄 ${previewTitle}`,
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

test("toggle, callout and database blocks work and code uses beige and red", async ({
  page,
}) => {
  await seed(page, "Block menu", [
    {
      id: "toggle-existing",
      type: "toggleListItem",
      content: [{ type: "text", text: "Expandable", styles: {} }],
      children: [
        {
          id: "toggle-child",
          type: "paragraph",
          content: [{ type: "text", text: "Hidden detail", styles: {} }],
        },
      ],
    },
    {
      id: "styled-code",
      type: "codeBlock",
      props: { language: "json" },
      content: [{ type: "text", text: '{"color": "red"}', styles: {} }],
    },
    { id: "block-insert", type: "paragraph", content: [] },
  ]);
  const toggle = page.locator('.bn-block-outer[data-id="toggle-existing"]'),
    toggleChild = page.locator('.bn-block-outer[data-id="toggle-child"]');
  await expect(toggleChild).toBeHidden();
  await toggle.locator(".bn-toggle-button").click();
  await expect(toggleChild).toBeVisible();

  const code = page.locator(
    '[data-id="styled-code"] [data-content-type="codeBlock"]',
  );
  await expect(code).toHaveCSS("background-color", "rgb(239, 231, 213)");
  await expect(code).toHaveCSS("color", "rgb(180, 35, 45)");
  await expect(code.locator("select option")).toHaveCount(5);
  await expect(code.locator(".shiki").first()).toBeVisible({
    timeout: 15000,
  });

  await page.locator('[data-id="block-insert"] .bn-inline-content').click();
  await page.keyboard.type("/database");
  await page
    .getByRole("option")
    .filter({ hasText: "editable table database" })
    .click();
  await expect(page.locator(".tiptap table")).toContainText("Name");
  await expect(page.locator(".tiptap table")).toContainText("Status");
  await page.locator(".tiptap .bn-inline-content").last().click();
  await page.keyboard.type("/callout");
  await page.getByRole("option").filter({ hasText: "important note" }).click();
  await page.keyboard.insertText("Remember this");
  await expect(page.locator(".yestion-callout")).toContainText("Remember this");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/toggle");
  await page
    .getByRole("option")
    .filter({ hasText: /^Toggle/ })
    .first()
    .click();
  await page.keyboard.insertText("Created by slash");
  await expect(
    page.locator('[data-content-type="toggleListItem"]'),
  ).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator(".yestion-callout")).toContainText("Remember this");
  await expect(page.locator(".tiptap table")).toContainText("Status");
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
  await line.click();
  await page.keyboard.press("End");
  async function paste() {
    await line.evaluate((element) => {
      const transfer = new DataTransfer();
      transfer.setData("text/plain", "https://example.com/article#section");
      const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: transfer });
      element.dispatchEvent(event);
    });
  }
  await paste();
  const chooser = page.getByRole("dialog", { name: "Paste link" });
  await expect(chooser).toBeVisible();
  const lineBox = await line.boundingBox(),
    menuBox = await chooser.boundingBox();
  expect(Math.abs(menuBox!.y - lineBox!.y)).toBeLessThan(100);
  await page.locator(".main-scroll").evaluate((element) => {
    element.scrollTop += 35;
  });
  await expect
    .poll(async () => (await chooser.boundingBox())!.y)
    .not.toBe(menuBox!.y);
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
  await expect(chooser).toHaveCount(0);
});

test("legacy code pages render and a failed subpage request leaves the editor usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page, "Legacy code", [
    {
      id: "old-code",
      type: "codeBlock",
      props: { language: "text" },
      content: [{ type: "text", text: "#include <iostream>", styles: {} }],
    },
    { id: "new-child", type: "paragraph", content: [] },
  ]);
  await expect(
    page.locator('[data-content-type="codeBlock"] select'),
  ).toHaveValue("cpp");
  await page.route("**/api/documents", (route) =>
    route.fulfill({ status: 503, json: { error: "Temporary outage" } }),
  );
  await page.locator('[data-id="new-child"] .bn-inline-content').click();
  await page.keyboard.type("/page");
  await page
    .getByRole("option")
    .filter({ hasText: "Create a subpage" })
    .click();
  await expect(
    page.getByText("Could not create subpage: Temporary outage"),
  ).toBeVisible();
  await page.keyboard.insertText("Still editable");
  await expect(page.locator(".tiptap")).toContainText("Still editable");
  expect(errors).toEqual([]);
});
