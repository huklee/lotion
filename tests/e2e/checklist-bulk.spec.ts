import { test, expect } from "./fixtures";
import { seed } from "./helpers";

const text = (value: string) => [{ type: "text", text: value, styles: {} }];
const task = (
  id: string,
  label: string,
  checked: boolean,
  children?: unknown[],
) => ({
  id,
  type: "checkListItem",
  props: { checked },
  content: text(label),
  ...(children ? { children } : {}),
});

test("Cmd/Ctrl+Enter over a text selection checks every checklist item in it, then unchecks them", async ({
  page,
}) => {
  const doc = await seed(page, "Bulk checklist text", [
    task("bulk-a", "Alpha task", false),
    { id: "bulk-note", type: "paragraph", content: text("Plain note") },
    task("bulk-b", "Beta task", true, [task("bulk-b1", "Nested task", false)]),
    task("bulk-outside", "Outside task", false),
  ]);
  const box = (id: string) =>
    page.locator(`[data-id="${id}"] input[type="checkbox"]`).first();
  await page.locator('[data-id="bulk-a"] .bn-inline-content').first().click();
  await page.keyboard.press("Home");
  await page
    .locator('[data-id="bulk-b1"] .bn-inline-content')
    .first()
    .click({ modifiers: ["Shift"] });
  await page.keyboard.press("ControlOrMeta+Enter");
  for (const id of ["bulk-a", "bulk-b", "bulk-b1"])
    await expect(box(id)).toBeChecked();
  await expect(box("bulk-outside")).not.toBeChecked();
  // the text itself is untouched
  await expect(page.locator(".tiptap")).toContainText("Plain note");

  // all checked now → the same shortcut unchecks them all
  await page.keyboard.press("ControlOrMeta+Enter");
  for (const id of ["bulk-a", "bulk-b", "bulk-b1"])
    await expect(box(id)).not.toBeChecked();

  await page.keyboard.press("ControlOrMeta+Enter");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const content = (await (
    await page.request.get(`/api/documents/${doc.id}`)
  ).json()) as { blocks: any[] };
  expect(content.blocks[0].props.checked).toBe(true);
  expect(content.blocks[2].props.checked).toBe(true);
  expect(content.blocks[2].children[0].props.checked).toBe(true);
  expect(content.blocks[3].props.checked).toBe(false);

  // one undo restores the whole bulk change
  await page.keyboard.press("ControlOrMeta+z");
  for (const id of ["bulk-a", "bulk-b", "bulk-b1"])
    await expect(box(id)).not.toBeChecked();
});

test("Cmd/Ctrl+Enter on a block selection checks the checklist items inside it, nested ones included", async ({
  page,
}) => {
  await seed(page, "Bulk checklist blocks", [
    {
      id: "sel-heading",
      type: "heading",
      props: { level: 1 },
      content: text("Todo section"),
    },
    task("sel-a", "First task", false),
    task("sel-b", "Second task", true, [task("sel-b1", "Child task", false)]),
    {
      id: "sel-next",
      type: "heading",
      props: { level: 1 },
      content: text("Next section"),
    },
    task("sel-after", "Later task", false),
  ]);
  const box = (id: string) =>
    page.locator(`[data-id="${id}"] input[type="checkbox"]`).first();
  await page
    .locator('[data-id="sel-heading"] .bn-inline-content')
    .first()
    .click();
  await page
    .getByRole("button", { name: "Select section", exact: true })
    .click();
  await expect(
    page.getByRole("toolbar", { name: "Selected blocks" }),
  ).toContainText("3 selected");
  await page.keyboard.press("ControlOrMeta+Enter");
  for (const id of ["sel-a", "sel-b", "sel-b1"])
    await expect(box(id)).toBeChecked();
  await expect(box("sel-after")).not.toBeChecked();
  // the selection stays, so pressing again unchecks them all
  await page.keyboard.press("ControlOrMeta+Enter");
  for (const id of ["sel-a", "sel-b", "sel-b1"])
    await expect(box(id)).not.toBeChecked();
});

test("Cmd/Ctrl+Enter with a collapsed cursor still toggles only the current checklist item", async ({
  page,
}) => {
  await seed(page, "Single checklist toggle", [
    task("one-a", "Only me", false),
    task("one-b", "Not me", false),
  ]);
  await page.locator('[data-id="one-a"] .bn-inline-content').first().click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(
    page.locator('[data-id="one-a"] input[type="checkbox"]'),
  ).toBeChecked();
  await expect(
    page.locator('[data-id="one-b"] input[type="checkbox"]'),
  ).not.toBeChecked();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(
    page.locator('[data-id="one-a"] input[type="checkbox"]'),
  ).not.toBeChecked();
});
