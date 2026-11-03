import { test, expect } from "./fixtures";
import { randomUUID } from "node:crypto";
import { seed } from "./helpers";

async function selectInlineWord(
  inline: import("@playwright/test").Locator,
  word: string,
) {
  await inline.click();
  await inline.evaluate((element, selectedWord) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const start = node.textContent?.indexOf(selectedWord) ?? -1;
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + selectedWord.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      return;
    }
    throw new Error(`Could not select ${selectedWord}`);
  }, word);
}

test("last color style is shared across page navigation and reloads in one session", async ({
  page,
}) => {
  await seed(page, "Color source", [
    {
      id: "session-color-source",
      type: "paragraph",
      content: [{ type: "text", text: "Source", styles: {} }],
    },
  ]);
  const source = page.locator(
    '[data-id="session-color-source"] .bn-inline-content',
  );
  await selectInlineWord(source, "Source");
  await page.getByRole("button", { name: "Colors", exact: true }).click();
  await page
    .locator(".lotion-color-option")
    .filter({ hasText: "Blue" })
    .click();
  await expect(
    source.locator('[data-style-type="textColor"][data-value="blue"]'),
  ).toContainText("Source");
  await expect(
    source.locator('[data-style-type="backgroundColor"][data-value="blue"]'),
  ).toContainText("Source");

  const created = await page.request.post("/api/documents", {
    data: { title: "Color destination", mutationId: randomUUID() },
  });
  const destination = await created.json();
  await page.request.put(`/api/documents/${destination.id}/content`, {
    headers: { "If-Match": "1" },
    data: {
      title: "Color destination",
      mutationId: randomUUID(),
      blocks: [
        {
          id: "session-color-destination",
          type: "paragraph",
          content: [{ type: "text", text: "Target Another", styles: {} }],
        },
      ],
    },
  });
  await page.goto(`/#/page/${destination.id}`);
  const target = page.locator(
    '[data-id="session-color-destination"] .bn-inline-content',
  );
  await selectInlineWord(target, "Target");
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect(
    target
      .locator('[data-style-type="textColor"][data-value="blue"]')
      .filter({ hasText: "Target" }),
  ).toContainText("Target");
  await expect(
    target
      .locator('[data-style-type="backgroundColor"][data-value="blue"]')
      .filter({ hasText: "Target" }),
  ).toContainText("Target");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");

  await page.reload();
  await selectInlineWord(target, "Another");
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect(
    target
      .locator('[data-style-type="textColor"][data-value="blue"]')
      .filter({ hasText: "Another" }),
  ).toContainText("Another");
  await expect(
    target
      .locator('[data-style-type="backgroundColor"][data-value="blue"]')
      .filter({ hasText: "Another" }),
  ).toContainText("Another");
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
        transaction.objectStore("keyval").put(
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

test("control panel applies, persists and resets browser display settings", async ({
  page,
}) => {
  await seed(page, "Control panel page");
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Control panel" });
  await panel.getByLabel("Color scheme").selectOption("dark");
  await panel.getByLabel("Workspace font").selectOption("manrope");
  await panel.getByLabel("Editor text size").selectOption("large");
  await panel.getByLabel("Page width").selectOption("wide");
  await panel.getByLabel("Open sidebar on startup").uncheck();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-editor-font",
    "manrope",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-editor-text-size",
    "large",
  );
  await expect(page.locator("html")).toHaveAttribute("data-page-width", "wide");
  await expect(page.locator(".bn-editor")).toHaveCSS("font-size", "16px");
  await expect(page.locator(".bn-editor")).toHaveCSS("font-family", /Manrope/);
  await expect(page.locator(".document")).toHaveCSS("max-width", "1180px");
  await panel.getByRole("button", { name: "Close dialog" }).click();

  await page.reload();
  await expect(page.locator(".app")).toHaveClass(/sidebar-hidden/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-editor-font",
    "manrope",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-editor-text-size",
    "large",
  );
  await expect(page.locator("html")).toHaveAttribute("data-page-width", "wide");

  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const reopened = page.getByRole("dialog", { name: "Control panel" });
  await expect(reopened.getByLabel("Color scheme")).toHaveValue("dark");
  await expect(reopened.getByLabel("Workspace font")).toHaveValue("manrope");
  await expect(reopened.getByLabel("Editor text size")).toHaveValue("large");
  await expect(reopened.getByLabel("Page width")).toHaveValue("wide");
  await expect(
    reopened.getByLabel("Open sidebar on startup"),
  ).not.toBeChecked();
  await reopened
    .getByRole("button", { name: "Reset system and editor settings" })
    .click();
  await expect(reopened.getByLabel("Color scheme")).toHaveValue("system");
  await expect(reopened.getByLabel("Workspace font")).toHaveValue("dm-sans");
  await expect(reopened.getByLabel("Editor text size")).toHaveValue("medium");
  await expect(reopened.getByLabel("Page width")).toHaveValue("comfortable");
  await expect(reopened.getByLabel("Open sidebar on startup")).toBeChecked();
});

test("pastel text and background colors stay readable in every scheme", async ({
  page,
}) => {
  const colors = [
    "gray",
    "brown",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
  ];
  await seed(page, "Pastel palette", [
    {
      id: "palette-combined",
      type: "paragraph",
      content: colors.map((color) => ({
        type: "text",
        text: `${color} `,
        styles: { textColor: color, backgroundColor: color },
      })),
    },
  ]);
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Control panel" });

  for (const scheme of ["light", "dark", "black"]) {
    await panel.getByLabel("Color scheme").selectOption(scheme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
    const ratios = await page.evaluate(() => {
      const rgb = (value: string) =>
        value
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
      const luminance = (value: string) => {
        const channels = rgb(value)
          .map((channel) => channel / 255)
          .map((channel) =>
            channel <= 0.04045
              ? channel / 12.92
              : Math.pow((channel + 0.055) / 1.055, 2.4),
          );
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const contrast = (first: string, second: string) => {
        const [lighter, darker] = [luminance(first), luminance(second)].sort(
          (a, b) => b - a,
        );
        return (lighter + 0.05) / (darker + 0.05);
      };
      const combinedRatios = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-id="palette-combined"] [data-style-type="backgroundColor"]',
        ),
      ].map((element) => {
        const style = getComputedStyle(element);
        return contrast(style.color, style.backgroundColor);
      });
      return { combinedRatios };
    });
    expect(ratios.combinedRatios).toHaveLength(9);
    expect(Math.min(...ratios.combinedRatios)).toBeGreaterThanOrEqual(4.5);
  }
  await panel.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
});

test("ten combined color presets support shortcuts and repeat the last preset", async ({
  page,
}) => {
  await seed(page, "Formatting shortcut page", [
    {
      id: "shortcut-text",
      type: "paragraph",
      content: [
        { type: "text", text: "First Second Third Fourth", styles: {} },
      ],
    },
  ]);
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Control panel" });
  const redShortcut = panel.getByLabel("Red preset shortcut");
  await redShortcut.focus();
  await page.keyboard.press("ControlOrMeta+Alt+R");
  await expect(redShortcut).toHaveValue(/R/);
  await panel.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();

  const inline = page.locator('[data-id="shortcut-text"] .bn-inline-content');
  await selectInlineWord(inline, "First");
  await page.keyboard.press("ControlOrMeta+Alt+R");
  await expect(
    inline.locator('[data-style-type="textColor"][data-value="red"]'),
  ).toContainText("First");
  await expect(
    inline.locator('[data-style-type="backgroundColor"][data-value="red"]'),
  ).toContainText("First");

  await selectInlineWord(inline, "Second");
  await page.getByRole("button", { name: "Colors", exact: true }).click();
  await expect(page.locator(".lotion-color-option")).toHaveCount(10);
  await expect(page.getByText("Background color", { exact: true })).toHaveCount(
    0,
  );
  const redOption = page.locator(".lotion-color-option").filter({
    hasText: "Red",
  });
  await redOption.hover();
  await expect(redOption.locator(".color-shortcut-hint")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(redOption.locator(".color-shortcut-hint")).toContainText("R");
  await page
    .locator(".lotion-color-option")
    .filter({ hasText: "Blue" })
    .click();
  await expect(
    inline.locator('[data-style-type="textColor"][data-value="blue"]'),
  ).toContainText("Second");
  await expect(
    inline.locator('[data-style-type="backgroundColor"][data-value="blue"]'),
  ).toContainText("Second");

  await selectInlineWord(inline, "Third");
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect(
    inline
      .locator('[data-style-type="textColor"][data-value="blue"]')
      .filter({ hasText: "Third" }),
  ).toContainText("Third");
  await expect(
    inline
      .locator('[data-style-type="backgroundColor"][data-value="blue"]')
      .filter({ hasText: "Third" }),
  ).toContainText("Third");
  await selectInlineWord(inline, "Fourth");
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect(
    inline
      .locator('[data-style-type="textColor"][data-value="blue"]')
      .filter({ hasText: "Fourth" }),
  ).toContainText("Fourth");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    inline.locator('[data-style-type="textColor"][data-value="red"]'),
  ).toContainText("First");
  await expect(
    inline
      .locator('[data-style-type="textColor"][data-value="blue"]')
      .filter({ hasText: "Second" }),
  ).toContainText("Second");
  await expect(
    inline
      .locator('[data-style-type="textColor"][data-value="blue"]')
      .filter({ hasText: "Third" }),
  ).toContainText("Third");
  await expect(
    inline.locator('[data-style-type="backgroundColor"][data-value="blue"]'),
  ).toHaveCount(3);
});

test("top-right wide page toggle switches and remembers the page width", async ({
  page,
}) => {
  await seed(page, "Wide toggle");
  const toggle = page.getByRole("button", { name: "Wide page" });
  const html = page.locator("html");
  if ((await toggle.getAttribute("aria-pressed")) === "true")
    await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(html).toHaveAttribute("data-page-width", "comfortable");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(html).toHaveAttribute("data-page-width", "wide");
  await expect(page.locator(".document")).toHaveCSS("max-width", "1180px");
  await page.reload();
  await expect(page.getByRole("button", { name: "Wide page" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Wide page" }).click();
  await expect(html).toHaveAttribute("data-page-width", "comfortable");
});

test("color shortcuts recorded in the control panel apply, switch and clear colours", async ({
  page,
}) => {
  await seed(page, "Shortcut colours", [
    {
      id: "shortcut-colours",
      type: "paragraph",
      content: [{ type: "text", text: "Alpha Beta Gamma", styles: {} }],
    },
  ]);
  // record Red = Mod+Shift+1 and Blue = Mod+Alt+B in the control panel
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Control panel" });
  await panel.getByLabel("Red preset shortcut").focus();
  await page.keyboard.press("ControlOrMeta+Shift+1");
  await expect(panel.getByLabel("Red preset shortcut")).not.toHaveValue("");
  await panel.getByLabel("Blue preset shortcut").focus();
  await page.keyboard.press("ControlOrMeta+Alt+B");
  await expect(panel.getByLabel("Blue preset shortcut")).not.toHaveValue("");
  await panel.getByLabel("Default colors shortcut").focus();
  await page.keyboard.press("ControlOrMeta+Alt+0");
  await expect(panel.getByLabel("Default colors shortcut")).not.toHaveValue("");
  await panel.getByRole("button", { name: "Close dialog" }).click();
  await expect(panel).toBeHidden();

  const line = page.locator('[data-id="shortcut-colours"] .bn-inline-content');
  const colour = (word: string, kind: string, value: string) =>
    line
      .locator(`[data-style-type="${kind}"][data-value="${value}"]`)
      .filter({ hasText: word });
  // applies without a reload
  await selectInlineWord(line, "Alpha");
  await page.keyboard.press("ControlOrMeta+Shift+1");
  await expect(colour("Alpha", "textColor", "red")).toHaveCount(1);
  await expect(colour("Alpha", "backgroundColor", "red")).toHaveCount(1);
  // another preset on the same word replaces both colours
  await selectInlineWord(line, "Alpha");
  await page.keyboard.press("ControlOrMeta+Alt+B");
  await expect(colour("Alpha", "textColor", "blue")).toHaveCount(1);
  await expect(colour("Alpha", "backgroundColor", "blue")).toHaveCount(1);
  await expect(colour("Alpha", "textColor", "red")).toHaveCount(0);
  // repeat last applies the last preset (blue) elsewhere
  await selectInlineWord(line, "Gamma");
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect(colour("Gamma", "textColor", "blue")).toHaveCount(1);
  // Default clears both colours
  await selectInlineWord(line, "Alpha");
  await page.keyboard.press("ControlOrMeta+Alt+0");
  await expect(
    line.locator("[data-style-type]").filter({ hasText: "Alpha" }),
  ).toHaveCount(0);
  await expect(colour("Gamma", "backgroundColor", "blue")).toHaveCount(1);
});

test("color shortcuts match the physical key on Mac Option, Shift+digit and Korean input", async ({
  page,
}) => {
  await seed(page, "Shortcut keys", [
    {
      id: "shortcut-keys",
      type: "paragraph",
      content: [{ type: "text", text: "One Two Three", styles: {} }],
    },
  ]);
  await page.evaluate(() =>
    localStorage.setItem(
      "lotion-formatting-shortcuts",
      JSON.stringify({
        colorPresets: {
          red: "Mod+Alt+R",
          green: "Mod+Shift+2",
          purple: "Mod+Alt+P",
        },
        repeatLast: "Mod+Shift+H",
      }),
    ),
  );
  await page.reload();
  const line = page.locator('[data-id="shortcut-keys"] .bn-inline-content');
  type Press = {
    key: string;
    code: string;
    altKey?: boolean;
    shiftKey?: boolean;
  };
  const press = (init: Press) =>
    line.evaluate((el, init) => {
      const mac = navigator.platform.includes("Mac");
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          metaKey: mac,
          ctrlKey: !mac,
          ...init,
        }),
      );
    }, init);
  // ⌥ on a Mac turns R into "®"
  await selectInlineWord(line, "One");
  await press({ key: "®", code: "KeyR", altKey: true });
  await expect(
    line.locator('[data-style-type="textColor"][data-value="red"]'),
  ).toContainText("One");
  // Shift+2 reports "@"
  await selectInlineWord(line, "Two");
  await press({ key: "@", code: "Digit2", shiftKey: true });
  await expect(
    line.locator('[data-style-type="textColor"][data-value="green"]'),
  ).toContainText("Two");
  // Korean input reports "ㅔ" for P
  await selectInlineWord(line, "Three");
  await press({ key: "ㅔ", code: "KeyP", altKey: true });
  await expect(
    line.locator('[data-style-type="textColor"][data-value="purple"]'),
  ).toContainText("Three");
});

test("a color shortcut changed in one tab works in an open tab without a reload", async ({
  page,
  context,
}) => {
  await seed(page, "Shortcut tabs", [
    {
      id: "shortcut-tabs",
      type: "paragraph",
      content: [{ type: "text", text: "Other tab word", styles: {} }],
    },
  ]);
  const other = await context.newPage();
  await other.goto(page.url());
  const line = other.locator('[data-id="shortcut-tabs"] .bn-inline-content');
  await expect(line).toContainText("Other tab word");
  // assign Orange = Mod+Alt+O in the first tab
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Control panel" });
  await panel.getByLabel("Orange preset shortcut").focus();
  await page.keyboard.press("ControlOrMeta+Alt+O");
  await expect(panel.getByLabel("Orange preset shortcut")).not.toHaveValue("");
  // the second tab, untouched since it loaded, uses it
  await other.bringToFront();
  await selectInlineWord(line, "word");
  await other.keyboard.press("ControlOrMeta+Alt+O");
  await expect(
    line.locator('[data-style-type="textColor"][data-value="orange"]'),
  ).toContainText("word");
});
