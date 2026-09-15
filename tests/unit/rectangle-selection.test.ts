import { expect, it } from "vitest";
import {
  rectangleFromPoints,
  rectanglesIntersect,
  sameSelection,
} from "../../apps/web/rectangle-selection";

it("normalizes a selection rectangle in every drag direction", () => {
  expect(rectangleFromPoints({ x: 80, y: 90 }, { x: 20, y: 30 })).toEqual({
    x: 20,
    y: 30,
    w: 60,
    h: 60,
  });
});

it("requires positive-area overlap instead of selecting touching edges", () => {
  const block = { x: 20, y: 30, w: 100, h: 40 };
  expect(rectanglesIntersect(block, { x: 10, y: 40, w: 20, h: 5 })).toBe(true);
  expect(rectanglesIntersect(block, { x: 0, y: 30, w: 20, h: 40 })).toBe(false);
});

it("compares ordered block selections without set churn", () => {
  expect(sameSelection(["a", "b"], ["a", "b"])).toBe(true);
  expect(sameSelection(["a", "b"], ["b", "a"])).toBe(false);
});
