import { test, expect } from "./fixtures";
import { seed } from "./helpers";

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
test("Backspace deletes a selected section with children, supports undo and preserves text editing", async ({
  page,
}) => {
  await seed(page, "Delete selection", [
    {
      id: "delete-heading",
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "Delete section", styles: {} }],
    },
    {
      id: "delete-body",
      type: "paragraph",
      content: [{ type: "text", text: "Delete body", styles: {} }],
      children: [
        {
          id: "delete-child",
          type: "paragraph",
          content: [{ type: "text", text: "Nested child", styles: {} }],
        },
      ],
    },
    {
      id: "keep-heading",
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "Keep section", styles: {} }],
    },
  ]);
  await page
    .locator('[data-id="delete-heading"] .bn-inline-content')
    .first()
    .click();
  await page
    .getByRole("button", { name: "Select section", exact: true })
    .click();
  await page.keyboard.press("Backspace");
  await expect(page.locator('[data-id="delete-heading"]')).toHaveCount(0);
  await expect(page.locator('[data-id="delete-body"]')).toHaveCount(0);
  await expect(page.locator('[data-id="delete-child"]')).toHaveCount(0);
  await expect(page.locator(".tiptap")).toContainText("Keep section");
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".tiptap")).toContainText("Nested child");
  await page
    .locator('[data-id="delete-heading"] .bn-inline-content')
    .first()
    .click();
  await page
    .getByRole("button", { name: "Select section", exact: true })
    .click();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator('[data-id="delete-body"]')).toHaveCount(0);
  const remaining = page
    .locator('[data-id="keep-heading"] .bn-inline-content')
    .first();
  await remaining.click();
  await page
    .getByRole("button", { name: "Select section", exact: true })
    .click();
  const textBeforeBackspace = await remaining.innerText();
  await remaining.click();
  await page.keyboard.press("Backspace");
  await expect
    .poll(async () => (await remaining.innerText()).length)
    .toBe(textBeforeBackspace.length - 1);
  await expect(remaining).toContainText("Keep");
});

test("deleting a selected nested block preserves following block indentation", async ({
  page,
}) => {
  const doc = await seed(page, "Preserve indentation", [
    {
      id: "indent-parent",
      type: "paragraph",
      content: [{ type: "text", text: "Parent", styles: {} }],
      children: [
        {
          id: "indent-delete",
          type: "paragraph",
          content: [{ type: "text", text: "Delete child", styles: {} }],
        },
        {
          id: "indent-keep",
          type: "paragraph",
          content: [{ type: "text", text: "Keep child", styles: {} }],
          children: [
            {
              id: "indent-grandchild",
              type: "paragraph",
              content: [{ type: "text", text: "Grandchild", styles: {} }],
            },
          ],
        },
      ],
    },
    {
      id: "indent-following",
      type: "paragraph",
      content: [{ type: "text", text: "Following root", styles: {} }],
      children: [
        {
          id: "indent-following-child",
          type: "paragraph",
          content: [{ type: "text", text: "Following child", styles: {} }],
        },
      ],
    },
  ]);
  await page.locator('[data-id="indent-delete"] .bn-inline-content').click();
  await page
    .getByRole("button", { name: "Select section", exact: true })
    .click();
  await page.keyboard.press("Backspace");
  await expect(page.locator('[data-id="indent-delete"]')).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");

  const content = (await (
    await page.request.get(`/api/documents/${doc.id}`)
  ).json()) as { blocks: any[] };
  expect(content.blocks[0].id).toBe("indent-parent");
  expect(content.blocks[0].children[0].id).toBe("indent-keep");
  expect(content.blocks[0].children[0].children[0].id).toBe(
    "indent-grandchild",
  );
  expect(content.blocks[1].id).toBe("indent-following");
  expect(content.blocks[1].children[0].id).toBe("indent-following-child");

  await page.reload();
  const horizontalPositions = await Promise.all(
    [
      "indent-parent",
      "indent-keep",
      "indent-grandchild",
      "indent-following",
      "indent-following-child",
    ].map((id) =>
      page
        .locator(`[data-id="${id}"] .bn-inline-content`)
        .first()
        .evaluate((element) => element.getBoundingClientRect().left),
    ),
  );
  expect(horizontalPositions[1]).toBeGreaterThan(horizontalPositions[0]);
  expect(horizontalPositions[2]).toBeGreaterThan(horizontalPositions[1]);
  expect(horizontalPositions[4]).toBeGreaterThan(horizontalPositions[3]);
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

test("block lasso preserves text dragging, supports reverse selection and extends with Shift", async ({
  page,
}) => {
  await seed(page, "Notion-style lasso", [
    {
      id: "lasso-a",
      type: "paragraph",
      content: [{ type: "text", text: "Selectable words", styles: {} }],
    },
    {
      id: "lasso-b",
      type: "paragraph",
      content: [{ type: "text", text: "Second block", styles: {} }],
    },
    {
      id: "lasso-c",
      type: "paragraph",
      content: [{ type: "text", text: "Third block", styles: {} }],
    },
  ]);
  const firstText = page.locator('[data-id="lasso-a"] .bn-inline-content');
  const textBox = (await firstText.boundingBox())!;
  await page.mouse.move(textBox.x + 3, textBox.y + textBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    textBox.x + Math.min(textBox.width - 3, 70),
    textBox.y + textBox.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => window.getSelection()?.toString().length),
  ).toBeGreaterThan(0);

  const gutter = (await page.locator(".selection-gutter").boundingBox())!;
  const second = (await page
    .locator('.bn-block-outer[data-id="lasso-b"]')
    .boundingBox())!;
  await page.mouse.move(gutter.x + 5, second.y + second.height - 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width - 10, second.y + 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("1 selected");

  const third = (await page
    .locator('.bn-block-outer[data-id="lasso-c"]')
    .boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.move(gutter.x + 5, third.y + 2);
  await page.mouse.down();
  await page.mouse.move(
    third.x + third.width - 10,
    third.y + third.height - 2,
    {
      steps: 10,
    },
  );
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("2 selected");
  await expect(
    page.locator('.block-selection-highlight[data-block-id="lasso-a"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.block-selection-highlight[data-block-id="lasso-b"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.block-selection-highlight[data-block-id="lasso-c"]'),
  ).toHaveCount(1);
});

test("block lasso auto-scrolls and retains offscreen hits", async ({
  page,
}) => {
  await seed(
    page,
    "Auto-scroll lasso",
    Array.from({ length: 40 }, (_, index) => ({
      id: `auto-lasso-${index}`,
      type: "paragraph",
      content: [{ type: "text", text: `Block ${index}`, styles: {} }],
    })),
  );
  const scroller = page.locator(".main-scroll");
  const bounds = (await scroller.boundingBox())!;
  const gutter = (await page.locator(".selection-gutter").boundingBox())!;
  const first = (await page
    .locator('.bn-block-outer[data-id="auto-lasso-0"]')
    .boundingBox())!;
  await page.mouse.move(gutter.x + 5, first.y + 2);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width - 80,
    bounds.y + bounds.height - 3,
    {
      steps: 12,
    },
  );
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(80);
  await page.mouse.up();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText(/\d+ selected/);
  await expect
    .poll(() => page.locator(".block-selection-highlight").count())
    .toBeGreaterThan(5);
});

test("Backspace deletes a rectangle selection and leaves an editable empty document", async ({
  page,
}) => {
  await seed(page, "Delete rectangle", [
    {
      id: "rect-delete-a",
      type: "paragraph",
      content: [{ type: "text", text: "Alpha", styles: {} }],
    },
    {
      id: "rect-delete-b",
      type: "paragraph",
      content: [{ type: "text", text: "Beta", styles: {} }],
    },
  ]);
  const gutter = (await page.locator(".selection-gutter").boundingBox())!;
  const first = (await page
    .locator('[data-id="rect-delete-a"]')
    .first()
    .boundingBox())!;
  const second = (await page
    .locator('[data-id="rect-delete-b"]')
    .first()
    .boundingBox())!;
  await page.mouse.move(gutter.x + 5, Math.max(gutter.y + 1, first.y + 2));
  await page.mouse.down();
  await page.mouse.move(
    second.x + second.width - 10,
    second.y + second.height - 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("2 selected");
  await page.keyboard.press("Backspace");
  await expect(page.locator('[data-id="rect-delete-a"]')).toHaveCount(0);
  await expect(page.locator('[data-id="rect-delete-b"]')).toHaveCount(0);
  await page.keyboard.insertText("Still editable");
  await expect(page.locator(".tiptap")).toContainText("Still editable");
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
