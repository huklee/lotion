import { describe, expect, it } from "vitest";
import {
  LAST_COLOR_STYLE_KEY,
  readLastColorStyle,
  writeLastColorStyle,
} from "../../apps/web/last-color-style";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("session-wide last color style", () => {
  it("round-trips text and background styles", () => {
    const storage = memoryStorage();
    writeLastColorStyle(storage, { kind: "backgroundColor", color: "yellow" });
    expect(readLastColorStyle(storage)).toEqual({
      kind: "backgroundColor",
      color: "yellow",
    });
  });

  it("rejects malformed, unknown-kind, and unknown-color values", () => {
    for (const value of [
      "not-json",
      JSON.stringify({ kind: "font", color: "red" }),
      JSON.stringify({ kind: "textColor", color: "neon" }),
    ]) {
      const storage = memoryStorage({ [LAST_COLOR_STYLE_KEY]: value });
      expect(readLastColorStyle(storage)).toBeNull();
    }
  });

  it("does not block formatting when session storage rejects writes", () => {
    expect(() =>
      writeLastColorStyle(
        {
          setItem: () => {
            throw new Error("storage unavailable");
          },
        },
        { kind: "textColor", color: "blue" },
      ),
    ).not.toThrow();
  });
});
