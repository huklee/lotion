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
