import { describe, expect, it } from "vitest";
import {
  easeInOutCubic,
  MAX_SCROLL_MS,
  MIN_SCROLL_MS,
  scrollDuration,
} from "../../apps/web/scroll-to";

describe("table-of-contents scroll timing", () => {
  it("grows with distance but never exceeds the cap", () => {
    expect(scrollDuration(0)).toBe(0);
    expect(scrollDuration(0.4)).toBe(0);
    const distances = [10, 100, 500, 1_000, 2_500, 5_000, 20_000, 1_000_000];
    const durations = distances.map(scrollDuration);
    durations.forEach((ms) => {
      expect(ms).toBeGreaterThanOrEqual(MIN_SCROLL_MS);
      expect(ms).toBeLessThanOrEqual(MAX_SCROLL_MS);
    });
    for (let i = 1; i < durations.length; i++)
      expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1]);
    // very long pages hit the same bounded time
    expect(scrollDuration(20_000)).toBe(MAX_SCROLL_MS);
    expect(scrollDuration(1_000_000)).toBe(MAX_SCROLL_MS);
    // direction does not matter
    expect(scrollDuration(-1_200)).toBe(scrollDuration(1_200));
  });

  it("accelerates then decelerates and lands exactly on the target", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    // symmetric about the midpoint
    for (const t of [0.1, 0.25, 0.4])
      expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1);
    // speed rises during the first half and falls during the second
    const speed = (t: number) =>
      (easeInOutCubic(t + 0.01) - easeInOutCubic(t)) / 0.01;
    expect(speed(0.1)).toBeLessThan(speed(0.3));
    expect(speed(0.3)).toBeLessThan(speed(0.48));
    expect(speed(0.6)).toBeGreaterThan(speed(0.8));
    expect(speed(0.8)).toBeGreaterThan(speed(0.95));
  });
});
