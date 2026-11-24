import { describe, expect, it } from "vitest";
import { linkTarget, pageIdFromHref } from "../../apps/web/editor-links";
import {
  colorShortcutAction,
  defaultFormattingShortcuts,
} from "../../apps/web/format-shortcuts";

const base = "https://lotion.example/app/#/page/current";

describe("editor links", () => {
  it("finds the page of hash, relative and same-origin links", () => {
    expect(pageIdFromHref("#/page/abc", base)).toBe("abc");
    expect(pageIdFromHref("https://lotion.example/app/#/page/abc", base)).toBe(
      "abc",
    );
    expect(
      pageIdFromHref("https://elsewhere.example/#/page/abc", base),
    ).toBeNull();
    expect(pageIdFromHref("https://example.com/docs", base)).toBeNull();
  });

  it("routes block links by hash, page links to the page, others out", () => {
    expect(linkTarget("#/page/abc", base)).toEqual({ type: "page", id: "abc" });
    expect(linkTarget("https://example.com/", base)).toEqual({
      type: "external",
    });
    expect(linkTarget("#/page/abc#block=b1", base)).toEqual({
      type: "block",
      hash: "#/page/abc#block=b1",
    });
    expect(
      linkTarget("https://lotion.example/app/#/page/abc#block=b1", base),
    ).toEqual({ type: "block", hash: "#/page/abc#block=b1" });
  });
});

describe("colour shortcuts", () => {
  const press = (code: string, mods: Partial<KeyboardEvent> = {}) =>
    ({
      key: code.slice(-1),
      code,
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
      ...mods,
    }) as KeyboardEvent;
  const shortcuts = {
    ...defaultFormattingShortcuts,
    colorPresets: {
      ...defaultFormattingShortcuts.colorPresets,
      red: "Mod+Alt+R",
    },
  };

  it("applies a preset by its shortcut", () => {
    expect(
      colorShortcutAction(
        press("KeyR", { shiftKey: false, altKey: true }),
        shortcuts,
        false,
      ),
    ).toEqual({ type: "preset", color: "red" });
  });

  it("repeats the last preset only when there is one", () => {
    expect(colorShortcutAction(press("KeyH"), shortcuts, true)).toEqual({
      type: "repeat",
    });
    expect(colorShortcutAction(press("KeyH"), shortcuts, false)).toBeNull();
    expect(colorShortcutAction(press("KeyQ"), shortcuts, true)).toBeNull();
  });
});
