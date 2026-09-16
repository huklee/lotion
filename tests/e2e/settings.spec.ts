import { test, expect } from "./fixtures";
import { seed } from "./helpers";

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
  await panel.getByLabel("Appearance theme").selectOption("dark");
  await panel.getByLabel("Editor text size").selectOption("large");
  await panel.getByLabel("Page width").selectOption("wide");
  await panel.getByLabel("Open sidebar on startup").uncheck();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-editor-text-size",
    "large",
  );
  await expect(page.locator("html")).toHaveAttribute("data-page-width", "wide");
  await expect(page.locator(".bn-editor")).toHaveCSS("font-size", "16px");
  await expect(page.locator(".document")).toHaveCSS("max-width", "1180px");
  await panel.getByRole("button", { name: "Close dialog" }).click();

  await page.reload();
  await expect(page.locator(".app")).toHaveClass(/sidebar-hidden/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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
  await expect(reopened.getByLabel("Appearance theme")).toHaveValue("dark");
  await expect(reopened.getByLabel("Editor text size")).toHaveValue("large");
  await expect(reopened.getByLabel("Page width")).toHaveValue("wide");
  await expect(
    reopened.getByLabel("Open sidebar on startup"),
  ).not.toBeChecked();
  await reopened
    .getByRole("button", { name: "Reset display settings" })
    .click();
  await expect(reopened.getByLabel("Appearance theme")).toHaveValue("system");
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
      id: "palette-text",
      type: "paragraph",
      content: colors.map((color) => ({
        type: "text",
        text: `${color} `,
        styles: { textColor: color },
      })),
    },
    {
      id: "palette-background",
      type: "paragraph",
      content: colors.map((color) => ({
        type: "text",
        text: `${color} `,
        styles: { backgroundColor: color },
      })),
    },
  ]);
  await page
    .getByRole("button", { name: "Control panel", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Control panel" });

  for (const scheme of ["light", "dark", "black"]) {
    await panel.getByLabel("Appearance theme").selectOption(scheme);
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
      const canvas = getComputedStyle(document.documentElement).backgroundColor;
      const textRatios = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-id="palette-text"] [data-style-type="textColor"]',
        ),
      ].map((element) => contrast(getComputedStyle(element).color, canvas));
      const backgroundRatios = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-id="palette-background"] [data-style-type="backgroundColor"]',
        ),
      ].map((element) => {
        const style = getComputedStyle(element);
        return contrast(style.color, style.backgroundColor);
      });
      return { textRatios, backgroundRatios };
    });
    expect(ratios.textRatios).toHaveLength(9);
    expect(ratios.backgroundRatios).toHaveLength(9);
    expect(Math.min(...ratios.textRatios)).toBeGreaterThanOrEqual(4.5);
    expect(Math.min(...ratios.backgroundRatios)).toBeGreaterThanOrEqual(4.5);
  }
  await panel.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
});

test("configurable text-color shortcuts show on hover and repeat the last color", async ({
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
  const redShortcut = panel.getByLabel("Red text shortcut");
  await redShortcut.focus();
  await page.keyboard.press("ControlOrMeta+Alt+R");
  await expect(redShortcut).toHaveValue(/R/);
  await panel.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();

  const inline = page.locator('[data-id="shortcut-text"] .bn-inline-content');
  const selectWord = async (word: string) => {
    await inline.click();
    await inline.evaluate((element, word) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const start = node.textContent?.indexOf(word) ?? -1;
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + word.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
        return;
      }
      throw new Error(`Could not select ${word}`);
    }, word);
  };

  await selectWord("First");
  await page.keyboard.press("ControlOrMeta+Alt+R");
  await expect(
    inline.locator('[data-style-type="textColor"][data-value="red"]'),
  ).toContainText("First");

  await selectWord("Second");
  await page.getByRole("button", { name: "Colors", exact: true }).click();
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

  await selectWord("Third");
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect(
    inline
      .locator('[data-style-type="textColor"][data-value="blue"]')
      .filter({ hasText: "Third" }),
  ).toContainText("Third");

  await selectWord("First");
  await page.getByRole("button", { name: "Colors", exact: true }).click();
  await page
    .locator(".lotion-background-option")
    .filter({ hasText: "Yellow" })
    .click();
  await selectWord("Fourth");
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect(
    inline
      .locator('[data-style-type="backgroundColor"][data-value="yellow"]')
      .filter({ hasText: "First" }),
  ).toContainText("First");
  await expect(
    inline
      .locator('[data-style-type="backgroundColor"][data-value="yellow"]')
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
    inline.locator('[data-style-type="backgroundColor"][data-value="yellow"]'),
  ).toHaveCount(2);
});
