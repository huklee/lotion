import { test, expect } from "./fixtures";
import { seed } from "./helpers";

test("typed ASCII arrows become symbols without rewriting paste or code", async ({
  page,
}) => {
  await seed(page, "Arrow substitution", [
    { id: "arrow-typed", type: "paragraph", content: [] },
    { id: "arrow-pasted", type: "paragraph", content: [] },
    {
      id: "arrow-code",
      type: "codeBlock",
      props: { language: "json" },
      content: [{ type: "text", text: "code ", styles: {} }],
    },
  ]);

  const typed = page.locator('[data-id="arrow-typed"] .bn-inline-content');
  await typed.click();
  await page.keyboard.type("left <- and right ->");
  await expect(typed).toHaveText("left ← and right →");

  const pasted = page.locator('[data-id="arrow-pasted"] .bn-inline-content');
  await pasted.click();
  await pasted.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "pasted <- and ->");
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  });
  await expect(pasted).toHaveText("pasted <- and ->");

  const code = page.locator('[data-id="arrow-code"] .bn-inline-content');
  await code.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (element as HTMLElement).focus();
    document.dispatchEvent(new Event("selectionchange"));
  });
  await page.keyboard.type("<- and ->");
  await expect(code).toContainText("code <- and ->");

  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(typed).toHaveText("left ← and right →");
  await expect(pasted).toHaveText("pasted <- and ->");
  await expect(code).toContainText("code <- and ->");
});

test("table of contents labels align left while preserving heading indentation", async ({
  page,
}) => {
  await seed(page, "TOC alignment", [
    { id: "toc-block", type: "tableOfContents" },
    {
      id: "left-heading",
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "Heading", styles: {} }],
    },
    {
      id: "left-subheading",
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: "Subheading", styles: {} }],
    },
  ]);
  const toc = page.getByRole("navigation", { name: "Table of contents" });
  for (const label of ["Heading", "Subheading"]) {
    const button = toc.getByRole("button", { name: label, exact: true });
    await expect(button).toHaveCSS("justify-content", "flex-start");
    await expect(button).toHaveCSS("text-align", "left");
    const gap = await button.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return (
        range.getBoundingClientRect().left -
        el.getBoundingClientRect().left -
        parseFloat(getComputedStyle(el).paddingLeft)
      );
    });
    expect(Math.abs(gap)).toBeLessThan(2);
  }
  await expect(
    toc.getByRole("button", { name: "Subheading", exact: true }),
  ).toHaveCSS("padding-left", "26px");
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
    page.getByRole("textbox", { name: "Search workspace" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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
    page.locator('.bn-inline-content a[href^="#/page/"]'),
  ).toContainText("Untitled");
  await expect(
    page.locator('.bn-inline-content a[href^="#/page/"]'),
  ).toHaveCount(1);
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

test("browser favicon follows the current page icon and resets outside a page", async ({
  page,
}) => {
  await seed(page, "Favicon page");
  const favicon = page.locator('link[rel="icon"][data-lotion-favicon]');
  const decodedFavicon = async () =>
    decodeURIComponent((await favicon.getAttribute("href")) ?? "");

  await expect(favicon).toHaveAttribute("type", "image/svg+xml");
  await expect.poll(decodedFavicon).toContain("📄");

  await page.getByRole("button", { name: "Change page icon" }).click();
  await page.getByRole("textbox", { name: "Search emojis" }).fill("compass");
  await page.getByRole("button", { name: "Use 🧭 compass icon" }).click();
  await expect.poll(decodedFavicon).toContain("🧭");

  const second = await page.request.post("/api/documents", {
    data: { title: "No icon page", mutationId: crypto.randomUUID() },
  });
  const secondDocument = await second.json();
  await page.goto(`/#/page/${secondDocument.id}`);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "No icon page",
  );
  await expect.poll(decodedFavicon).toContain("📄");

  await page.goto("/#/home");
  await expect(
    page.getByRole("heading", {
      name: "Make room for what’s on your mind.",
    }),
  ).toBeVisible();
  await expect.poll(decodedFavicon).toContain("#37352f");
  await expect.poll(decodedFavicon).not.toContain("📄");
});

test("typed database rows are child pages and other custom blocks persist", async ({
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
    .filter({ hasText: "Typed properties with child-page rows" })
    .click();
  const database = page.locator(".lotion-database");
  await expect(database.getByLabel("Status property name")).toHaveValue(
    "Status",
  );
  await database.getByRole("button", { name: "New row page" }).click();
  const rowLink = database.getByRole("button", { name: /Untitled row/ });
  await expect(rowLink).toBeVisible();
  await database
    .getByLabel("Status for Untitled row")
    .selectOption("In progress");
  await database.getByLabel("Done for Untitled row").check();
  await database.getByLabel("Due for Untitled row").fill("2026-09-30");
  await database.getByLabel("Estimate for Untitled row").fill("8");
  await database.getByLabel("Notes for Untitled row").fill("Typed row value");
  await database.getByLabel("Notes property name").fill("Context");
  await database.getByLabel("Property type").selectOption("select");
  await database.getByRole("button", { name: "Add property" }).click();
  await expect(database.getByLabel("Select 2 property name")).toBeVisible();
  await page.locator(".tiptap .bn-inline-content").last().click();
  await page.keyboard.type("/callout");
  await page.getByRole("option").filter({ hasText: "important note" }).click();
  await page.keyboard.insertText("Remember this");
  await expect(page.locator(".lotion-callout")).toContainText("Remember this");
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
  await expect(page.locator(".lotion-callout")).toContainText("Remember this");
  await expect(database.getByLabel("Status for Untitled row")).toHaveValue(
    "In progress",
  );
  await expect(database.getByLabel("Done for Untitled row")).toBeChecked();
  await expect(database.getByLabel("Due for Untitled row")).toHaveValue(
    "2026-09-30",
  );
  await expect(database.getByLabel("Estimate for Untitled row")).toHaveValue(
    "8",
  );
  await expect(database.getByLabel("Context for Untitled row")).toHaveValue(
    "Typed row value",
  );
  await rowLink.click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Untitled row",
  );
  await page.getByRole("textbox", { name: "Page title" }).fill("Roadmap row");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.goBack();
  await expect(
    database.getByRole("button", { name: /Roadmap row/ }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    database.getByRole("button", { name: /Roadmap row/ }),
  ).toBeVisible();
});
