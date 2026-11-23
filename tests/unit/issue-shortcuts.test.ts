import { describe, expect, it } from "vitest";
import {
  DEFAULT_ISSUES_SHORTCUT,
  isIssuesShortcut,
  issuesShortcutOf,
  issuesShortcutProblem,
} from "../../apps/web/issues/issue-shortcuts";

const press = (
  code: string,
  key: string,
  mods: Record<string, boolean> = {},
) => ({
  code,
  key,
  metaKey: true,
  shiftKey: true,
  ...mods,
});

describe("Open Issues shortcut", () => {
  it("the default is valid", () => {
    expect(isIssuesShortcut(DEFAULT_ISSUES_SHORTCUT)).toBe(true);
    expect(issuesShortcutProblem(DEFAULT_ISSUES_SHORTCUT, [])).toBeNull();
  });

  it("reads the physical key, with Korean input or Ctrl", () => {
    expect(issuesShortcutOf(press("KeyI", "I"))).toBe("Mod+Shift+I");
    expect(issuesShortcutOf(press("KeyI", "ㅑ"))).toBe("Mod+Shift+I");
    expect(
      issuesShortcutOf(press("KeyI", "I", { metaKey: false, ctrlKey: true })),
    ).toBe("Mod+Shift+I");
    expect(issuesShortcutOf(press("Digit1", "!"))).toBe("Mod+Shift+1");
  });

  it("needs ⌘/Ctrl and a letter or digit", () => {
    expect(issuesShortcutOf(press("KeyI", "I", { metaKey: false }))).toBeNull();
    expect(issuesShortcutOf(press("ArrowUp", "ArrowUp"))).toBeNull();
    expect(isIssuesShortcut("Shift+I")).toBe(false);
    expect(isIssuesShortcut(42)).toBe(false);
  });

  it("refuses browser, Lotion and formatting shortcuts", () => {
    expect(issuesShortcutProblem("Mod+C", [])).toMatch(/kept for/);
    expect(issuesShortcutProblem("Mod+I", [])).toMatch(/kept for/);
    expect(issuesShortcutProblem("Mod+Shift+H", ["Mod+Shift+H"])).toMatch(
      /formatting shortcut/,
    );
    expect(issuesShortcutProblem("Mod+Alt+J", ["Mod+Shift+H"])).toBeNull();
  });
});
