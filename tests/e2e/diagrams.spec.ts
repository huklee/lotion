import { test, expect } from "./fixtures";
import { seed } from "./helpers";

test("fenced Mermaid paste renders, unwraps source input, and persists", async ({
  page,
  context,
  browserName,
}) => {
  await seed(page, "Pasted diagram");
  const editor = page.locator(".tiptap");
  await editor.click();
  async function pasteInto(selector: string, text: string) {
    await page
      .locator(selector)
      .first()
      .evaluate((element, value) => {
        const transfer = new DataTransfer();
        transfer.setData("text/plain", value);
        const event = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "clipboardData", { value: transfer });
        element.dispatchEvent(event);
      }, text);
  }
  const source = "graph TD;\n    A --> B;";
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      "```mermaid\n" + source + "\n```",
    );
    await page.keyboard.press("ControlOrMeta+v");
  } else await pasteInto(".tiptap", "```mermaid\n" + source + "\n```");
  await expect(
    page.getByRole("textbox", { name: "Mermaid source" }),
  ).toHaveValue(source);
  const preview = page.getByRole("img", { name: "Mermaid diagram preview" });
  await expect(preview).toBeVisible({ timeout: 15000 });
  await pasteInto(
    ".lotion-mermaid textarea",
    "```mermaid\ngraph LR;\n B --> C;\n```",
  );
  await expect(
    page.getByRole("textbox", { name: "Mermaid source" }),
  ).toHaveValue("graph LR;\n B --> C;");
  await expect(page.locator(".lotion-mermaid")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Mermaid source" }),
  ).toHaveValue("graph LR;\n B --> C;");
  await expect(preview).toBeVisible({ timeout: 15000 });
});

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
  await expect(page.locator(".lotion-mermaid [role=status]")).not.toHaveText(
    "Rendering diagram…",
  );
  await expect(preview).toHaveCount(0);
  await source.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("sequenceDiagram\n Alice->>Bob: Hello");
  await expect(preview).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Saved", {
    timeout: 15000,
  });
  await page.reload();
  await expect(source).toHaveValue("sequenceDiagram\n Alice->>Bob: Hello");
  await expect(preview).toBeVisible({ timeout: 15000 });
});

test("Mermaid source owns keyboard input without triggering block shortcuts", async ({
  page,
}) => {
  await seed(page, "Mermaid keyboard editing", [
    {
      id: "keyboard-checklist",
      type: "checkListItem",
      props: { checked: false },
      content: [{ type: "text", text: "Keep unchecked", styles: {} }],
    },
    {
      id: "keyboard-mermaid",
      type: "mermaid",
      props: { code: "graph TD\n A --> B" },
    },
    {
      id: "keyboard-tail",
      type: "paragraph",
      content: [{ type: "text", text: "Keep after diagram", styles: {} }],
    },
  ]);
  const checklist = page.locator('[data-id="keyboard-checklist"]');
  const diagram = page.locator('[data-id="keyboard-mermaid"]');
  await checklist.locator(".bn-inline-content").click();
  const source = diagram.getByRole("textbox", { name: "Mermaid source" });
  await source.click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(checklist.locator('input[type="checkbox"]')).not.toBeChecked();
  await page.keyboard.press("Alt+Shift+ArrowDown");
  const blockOrder = await page
    .locator(
      '.bn-block-outer[data-id="keyboard-mermaid"], .bn-block-outer[data-id="keyboard-tail"]',
    )
    .evaluateAll((blocks) =>
      blocks.map((block) => block.getAttribute("data-id")),
    );
  expect(blockOrder).toEqual(["keyboard-mermaid", "keyboard-tail"]);
  await source.press("End");
  await source.type(";");
  await expect(source).toHaveValue("graph TD\n A --> B;");
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
      (value) => localStorage.setItem("lotion-theme", value),
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
  await page.keyboard.press("ControlOrMeta+End");
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
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect(errors).toEqual([]);
});
