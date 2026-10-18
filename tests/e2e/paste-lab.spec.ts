/**
 * Paste lab: pastes each realistic clipboard payload with the classic and the new
 * engine and records the resulting structure and a screenshot (for review).
 * Run with PASTE_LAB_OUT=<dir>; without it the spec is skipped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "./fixtures";
import { seed } from "./helpers";
import { CASES } from "./paste-fixtures/cases";
const EXPECTED: Record<string, string[]> = JSON.parse(
  readFileSync(
    new URL("./paste-fixtures/expected-v2.json", import.meta.url),
    "utf8",
  ),
);
import { expect } from "@playwright/test";

const OUT = process.env.PASTE_LAB_OUT;

async function outline(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const inline = (el: Element | null): string => {
      if (!el) return "";
      let s = "";
      el.childNodes.forEach((n) => {
        if (n.nodeType === 3) s += n.textContent;
        else if (n instanceof HTMLElement) {
          const inner = inline(n);
          if (n.tagName === "A") s += `[${inner}](${n.getAttribute("href")})`;
          else if (n.tagName === "STRONG" || n.dataset.style === "bold")
            s += `**${inner}**`;
          else if (n.tagName === "EM") s += `_${inner}_`;
          else if (n.tagName === "CODE") s += `\`${inner}\``;
          else s += inner;
        }
      });
      return s;
    };
    const walk = (group: Element, depth: number): string[] =>
      [...group.querySelectorAll(":scope > .bn-block-outer")].flatMap(
        (outer) => {
          const c = outer.querySelector(
            ":scope > .bn-block > .bn-block-content",
          ) as HTMLElement;
          const type = c?.dataset.contentType ?? "?";
          let text: string;
          if (type === "table")
            text = [...c.querySelectorAll("tr")]
              .map((tr) =>
                [...tr.querySelectorAll("td,th")]
                  .map((td) => td.textContent?.trim())
                  .join(" | "),
              )
              .join(" / ");
          else if (type === "codeBlock")
            text = (c.querySelector("code")?.textContent ?? "").replace(
              /\n/g,
              "⏎",
            );
          else text = inline(c.querySelector(".bn-inline-content"));
          const checked =
            type === "checkListItem" &&
            (c.querySelector("input") as HTMLInputElement)?.checked
              ? "☑ "
              : type === "checkListItem"
                ? "☐ "
                : "";
          const g = outer.querySelector(":scope > .bn-block > .bn-block-group");
          return [
            `${"  ".repeat(depth)}${type} ${checked}${text}`,
            ...(g ? walk(g, depth + 1) : []),
          ];
        },
      );
    return walk(document.querySelector(".bn-editor > .bn-block-group")!, 0);
  });
}

// Without PASTE_LAB_OUT this is the v2 regression suite (golden outlines); with it,
// both engines run and results + screenshots are written for review.
const ENGINES = OUT ? (["classic", "v2"] as const) : (["v2"] as const);
for (const engine of ENGINES)
  for (const c of CASES)
    test(`${engine}: ${c.id}`, async ({ page, browserName }) => {
      // Firefox hides the data of a script-made DataTransfer from paste handlers
      test.skip(
        browserName === "firefox",
        "synthetic clipboard data is empty in Firefox",
      );
      await page.addInitScript(
        (e) => localStorage.setItem("lotion-paste-engine", e),
        engine,
      );
      const before = c.before ?? [
        { id: "target", type: "paragraph", text: "" },
      ];
      await seed(
        page,
        `Paste ${c.id}`,
        before.map((b) => ({
          id: b.id,
          type: b.type,
          content: b.text ? [{ type: "text", text: b.text, styles: {} }] : [],
        })),
      );
      const cursor = c.cursor ?? { id: before[0].id, at: "end" as const };
      const target = page
        .locator(
          `[data-id="${cursor.id}"] .bn-inline-content, [data-id="${cursor.id}"] code`,
        )
        .first();
      const box = (await target.boundingBox())!;
      // click at the end (or start) of the line, then step right for an offset
      if (cursor.at === "end")
        await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
      else await page.mouse.click(box.x + 1, box.y + box.height / 2);
      if (typeof cursor.at === "number") {
        await page.waitForTimeout(100);
        for (let i = 0; i < cursor.at; i++)
          await page.keyboard.press("ArrowRight");
      }
      await page.waitForTimeout(100);
      await page.evaluate(
        ({ html, text }) => {
          const dt = new DataTransfer();
          if (html) dt.setData("text/html", html);
          dt.setData("text/plain", text);
          const el =
            document.activeElement ?? document.querySelector(".bn-editor")!;
          const event = new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          });
          // Firefox ignores clipboardData in the constructor
          if (!event.clipboardData)
            Object.defineProperty(event, "clipboardData", { value: dt });
          el.dispatchEvent(event);
        },
        { html: c.html ?? "", text: c.text },
      );
      await page.waitForTimeout(400);
      const lines = await outline(page);
      if (!OUT) {
        expect(lines).toEqual(EXPECTED[c.id]);
        return;
      }
      await page
        .locator(".editor-shell")
        .first()
        .screenshot({ path: `${OUT}/${engine}-${c.id}.png` });
      writeFileSync(
        `${OUT}/${engine}-${c.id}.json`,
        JSON.stringify({ engine, case: c.id, lines }, null, 1),
      );
    });
