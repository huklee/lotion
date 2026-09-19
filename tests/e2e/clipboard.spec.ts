import { test, expect } from "./fixtures";
import { seed } from "./helpers";

test("clipboard lines are saved as plain text without HTML or Markdown formatting", async ({
  page,
}) => {
  await seed(page, "Plain clipboard");
  await page.locator(".tiptap").click();
  const text =
    "# Literal heading\n**literal bold**\n<script>alert(1)</script>\n[link](javascript:alert(1))\nLast line";
  await page.locator(".tiptap").evaluate((element, text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    data.setData("text/html", "<h1>Unwanted HTML</h1>");
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  }, text);
  for (const line of text.split("\n"))
    await expect(page.locator(".tiptap")).toContainText(line);
  await expect(
    page.locator(".tiptap h1, .tiptap strong, .tiptap a, .tiptap script"),
  ).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  for (const line of text.split("\n"))
    await expect(page.locator(".tiptap")).toContainText(line);
});

test("structured raw text reconstructs heading, bullet, and checklist blocks", async ({
  page,
}) => {
  await seed(page, "Structured clipboard", [
    { id: "structured-paste", type: "paragraph", content: [] },
  ]);
  const editor = page.locator(
    '[data-id="structured-paste"] .bn-inline-content',
  );
  await editor.click();
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.setData(
      "text/plain",
      "## Restored heading\n\n- Restored bullet\n- [x] Completed task\n- [ ] Pending task\n",
    );
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  });
  await expect(page.locator(".tiptap h2")).toContainText("Restored heading");
  await expect(
    page.locator('[data-content-type="bulletListItem"]'),
  ).toContainText("Restored bullet");
  const tasks = page.locator('[data-content-type="checkListItem"]');
  await expect(tasks).toHaveCount(2);
  await expect(tasks.nth(0).locator('input[type="checkbox"]')).toBeChecked();
  await expect(
    tasks.nth(1).locator('input[type="checkbox"]'),
  ).not.toBeChecked();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator(".tiptap h2")).toContainText("Restored heading");
  await expect(
    page.locator('[data-content-type="bulletListItem"]'),
  ).toContainText("Restored bullet");
  await expect(tasks).toHaveCount(2);
  await expect(tasks.nth(0).locator('input[type="checkbox"]')).toBeChecked();
  await expect(
    tasks.nth(1).locator('input[type="checkbox"]'),
  ).not.toBeChecked();
});

test("checklists toggle by click and shortcut, retain their type on paste, and disable spellcheck", async ({
  page,
}) => {
  await seed(page, "Checklist editing", [
    {
      id: "check-paste",
      type: "checkListItem",
      props: { checked: false },
      content: [{ type: "text", text: "Task tail", styles: {} }],
    },
  ]);
  const item = page.locator('[data-id="check-paste"]');
  const checkbox = item.locator('input[type="checkbox"]');
  await expect(page.locator(".editor-shell")).toHaveAttribute(
    "spellcheck",
    "false",
  );
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await item.locator(".bn-inline-content").click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(checkbox).not.toBeChecked();
  const inline = item.locator(".bn-inline-content");
  await inline.evaluate((element) => {
    const text = document
      .createTreeWalker(element, NodeFilter.SHOW_TEXT)
      .nextNode();
    if (!text) throw new Error("Checklist text node is missing");
    const range = document.createRange();
    range.setStart(text, 5);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await inline.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "first pasted line\nsecond pasted line\n");
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  });
  const checklistItems = page.locator('[data-content-type="checkListItem"]');
  await expect(checklistItems).toHaveCount(2);
  await expect(checklistItems.nth(0)).toContainText("Task first pasted line");
  await expect(checklistItems.nth(1)).toContainText("second pasted linetail");
  await expect(page.locator('[data-content-type="paragraph"]')).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(checklistItems).toHaveCount(2);
  await expect(checklistItems.nth(0)).toContainText("Task first pasted line");
  await expect(checklistItems.nth(1)).toContainText("second pasted linetail");
});

test("single-line checklist paste stays inline and checkbox clicks preserve scroll", async ({
  page,
}) => {
  const filler = Array.from({ length: 45 }, (_, index) => ({
    id: `check-scroll-filler-${index}`,
    type: "paragraph",
    content: [{ type: "text", text: `Filler ${index}`, styles: {} }],
  }));
  await seed(page, "Checklist paste and scroll", [
    ...filler,
    {
      id: "callout-mid-paste",
      type: "callout",
      props: { icon: "💡" },
      content: [{ type: "text", text: "Callout tail", styles: {} }],
    },
    {
      id: "check-single-paste",
      type: "checkListItem",
      props: { checked: false },
      content: [{ type: "text", text: "Task tail", styles: {} }],
    },
  ]);
  const item = page.locator('.bn-block-outer[data-id="check-single-paste"]');
  const inline = item.locator(".bn-inline-content");
  await inline.scrollIntoViewIfNeeded();
  await inline.click();
  await inline.evaluate((element) => {
    const text = document
      .createTreeWalker(element, NodeFilter.SHOW_TEXT)
      .nextNode();
    if (!text) throw new Error("Checklist text node is missing");
    const range = document.createRange();
    range.setStart(text, 5);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await inline.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "pasted text\n");
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  });
  await expect(item).toContainText("Task pasted texttail");
  await expect(page.locator('[data-content-type="checkListItem"]')).toHaveCount(
    1,
  );

  const callout = page.locator('.bn-block-outer[data-id="callout-mid-paste"]');
  const calloutInline = callout.locator(".bn-inline-content");
  await calloutInline.click();
  await calloutInline.evaluate((element) => {
    const text = document
      .createTreeWalker(element, NodeFilter.SHOW_TEXT)
      .nextNode();
    if (!text) throw new Error("Callout text node is missing");
    const range = document.createRange();
    range.setStart(text, 8);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await calloutInline.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "inside ");
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  });
  await expect(callout).toContainText("Callout inside tail");
  await expect(page.locator('[data-content-type="callout"]')).toHaveCount(1);

  const scroller = page.locator(".main-scroll");
  await page
    .locator('[data-id="check-scroll-filler-0"] .bn-inline-content')
    .click();
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const before = await scroller.evaluate((element) => element.scrollTop);
  const checkbox = item.locator('input[type="checkbox"]');
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(before);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    page.locator('.bn-block-outer[data-id="check-single-paste"]'),
  ).toContainText("Task pasted texttail");
  await expect(
    page.locator('.bn-block-outer[data-id="callout-mid-paste"]'),
  ).toContainText("Callout inside tail");
  await expect(page.locator('[data-content-type="checkListItem"]')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-content-type="callout"]')).toHaveCount(1);
  await expect(
    page.locator(
      '.bn-block-outer[data-id="check-single-paste"] input[type="checkbox"]',
    ),
  ).toBeChecked();
});

test("export copies the entire current draft as Markdown and reports clipboard denial", async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  } else
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).copiedMarkdown = text;
          },
        },
      });
    });
  await seed(page, "Clipboard page", [
    {
      id: "copy-body",
      type: "paragraph",
      content: [
        { type: "text", text: "Complete body", styles: { bold: true } },
      ],
    },
    {
      id: "copy-blank",
      type: "paragraph",
      content: [{ type: "text", text: "   ", styles: {} }],
    },
    {
      id: "copy-diagram",
      type: "mermaid",
      props: { code: "graph TD;\n A --> B;" },
    },
    {
      id: "copy-end",
      type: "paragraph",
      content: [{ type: "text", text: "Last paragraph", styles: {} }],
    },
  ]);
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("Latest unsaved title");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /Copy page as Markdown/ }).click();
  const markdown =
    browserName === "chromium"
      ? await page.evaluate(() => navigator.clipboard.readText())
      : await page.evaluate(() => (window as any).copiedMarkdown);
  expect(markdown).toContain("# Latest unsaved title");
  expect(markdown).toContain("**Complete body**");
  expect(markdown).not.toContain("&#x20;");
  expect(markdown).toContain("```mermaid\ngraph TD;\n A --> B;\n```");
  expect(markdown).toContain("Last paragraph");
  await expect(
    page.getByText("Copied this page as Markdown.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Clipboard permission denied");
    };
  });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /Copy page as Markdown/ }).click();
  await expect(
    page.getByText("Clipboard permission denied", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Copy page as Markdown/ }),
  ).toBeEnabled();
});
