import { describe, expect, it } from "vitest";
import { trashedLinkCss } from "../../apps/web/trashed-links";

describe("links to pages in the Trash", () => {
  it("has no rules when nothing is in the Trash", () => {
    expect(trashedLinkCss([])).toBe("");
  });
  it("marks mention chips and plain links to each trashed page, in every link form", () => {
    const css = trashedLinkCss(["a1b2", "c3d4"]);
    for (const id of ["a1b2", "c3d4"]) {
      // contains-match covers #/page/<id>, #/page/<id>#block=… and absolute URLs
      expect(css).toContain(`.bn-editor a[href*="#/page/${id}"]`);
      expect(css).toContain(`.bn-editor a[href*="#/page/${id}"]::after`);
      expect(css).toContain(
        `.bn-editor a[href*="#/page/${id}"]:not(.lotion-mention)`,
      );
      expect(css).toContain(
        `.bn-editor a[href*="#/page/${id}"].lotion-mention > span:not(.lotion-mention-icon)`,
      );
    }
    expect(css).toContain('content: "In Trash"');
    expect(css).toContain("text-decoration: line-through");
  });
  it("escapes ids so a stored value cannot break out of the selector", () => {
    const css = trashedLinkCss(['x"] body{display:none} a[href="']);
    expect(css).toContain(
      'a[href*="#/page/x\\"] body{display:none} a[href=\\""]',
    );
  });
});
