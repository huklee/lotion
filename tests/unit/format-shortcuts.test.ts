import { expect, it } from "vitest";
import {
  assignFormattingShortcut,
  matchesFormattingShortcut,
  readFormattingShortcuts,
  shortcutFromKeyboardEvent,
} from "../../apps/web/format-shortcuts";

function memoryStorage(value?: string) {
  const values = new Map<string, string>();
  if (value !== undefined) values.set("lotion-formatting-shortcuts", value);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => values.set(key, next),
  };
}

it("normalizes portable modifier shortcuts and matches Ctrl or Command", () => {
  const event = {
    altKey: false,
    ctrlKey: true,
    key: "r",
    metaKey: false,
    shiftKey: true,
  };
  expect(shortcutFromKeyboardEvent(event)).toBe("Mod+Shift+R");
  expect(matchesFormattingShortcut(event, "Mod+Shift+R")).toBe(true);
  expect(shortcutFromKeyboardEvent({ ...event, ctrlKey: false })).toBeNull();
});

it("validates stored settings and falls back for malformed values", () => {
  const settings = readFormattingShortcuts(
    memoryStorage(
      JSON.stringify({
        textColors: { red: "Mod+Shift+R", blue: "plain-b" },
        repeatLast: "invalid",
      }),
    ),
  );
  expect(settings.colorPresets.red).toBe("Mod+Shift+R");
  expect(settings.colorPresets.blue).toBe("");
  expect(settings.repeatLast).toBe("Mod+Shift+H");
  expect(readFormattingShortcuts(memoryStorage("{"))).toEqual(
    expect.objectContaining({ repeatLast: "Mod+Shift+H" }),
  );
});

it("keeps each shortcut unique when an assignment changes", () => {
  const settings = readFormattingShortcuts(memoryStorage());
  const red = assignFormattingShortcut(settings, "red", "Mod+Shift+H");
  expect(red.colorPresets.red).toBe("Mod+Shift+H");
  expect(red.repeatLast).toBe("");
  const repeated = assignFormattingShortcut(red, "repeatLast", "Mod+Shift+H");
  expect(repeated.colorPresets.red).toBe("");
  expect(repeated.repeatLast).toBe("Mod+Shift+H");
});

it("records and matches by physical key on Mac Option, Shift+digit, Korean input and the numpad", () => {
  const mod = { metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };
  // ⌥R on a Mac types "®"
  expect(
    shortcutFromKeyboardEvent({ ...mod, altKey: true, key: "®", code: "KeyR" }),
  ).toBe("Mod+Alt+R");
  // Shift+2 types "@"
  expect(
    shortcutFromKeyboardEvent({
      ...mod,
      shiftKey: true,
      key: "@",
      code: "Digit2",
    }),
  ).toBe("Mod+Shift+2");
  // Korean (두벌식) input types "ㄱ" for R, or "Process" while composing
  expect(shortcutFromKeyboardEvent({ ...mod, key: "ㄱ", code: "KeyR" })).toBe(
    "Mod+R",
  );
  expect(
    shortcutFromKeyboardEvent({ ...mod, key: "Process", code: "KeyR" }),
  ).toBe("Mod+R");
  expect(shortcutFromKeyboardEvent({ ...mod, key: "3", code: "Numpad3" })).toBe(
    "Mod+3",
  );
  // without a code (old browsers, synthetic events) the key still works
  expect(shortcutFromKeyboardEvent({ ...mod, key: "b" })).toBe("Mod+B");
  // keys that are not letters, digits or Enter are not shortcuts
  expect(
    shortcutFromKeyboardEvent({ ...mod, key: "/", code: "Slash" }),
  ).toBeNull();
  expect(
    matchesFormattingShortcut(
      { ...mod, altKey: true, key: "ㅔ", code: "KeyP" },
      "Mod+Alt+P",
    ),
  ).toBe(true);
});
