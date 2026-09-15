import { test, expect, type Page } from "./fixtures";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

test("favorites persist, follow titles and sync removal across tabs", async ({
  page,
  context,
}) => {
  const doc = await seed(page, "Favorite page");
  await page
    .getByRole("button", { name: "Add to favorites", exact: true })
    .click();
  const favorites = page.getByRole("navigation", { name: "Favorites" });
  await expect(
    favorites.getByRole("link", { name: "Favorite page", exact: true }),
  ).toHaveAttribute("href", `#/page/${doc.id}`);
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("Renamed favorite");
  await expect(
    favorites.getByRole("link", { name: "Renamed favorite", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    favorites.getByRole("link", { name: "Renamed favorite", exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto(`/#/page/${doc.id}`);
  await other
    .getByRole("button", { name: "Remove from favorites", exact: true })
    .click();
  await expect(favorites).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add to favorites", exact: true }),
  ).toBeVisible();
  await other.close();
});

test("page and Home navigation build history without duplicate entries and preserve drafts", async ({
  page,
}) => {
  const a = await seed(page, "History A");
  const b = await (
    await page.request.post("/api/documents", {
      data: { title: "History B", mutationId: randomUUID() },
    })
  ).json();
  await page.reload();
  const pages = page.getByRole("navigation", { name: "Pages" });
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("History A draft");
  await pages.locator(`a[href="#/page/${b.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(b.id));
  await pages.locator(`a[href="#/page/${b.id}"]`).click();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(a.id));
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "History A draft",
  );
  await page.goForward();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "History B",
  );
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveCount(
    0,
  );
  await page.goBack();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "History B",
  );
  await page.goForward();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveCount(
    0,
  );
});

test("modified sidebar link clicks open the target in another tab without navigating this tab", async ({
  page,
  context,
}) => {
  const a = await seed(page, "New tab source");
  const b = await (
    await page.request.post("/api/documents", {
      data: { title: "New tab target", mutationId: randomUUID() },
    })
  ).json();
  await page.reload();
  const target = page
    .getByRole("navigation", { name: "Pages" })
    .locator(`a[href="#/page/${b.id}"]`);
  await expect(target).toHaveAttribute("href", `#/page/${b.id}`);
  const popup = context.waitForEvent("page");
  await target.click({ modifiers: ["ControlOrMeta"] });
  const other = await popup;
  await expect(other.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "New tab target",
  );
  await expect(page).toHaveURL(new RegExp(a.id));
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "New tab source",
  );
  await other.close();
});

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

test("checklists toggle by click and shortcut, retain their type on paste, and disable spellcheck", async ({
  page,
}) => {
  await seed(page, "Checklist editing", [
    {
      id: "check-paste",
      type: "checkListItem",
      props: { checked: false },
      content: [{ type: "text", text: "Task ", styles: {} }],
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
  await page.keyboard.press("End");
  await item.locator(".bn-inline-content").evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "first pasted line\nsecond pasted line");
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  });
  const checklistItems = page.locator('[data-content-type="checkListItem"]');
  // Engines may discard an empty suffix created by splitting at the caret.
  // The original task and both pasted lines must all remain checklist items.
  const checklistCount = await checklistItems.count();
  expect(checklistCount).toBeGreaterThanOrEqual(3);
  await expect(page.locator(".tiptap")).toContainText("first pasted line");
  await expect(page.locator(".tiptap")).toContainText("second pasted line");
  await expect(page.locator('[data-content-type="paragraph"]')).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(checklistItems).toHaveCount(checklistCount);
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
    data.setData("text/plain", "pasted text");
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

test("at-sign date accepts today with the next Enter key", async ({ page }) => {
  await seed(page, "Keyboard date");
  await page.locator(".tiptap").click();
  await page.keyboard.type("@date");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Insert date" })).toBeVisible();
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Insert date" })).toHaveCount(
    0,
  );
  await expect(page.locator(".tiptap")).toContainText(`📅 ${today}`);
});

test("at-sign calendar inserts a chosen date, persists and cancels without insertion", async ({
  page,
}) => {
  await seed(page, "Dates");
  await page.locator(".tiptap").click();
  await page.keyboard.type("@date");
  await page
    .getByRole("option")
    .filter({ hasText: "Choose a date from the calendar" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Insert date" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Date", { exact: true }).fill("2026-09-15");
  await dialog.getByRole("button", { name: "Next month" }).click();
  await dialog.getByRole("button", { name: "2026-10-20", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Insert date", exact: true })
    .click();
  await expect(page.locator(".tiptap")).toContainText("📅 2026-10-20");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.locator(".tiptap")).toContainText("📅 2026-10-20");
  await page.locator(".bn-inline-content").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" @date");
  await page
    .getByRole("option")
    .filter({ hasText: "Choose a date from the calendar" })
    .click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect((await page.locator(".tiptap").innerText()).match(/📅/g)).toHaveLength(
    1,
  );
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

test("Lotion restores legacy browser settings and drafts after the rename", async ({
  page,
}) => {
  const doc = await seed(page, "Before rename");
  await page.evaluate(async (id) => {
    const session = sessionStorage.getItem("lotion-session")!;
    sessionStorage.setItem("yestion-session", session);
    sessionStorage.removeItem("lotion-session");
    localStorage.setItem("yestion-theme", "dark");
    localStorage.removeItem("lotion-theme");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("keyval-store");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("keyval", "readwrite");
        transaction
          .objectStore("keyval")
          .put(
            {
              revision: 1,
              generation: 1,
              content: {
                title: "Legacy draft retained",
                blocks: [{ id: "legacy-body", type: "paragraph", content: [] }],
              },
            },
            `yestion-draft:${session}:${id}`,
          );
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      };
    });
  }, doc.id);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Legacy draft retained",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page).toHaveTitle(/Lotion/);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Legacy draft retained",
  );
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
  await second.reload();
  await expect(
    second.getByRole("button", { name: "Review latest versions" }),
  ).toBeVisible();
  await expect(
    second.getByRole("button", { name: "Use my draft" }),
  ).toBeVisible();
  second.once("dialog", (dialog) => dialog.accept());
  await second.getByRole("button", { name: "Use my draft" }).click();
  await expect(second.locator(".save-status")).toHaveText("Saved");
  await second.reload();
  await expect(second.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Second writer draft",
  );
  expect(
    (await (await second.request.get(`/api/documents/${doc.id}`)).json()).title,
  ).toBe("Second writer draft");
  await second.close();
});
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
    await expect(page.locator(".tiptap")).toContainText("Imported folder");
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
  await remaining.click();
  await remaining.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  });
  await page.keyboard.press("Backspace");
  await expect(remaining).toHaveText("Keep sectio");
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

async function revealSidebarPage(page: Page, id: string) {
  const tree = page.getByRole("navigation", { name: "Pages" });
  await expect(tree.locator(".page-row").first()).toBeVisible();
  const link = tree.locator(`a[href="#/page/${id}"]`);
  const more = tree.getByRole("button", {
    name: "Show more pages",
    exact: true,
  });
  while (!(await link.count()) && (await more.isVisible())) await more.click();
  await expect(link).toBeVisible();
}

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
  await revealSidebarPage(page, d.id);
  await revealSidebarPage(page, parent.id);
  const childRow = page
    .locator(".page-row")
    .filter({ has: page.getByRole("link", { name: d.title, exact: true }) });
  const parentRow = page.locator(".page-row").filter({
    has: page.getByRole("link", { name: parent.title, exact: true }),
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
    has: page.getByRole("link", { name: first.title, exact: true }),
  });
  const secondRow = page.locator(".page-row").filter({
    has: page.getByRole("link", { name: second.title, exact: true }),
  });
  await revealSidebarPage(page, first.id);
  await revealSidebarPage(page, second.id);
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
