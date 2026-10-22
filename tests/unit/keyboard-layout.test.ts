import { expect, it } from "vitest";
import { latinKey } from "../../apps/web/keyboard-layout";

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
