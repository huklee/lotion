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
  it("round-trips a combined color preset", () => {
    const storage = memoryStorage();
    writeLastColorStyle(storage, { color: "yellow" });
    expect(readLastColorStyle(storage)).toEqual({ color: "yellow" });
  });

  it("migrates a legacy single-style value to its combined preset", () => {
    const storage = memoryStorage({
      [LAST_COLOR_STYLE_KEY]: JSON.stringify({
        kind: "backgroundColor",
        color: "yellow",
      }),
    });
    expect(readLastColorStyle(storage)).toEqual({ color: "yellow" });
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
        { color: "blue" },
      ),
    ).not.toThrow();
  });
});
