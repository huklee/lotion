import { describe, expect, it } from "vitest";
import {
  DEFAULT_ISSUE_SHORTCUTS,
  ISSUE_SHORTCUT_ACTIONS,
  RESERVED_SHORTCUTS,
  assignIssueShortcut,
  isIssueShortcut,
  issueShortcutAction,
  issueShortcutOf,
  parseIssueShortcuts,
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

describe("issue shortcuts", () => {
  it("defaults are valid, distinct and clear of reserved shortcuts", () => {
    const values = ISSUE_SHORTCUT_ACTIONS.map(
      (a) => DEFAULT_ISSUE_SHORTCUTS[a],
    );
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(isIssueShortcut(value)).toBe(true);
      expect(RESERVED_SHORTCUTS.has(value)).toBe(false);
    }
  });

  it("matches by physical key, also with Korean input or Ctrl", () => {
    expect(
      issueShortcutAction(press("KeyD", "D"), DEFAULT_ISSUE_SHORTCUTS),
    ).toBe("markDone");
    expect(
      issueShortcutAction(press("KeyD", "ㅇ"), DEFAULT_ISSUE_SHORTCUTS),
    ).toBe("markDone");
    expect(
      issueShortcutAction(
        press("KeyD", "D", { metaKey: false, ctrlKey: true }),
        DEFAULT_ISSUE_SHORTCUTS,
      ),
    ).toBe("markDone");
    // Shift+1 types "!" but is still the 1 key
    expect(
      issueShortcutAction(press("Digit1", "!"), DEFAULT_ISSUE_SHORTCUTS),
    ).toBe("dueDay");
  });

  it("needs ⌘/Ctrl and exact modifiers", () => {
    expect(
      issueShortcutAction(
        press("KeyD", "d", { metaKey: false }),
        DEFAULT_ISSUE_SHORTCUTS,
      ),
    ).toBeNull();
    expect(
      issueShortcutAction(
        press("KeyD", "d", { shiftKey: false }),
        DEFAULT_ISSUE_SHORTCUTS,
      ),
    ).toBeNull();
    expect(
      issueShortcutAction(
        press("KeyD", "d", { altKey: true }),
        DEFAULT_ISSUE_SHORTCUTS,
      ),
    ).toBeNull();
    expect(issueShortcutOf(press("ArrowUp", "ArrowUp"))).toBeNull();
  });

  it("assigning moves a shortcut from its previous action", () => {
    const next = assignIssueShortcut(
      DEFAULT_ISSUE_SHORTCUTS,
      "archive",
      "Mod+Shift+D",
    );
    expect(next.archive).toBe("Mod+Shift+D");
    expect(next.markDone).toBe("");
    expect(issueShortcutAction(press("KeyD", "D"), next)).toBe("archive");
    expect(issueShortcutAction(press("KeyE", "E"), next)).toBeNull();
    expect(assignIssueShortcut(next, "archive", "").archive).toBe("");
  });

  it("parsing keeps valid and cleared values, drops the rest", () => {
    const parsed = parseIssueShortcuts({
      markDone: "Mod+J",
      archive: "",
      status: "Mod+C", // reserved
      priority: "Shift+P", // no ⌘
      labels: 42,
      filter: "Mod+J", // duplicate of markDone
    });
    expect(parsed.markDone).toBe("Mod+J");
    expect(parsed.archive).toBe("");
    expect(parsed.status).toBe(DEFAULT_ISSUE_SHORTCUTS.status);
    expect(parsed.priority).toBe(DEFAULT_ISSUE_SHORTCUTS.priority);
    expect(parsed.labels).toBe(DEFAULT_ISSUE_SHORTCUTS.labels);
    expect(parsed.filter).toBe("");
    expect(parseIssueShortcuts(null)).toEqual(DEFAULT_ISSUE_SHORTCUTS);
  });
});
