import { describe, expect, it } from "vitest";
import {
  activeHeadingIndex,
  headingsIn,
  inlineText,
  outlineDepth,
} from "../../apps/web/document-outline";

const heading = (id: string, level: number, text: string, children = []) => ({
  id,
  type: "heading",
  props: { level },
  content: [{ type: "text", text, styles: {} }],
  children,
});

describe("document outline", () => {
  it("lists headings in document order including nested children", () => {
    const blocks = [
      heading("a", 1, "Overview"),
      {
        id: "p",
        type: "paragraph",
        content: [],
        children: [heading("b", 2, "Nested")],
      },
      heading("c", 3, "  "),
    ];
    expect(headingsIn(blocks)).toEqual([
      { id: "a", level: 1, title: "Overview" },
      { id: "b", level: 2, title: "Nested" },
      { id: "c", level: 3, title: "Untitled heading" },
    ]);
    expect(headingsIn(undefined)).toEqual([]);
  });

  it("reads mention labels and nested inline content", () => {
    expect(
      inlineText([
        { type: "text", text: "See " },
        { type: "mention", props: { label: "Runbook" } },
        { type: "link", content: [{ type: "text", text: " now" }] },
      ]),
    ).toBe("See Runbook now");
  });

  it("marks the last heading above the reading line as active", () => {
    expect(activeHeadingIndex([], 96)).toBe(-1);
    expect(activeHeadingIndex([200, 600], 96)).toBe(0); // before first heading
    expect(activeHeadingIndex([-400, 40, 500], 96)).toBe(1);
    expect(activeHeadingIndex([-900, -500, -20], 96)).toBe(2);
  });

  it("activates the last visible heading once scrolled to the end", () => {
    const end = { atBottom: true, viewportHeight: 800 };
    expect(activeHeadingIndex([-746, -294, 146], 96)).toBe(1);
    expect(activeHeadingIndex([-746, -294, 146], 96, end)).toBe(2);
    expect(activeHeadingIndex([-746, -294, 950], 96, end)).toBe(1); // below the fold
  });

  it("indents relative to the shallowest heading level", () => {
    const list = [
      { id: "x", level: 2, title: "Two" },
      { id: "y", level: 3, title: "Three" },
    ];
    expect(outlineDepth(list[0], list)).toBe(0);
    expect(outlineDepth(list[1], list)).toBe(1);
  });
});
