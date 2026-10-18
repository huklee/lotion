import { test, expect } from "./fixtures";
import { seed } from "./helpers";

const item = (
  id: string,
  type: string,
  text: string,
  children: any[] = [],
) => ({
  id,
  type,
  content: text ? [{ type: "text", text, styles: {} }] : [],
  children,
});
const p = (id: string, text: string, children: any[] = []) =>
  item(id, "paragraph", text, children);
const b = (id: string, text: string, children: any[] = []) =>
  item(id, "bulletListItem", text, children);

/** "type:text" lines with two spaces per nesting level, from the rendered editor. */
async function shape(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const walk = (el: Element, depth: number): string[] =>
      [...el.querySelectorAll(":scope > .bn-block-outer")].flatMap((outer) => {
        const content = outer.querySelector(
          ":scope > .bn-block > .bn-block-content",
        ) as HTMLElement;
        const text =
          content.querySelector(".bn-inline-content")?.textContent ?? "";
        const group = outer.querySelector(
          ":scope > .bn-block > .bn-block-group",
        );
        return [
          `${"  ".repeat(depth)}${content.dataset.contentType}:${text}`,
          ...(group ? walk(group, depth + 1) : []),
        ];
      });
    return walk(document.querySelector(".bn-editor > .bn-block-group")!, 0);
  });
}

async function backspaceAtStart(
  page: import("@playwright/test").Page,
  id: string,
) {
  await page.locator(`[data-id="${id}"] .bn-inline-content`).first().click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home",
  );
  await page.keyboard.press("Backspace");
}

test("Backspace on an empty indented line deletes it without re-indenting the next line", async ({
  page,
}) => {
  await seed(page, "Backspace nested empty", [
    b("a", "A", [b("a1", "A1"), p("empty", ""), b("a2", "A2")]),
    b("d", "D"),
  ]);
  await backspaceAtStart(page, "empty");
  await expect
    .poll(() => shape(page))
    .toEqual([
      "bulletListItem:A",
      "  bulletListItem:A1",
      "  bulletListItem:A2",
      "bulletListItem:D",
    ]);
  // typing continues at the end of the line above
  await page.keyboard.type("x");
  await expect.poll(() => shape(page)).toContain("  bulletListItem:A1x");
  // one undo step brings the empty line back (after undoing the typed "x")
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(() => shape(page))
    .toEqual([
      "bulletListItem:A",
      "  bulletListItem:A1",
      "  paragraph:",
      "  bulletListItem:A2",
      "bulletListItem:D",
    ]);
});

test("Backspace at the start of an indented line merges it into the line above; siblings stay", async ({
  page,
}) => {
  await seed(page, "Backspace nested merge", [
    b("a", "A", [b("a1", "A1"), p("c", "C"), b("a2", "A2")]),
  ]);
  await backspaceAtStart(page, "c");
  await expect
    .poll(() => shape(page))
    .toEqual([
      "bulletListItem:A",
      "  bulletListItem:A1C",
      "  bulletListItem:A2",
    ]);
  // the cursor sits at the join
  await page.keyboard.type("|");
  await expect.poll(() => shape(page)).toContain("  bulletListItem:A1|C");
});

test("merging a line that has nested lines keeps them nested under the merged line", async ({
  page,
}) => {
  await seed(page, "Backspace merge children", [
    p("a", "A"),
    p("c", "C", [p("c1", "C1")]),
    p("d", "D"),
  ]);
  await backspaceAtStart(page, "c");
  await expect
    .poll(() => shape(page))
    .toEqual(["paragraph:AC", "  paragraph:C1", "paragraph:D"]);
});

test("ordinary Backspace behaviour is unchanged (empty top-level line, list item to paragraph)", async ({
  page,
}) => {
  await seed(page, "Backspace plain", [p("a", "A"), p("e", ""), b("c", "C")]);
  await backspaceAtStart(page, "e");
  await expect
    .poll(() => shape(page))
    .toEqual(["paragraph:A", "bulletListItem:C"]);
  await backspaceAtStart(page, "c");
  await expect.poll(() => shape(page)).toEqual(["paragraph:A", "paragraph:C"]);
});
