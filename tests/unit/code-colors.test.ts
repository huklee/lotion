import { expect, it } from "vitest";
import theme from "@shikijs/themes/github-light-high-contrast";
import { readableCodeColor } from "../../apps/web/code-colors";

it("keeps every configured syntax foreground readable on beige", () => {
  const luminance = (hex: string) =>
    hex
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const token of theme.tokenColors ?? []) {
    if (!token.settings.foreground) continue;
    const color = readableCodeColor(token.settings.foreground);
    expect(
      (luminance("#efe7d5") + 0.05) / (luminance(color) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  }
  expect(readableCodeColor("#a0111f")).toBe("#a0111f");
  expect(readableCodeColor("invalid")).toBe("#b4232d");
});
