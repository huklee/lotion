import { describe, expect, it } from "vitest";
import {
  latinKey,
  matchShortcut,
  physicalKey,
  shortcutOf,
} from "../../apps/web/keyboard-layout";

it("reads shortcuts by physical key under Korean input", () => {
  expect(latinKey({ key: "ㅓ", code: "KeyJ" })).toBe("j");
  expect(latinKey({ key: "ㅏ", code: "KeyK" })).toBe("k");
  expect(latinKey({ key: "ㅎ", code: "KeyG" })).toBe("g");
  expect(latinKey({ key: "ㅑ", code: "KeyI" })).toBe("i");
  // Shift+K under 두벌식 is still ㅏ; the shortcut is ⇧K
  expect(latinKey({ key: "ㅏ", code: "KeyK", shiftKey: true })).toBe("K");
  expect(latinKey({ key: "ㅃ", code: "KeyQ", shiftKey: true })).toBe("Q");
  expect(latinKey({ key: "Process", code: "KeyF" })).toBe("f");
  expect(latinKey({ key: "Unidentified", code: "Slash", shiftKey: true })).toBe(
    "?",
  );
});

it("keeps ASCII keys and named keys as they are", () => {
  expect(latinKey({ key: "j", code: "KeyJ" })).toBe("j");
  expect(latinKey({ key: "?", code: "Slash", shiftKey: true })).toBe("?");
  expect(latinKey({ key: "/", code: "Slash" })).toBe("/");
  expect(latinKey({ key: "Enter", code: "Enter" })).toBe("Enter");
  expect(latinKey({ key: "Escape", code: "Escape" })).toBe("Escape");
  expect(latinKey({ key: "ArrowDown", code: "ArrowDown" })).toBe("ArrowDown");
  // an AZERTY "a" on the Q key stays "a": only non-ASCII keys are remapped
  expect(latinKey({ key: "a", code: "KeyQ" })).toBe("a");
});

describe("modifier shortcuts by physical key", () => {
  const ev = (init: Record<string, unknown>) => ({ key: "", ...init }) as any;
  it("names the key by its position", () => {
    expect(physicalKey(ev({ key: "ㄱ", code: "KeyR" }))).toBe("R");
    expect(physicalKey(ev({ key: "®", code: "KeyR" }))).toBe("R");
    expect(physicalKey(ev({ key: "Process", code: "KeyK" }))).toBe("K");
    expect(physicalKey(ev({ key: "@", code: "Digit2" }))).toBe("2");
    expect(physicalKey(ev({ key: "3", code: "Numpad3" }))).toBe("3");
    expect(physicalKey(ev({ key: "?", code: "Slash" }))).toBe("/");
    expect(physicalKey(ev({ key: "Enter", code: "NumpadEnter" }))).toBe(
      "Enter",
    );
    expect(physicalKey(ev({ key: "ArrowUp", code: "ArrowUp" }))).toBe(
      "ArrowUp",
    );
    // synthetic events without a code
    expect(physicalKey(ev({ key: "k" }))).toBe("K");
    expect(physicalKey(ev({ key: "Escape" }))).toBe("Escape");
  });
  it("writes the shortcut with Mod for ⌘ or Ctrl", () => {
    expect(shortcutOf(ev({ metaKey: true, key: "ㅏ", code: "KeyK" }))).toBe(
      "Mod+K",
    );
    expect(
      shortcutOf(ev({ ctrlKey: true, shiftKey: true, key: "Z", code: "KeyZ" })),
    ).toBe("Mod+Shift+Z");
    expect(
      shortcutOf(
        ev({
          altKey: true,
          shiftKey: true,
          key: "ArrowDown",
          code: "ArrowDown",
        }),
      ),
    ).toBe("Alt+Shift+ArrowDown");
  });
  it("matches exactly, by physical key, whatever the input mode", () => {
    const koreanCmdK = ev({ metaKey: true, key: "ㅏ", code: "KeyK" });
    expect(matchShortcut(koreanCmdK, "Mod+K")).toBe(true);
    expect(matchShortcut(koreanCmdK, "Mod+k")).toBe(true);
    expect(
      matchShortcut(
        ev({ ctrlKey: true, key: "Process", code: "KeyS" }),
        "Mod+S",
      ),
    ).toBe(true);
    // extra or missing modifiers do not match
    expect(
      matchShortcut(
        ev({ metaKey: true, shiftKey: true, key: "z", code: "KeyZ" }),
        "Mod+Z",
      ),
    ).toBe(false);
    expect(matchShortcut(ev({ key: "z", code: "KeyZ" }), "Mod+Z")).toBe(false);
    expect(
      matchShortcut(
        ev({ metaKey: true, key: "Enter", code: "Enter" }),
        "Mod+Enter",
      ),
    ).toBe(true);
    // any of several
    const down = ev({
      altKey: true,
      shiftKey: true,
      key: "ArrowDown",
      code: "ArrowDown",
    });
    expect(
      matchShortcut(down, "Alt+Shift+ArrowUp", "Alt+Shift+ArrowDown"),
    ).toBe(true);
    // modifier order in the spec does not matter; unknown names never match
    expect(matchShortcut(down, "Shift+Alt+ArrowDown")).toBe(true);
    expect(matchShortcut(down, "Hyper+ArrowDown")).toBe(false);
  });
});
