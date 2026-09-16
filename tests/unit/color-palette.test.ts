import { describe, expect, it } from "vitest";
import { paletteColors, pastelPalettes } from "../../apps/web/color-palette";

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (first: string, second: string) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
};

describe("pastel editor color palettes", () => {
  it("keeps the established nine portable colors plus the default choice", () => {
    expect(paletteColors).toHaveLength(9);
    expect(new Set(paletteColors).size).toBe(9);
  });

  for (const [scheme, palette] of Object.entries(pastelPalettes)) {
    it(`${scheme} keeps text and background choices readable`, () => {
      for (const color of paletteColors) {
        expect(
          contrast(palette.colors[color].text, palette.canvas),
          `${color} text on ${scheme}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(palette.defaultText, palette.colors[color].background),
          `${color} background on ${scheme}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
