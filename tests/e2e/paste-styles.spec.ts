import { test, expect, type Page } from "./fixtures";
import { seed } from "./helpers";

// Two styled blocks: underline + red highlight, and red bold text in a bullet.
const styled = [
  {
    id: "src-para",
    type: "paragraph",
    content: [
      { type: "text", text: "Plain then ", styles: {} },
      { type: "text", text: "underlined", styles: { underline: true } },
      { type: "text", text: " and ", styles: {} },
      { type: "text", text: "highlighted", styles: { backgroundColor: "red" } },
    ],
  },
  {
    id: "src-bullet",
    type: "bulletListItem",
    content: [
      {
        type: "text",
        text: "Red bold",
        styles: { textColor: "red", bold: true },
      },
      { type: "text", text: " and ", styles: {} },
      { type: "text", text: "struck", styles: { strike: true } },
    ],
  },
  { id: "target", type: "paragraph", content: [] },
];

/** Every styled run must exist twice: the original and the pasted copy. */
async function expectStylesCopied(page: Page) {
  const editor = page.locator(".tiptap");
  await expect(editor.locator("u", { hasText: "underlined" })).toHaveCount(2);
  await expect(
    editor.locator('[data-style-type="backgroundColor"][data-value="red"]', {
      hasText: "highlighted",
    }),
  ).toHaveCount(2);
  await expect(
    editor.locator('[data-style-type="textColor"][data-value="red"]', {
      hasText: "Red bold",
    }),
  ).toHaveCount(2);
  await expect(editor.locator("strong", { hasText: "Red bold" })).toHaveCount(
    2,
  );
  await expect(editor.locator("s", { hasText: "struck" })).toHaveCount(2);
  await expect(
    editor.locator('[data-content-type="bulletListItem"]'),
  ).toHaveCount(2);
}

test("a text selection over several blocks pastes with its formatting", async ({
  page,
}) => {
  await seed(page, "Paste styles text", styled);
  // select from the start of the paragraph to the end of the bullet, then copy
  const data = await page.locator(".tiptap").evaluate((root) => {
    const first = root.querySelector(
      '[data-id="src-para"] .bn-inline-content',
    )!;
    const last = root.querySelector(
      '[data-id="src-bullet"] .bn-inline-content',
    )!;
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(last, last.childNodes.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    return new Promise<Record<string, string>>((resolve) =>
      setTimeout(() => {
        const transfer = new DataTransfer();
        const event = new ClipboardEvent("copy", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "clipboardData", { value: transfer });
        (root as HTMLElement).dispatchEvent(event);
        resolve(
          Object.fromEntries(
            transfer.types.map((t) => [t, transfer.getData(t)]),
          ),
        );
      }, 100),
    );
  });
  expect(Object.keys(data)).toContain("text/html");
  await page.locator('[data-id="target"] .bn-inline-content').click();
  await page.locator(".tiptap").evaluate((root, data) => {
    const transfer = new DataTransfer();
    for (const [type, value] of Object.entries(data))
      transfer.setData(type, value);
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    root.dispatchEvent(event);
  }, data);
  await expectStylesCopied(page);
});

test("selected blocks paste with their formatting in another tab", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Uses the real browser clipboard");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seed(page, "Paste styles blocks", styled);
  const gutter = (await page.locator(".selection-gutter").boundingBox())!;
  const first = (await page
    .locator('[data-id="src-para"]')
    .first()
    .boundingBox())!;
  const last = (await page
    .locator('[data-id="src-bullet"]')
    .first()
    .boundingBox())!;
  await page.mouse.move(gutter.x + 5, first.y + 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width - 8, last.y + 2, { steps: 10 });
  await page.mouse.up();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("2 selected");
  await page.keyboard.press("ControlOrMeta+c");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("underlined");
  // a fresh tab has none of this tab's memory: only the system clipboard
  const other = await context.newPage();
  await other.goto(page.url());
  await other.locator('[data-id="target"] .bn-inline-content').click();
  await other.keyboard.press("ControlOrMeta+v");
  await expectStylesCopied(other);
});
