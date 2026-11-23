import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { prefs, safeStorage } from "../browser-prefs";
import { physicalKey, shortcutOf, type ShortcutLike } from "../keyboard-layout";
import {
  colorPresets,
  displayShortcut,
  readFormattingShortcuts,
} from "../format-shortcuts";

/**
 * A ⌘ (Ctrl elsewhere) shortcut that opens the Issues page from anywhere,
 * also while typing (`g i` does the same outside text fields). Changeable in
 * the Control panel; a browser preference that every open tab follows.
 */
export const DEFAULT_ISSUES_SHORTCUT = "Mod+Shift+I";

/** Taken by the browser or by Lotion everywhere, so not assignable. */
export const RESERVED_SHORTCUTS = new Set([
  "Mod+A",
  "Mod+B",
  "Mod+C",
  "Mod+E",
  "Mod+F",
  "Mod+I",
  "Mod+K",
  "Mod+L",
  "Mod+N",
  "Mod+P",
  "Mod+Q",
  "Mod+R",
  "Mod+S",
  "Mod+T",
  "Mod+U",
  "Mod+V",
  "Mod+W",
  "Mod+X",
  "Mod+Z",
  "Mod+Shift+N",
  "Mod+Shift+T",
  "Mod+Shift+W",
  "Mod+Shift+Z",
]);

const pattern = /^Mod\+(?:Alt\+)?(?:Shift\+)?[A-Z0-9]$/;

export function isIssuesShortcut(value: unknown): value is string {
  return (
    typeof value === "string" &&
    pattern.test(value) &&
    !RESERVED_SHORTCUTS.has(value)
  );
}

/** The ⌘ shortcut an event spells (by physical key), or null. */
export function issuesShortcutOf(event: ShortcutLike): string | null {
  if (!event.metaKey && !event.ctrlKey) return null;
  if (!/^[A-Z0-9]$/.test(physicalKey(event))) return null;
  return shortcutOf(event);
}

/** Why a shortcut cannot be used here, or null when it can. */
export function issuesShortcutProblem(
  shortcut: string,
  formatting: string[],
): string | null {
  if (RESERVED_SHORTCUTS.has(shortcut) || !pattern.test(shortcut))
    return `${displayShortcut(shortcut)} is kept for the browser or Lotion; try adding ⇧.`;
  if (formatting.includes(shortcut))
    return `${displayShortcut(shortcut)} is a formatting shortcut; pick another or change that one first.`;
  return null;
}

const PREF = "issues-shortcut";
const CHANGED = "lotion:issues-shortcut";

/** The saved shortcut, "" when cleared, the default when missing or invalid. */
export function readIssuesShortcut(): string {
  const saved = prefs.get(PREF);
  if (saved === "" || isIssuesShortcut(saved)) return saved;
  return DEFAULT_ISSUES_SHORTCUT;
}

export function saveIssuesShortcut(shortcut: string) {
  prefs.set(PREF, shortcut);
  window.dispatchEvent(new Event(CHANGED));
}

function formattingShortcuts(): string[] {
  const f = readFormattingShortcuts(safeStorage());
  return [...colorPresets.map((c) => f.colorPresets[c]), f.repeatLast].filter(
    Boolean,
  );
}

function useIssuesShortcutValue(): string {
  const [shortcut, setShortcut] = useState(readIssuesShortcut);
  useEffect(() => {
    const sync = () => setShortcut(readIssuesShortcut());
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return shortcut;
}

/** Runs `open` when the Issues shortcut is pressed, anywhere in the app. */
export function useIssuesShortcut(open: () => void) {
  const shortcut = useIssuesShortcutValue();
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (issuesShortcutOf(event) !== shortcut) return;
      // the Control panel field that is capturing a new shortcut
      if (
        event.target instanceof Element &&
        event.target.closest("[data-shortcut-capture]")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      latest.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [shortcut]);
}

/** Control panel row: focus the field and press the new shortcut. */
export function IssuesShortcutSetting() {
  const shortcut = useIssuesShortcutValue();
  const [note, setNote] = useState("");
  const capture = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return event.currentTarget.blur();
    if (event.key === "Backspace" || event.key === "Delete") {
      setNote("");
      return saveIssuesShortcut("");
    }
    const pressed = issuesShortcutOf(event.nativeEvent);
    if (!pressed) {
      if (!["Meta", "Control", "Shift", "Alt"].includes(event.key))
        setNote("Use ⌘ (Ctrl) with a letter or digit, e.g. ⌘⇧I.");
      return;
    }
    const problem = issuesShortcutProblem(pressed, formattingShortcuts());
    setNote(problem ?? "");
    if (!problem) saveIssuesShortcut(pressed);
  };
  return (
    <>
      <div className="shortcut-settings">
        <label className="shortcut-setting">
          <span>
            Open Issues
            <small>From any page, also while typing. g i works too.</small>
          </span>
          <input
            aria-label="Open Issues shortcut"
            placeholder="Unassigned"
            readOnly
            data-shortcut-capture
            value={displayShortcut(shortcut)}
            onKeyDown={capture}
          />
        </label>
      </div>
      {note && (
        <p className="settings-description" role="status">
          {note}
        </p>
      )}
      <button
        className="settings-reset"
        onClick={() => {
          setNote("");
          saveIssuesShortcut(DEFAULT_ISSUES_SHORTCUT);
        }}
      >
        Reset Issues shortcut
      </button>
    </>
  );
}
