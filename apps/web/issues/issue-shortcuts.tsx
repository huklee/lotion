import { useEffect, useState, type KeyboardEvent } from "react";
import { prefs } from "../browser-prefs";
import { shortcutOf, physicalKey, type ShortcutLike } from "../keyboard-layout";
import { displayShortcut } from "../format-shortcuts";

/**
 * ⌘ (Ctrl elsewhere) shortcuts on the Issues board. Unlike the single-letter
 * board keys they also work while typing in a field (the panel's title, a
 * note…), and each can be changed in the Control panel. A browser preference:
 * every open tab follows a change at once.
 */
export const ISSUE_SHORTCUT_ACTIONS = [
  "newIssue",
  "markDone",
  "status",
  "priority",
  "labels",
  "focusNow",
  "dueDay",
  "dueWeek",
  "archive",
  "filter",
] as const;
export type IssueShortcutAction = (typeof ISSUE_SHORTCUT_ACTIONS)[number];
export type IssueShortcuts = Record<IssueShortcutAction, string>;

export const ISSUE_SHORTCUT_LABELS: Record<
  IssueShortcutAction,
  [label: string, hint: string]
> = {
  newIssue: ["New issue", "In the column of the current card (or the first)."],
  markDone: ["Mark done", "Again: back to the first column."],
  status: ["Set status", "Opens the status picker."],
  priority: ["Set priority", "Opens the priority picker."],
  labels: ["Edit labels", "Opens the label editor."],
  focusNow: ["Focus now on / off", ""],
  dueDay: ["Deadline +1d", "Without a deadline: tomorrow at 23:59."],
  dueWeek: ["Deadline +7d", "Without a deadline: in a week at 23:59."],
  archive: ["Archive / unarchive", "Undo with ⌘Z right after."],
  filter: ["Filter the board", ""],
};

/**
 * ⌘⇧ + a letter or digit: free in Chrome, Safari and Firefox on a Mac and
 * clear of Lotion's own ⌘ shortcuts (⌘K search, ⌘S, ⌘Z…).
 */
export const DEFAULT_ISSUE_SHORTCUTS: IssueShortcuts = {
  newIssue: "Mod+Shift+I",
  markDone: "Mod+Shift+D",
  status: "Mod+Shift+S",
  priority: "Mod+Shift+P",
  labels: "Mod+Shift+L",
  focusNow: "Mod+Shift+F",
  dueDay: "Mod+Shift+1",
  dueWeek: "Mod+Shift+7",
  archive: "Mod+Shift+E",
  filter: "Mod+Shift+K",
};

/** Taken by the browser or by Lotion everywhere, so not assignable here. */
export const RESERVED_SHORTCUTS = new Set([
  "Mod+A",
  "Mod+C",
  "Mod+V",
  "Mod+X",
  "Mod+Z",
  "Mod+Shift+Z",
  "Mod+K",
  "Mod+S",
  "Mod+F",
  "Mod+P",
  "Mod+R",
  "Mod+L",
  "Mod+N",
  "Mod+T",
  "Mod+W",
  "Mod+Q",
  "Mod+Enter",
  "Mod+Shift+N",
  "Mod+Shift+T",
  "Mod+Shift+W",
]);

const pattern = /^Mod\+(?:Alt\+)?(?:Shift\+)?[A-Z0-9]$/;

export function isIssueShortcut(value: unknown): value is string {
  return (
    typeof value === "string" &&
    pattern.test(value) &&
    !RESERVED_SHORTCUTS.has(value)
  );
}

/** The ⌘ shortcut an event spells, or null (no ⌘/Ctrl, or not a letter/digit). */
export function issueShortcutOf(event: ShortcutLike): string | null {
  if (!event.metaKey && !event.ctrlKey) return null;
  if (!/^[A-Z0-9]$/.test(physicalKey(event))) return null;
  return shortcutOf(event);
}

/** Saved shortcuts; unknown or invalid entries fall back to the default. */
export function parseIssueShortcuts(raw: unknown): IssueShortcuts {
  const saved =
    raw && typeof raw === "object" ? (raw as Partial<IssueShortcuts>) : {};
  const out = { ...DEFAULT_ISSUE_SHORTCUTS };
  for (const action of ISSUE_SHORTCUT_ACTIONS) {
    const value = saved[action];
    if (value === "" || isIssueShortcut(value)) out[action] = value;
  }
  // a shortcut used twice (a hand-edited value) keeps only its first action
  const seen = new Set<string>();
  for (const action of ISSUE_SHORTCUT_ACTIONS) {
    if (!out[action]) continue;
    if (seen.has(out[action])) out[action] = "";
    else seen.add(out[action]);
  }
  return out;
}

/** Give `action` the shortcut, taking it from whichever action had it. */
export function assignIssueShortcut(
  shortcuts: IssueShortcuts,
  action: IssueShortcutAction,
  shortcut: string,
): IssueShortcuts {
  const next = { ...shortcuts };
  if (shortcut)
    for (const other of ISSUE_SHORTCUT_ACTIONS)
      if (next[other] === shortcut) next[other] = "";
  next[action] = shortcut;
  return next;
}

/** The action an event triggers, if any. */
export function issueShortcutAction(
  event: ShortcutLike,
  shortcuts: IssueShortcuts,
): IssueShortcutAction | null {
  const pressed = issueShortcutOf(event);
  if (!pressed) return null;
  return ISSUE_SHORTCUT_ACTIONS.find((a) => shortcuts[a] === pressed) ?? null;
}

const PREF = "issue-shortcuts";
const CHANGED = "lotion:issue-shortcuts";

export function readIssueShortcuts(): IssueShortcuts {
  return prefs.json(PREF, { ...DEFAULT_ISSUE_SHORTCUTS }, parseIssueShortcuts);
}

export function saveIssueShortcuts(shortcuts: IssueShortcuts) {
  prefs.setJson(PREF, shortcuts);
  window.dispatchEvent(new Event(CHANGED));
}

/** The current shortcuts; follows Control panel changes in any tab. */
export function useIssueShortcuts(): IssueShortcuts {
  const [shortcuts, setShortcuts] = useState(readIssueShortcuts);
  useEffect(() => {
    const sync = () => setShortcuts(readIssueShortcuts());
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return shortcuts;
}

/** Control panel: one field per action; focus it and press the shortcut. */
export function IssueShortcutSettings() {
  const shortcuts = useIssueShortcuts();
  const [note, setNote] = useState("");
  const capture = (
    event: KeyboardEvent<HTMLInputElement>,
    action: IssueShortcutAction,
  ) => {
    if (event.key === "Tab") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return event.currentTarget.blur();
    if (event.key === "Backspace" || event.key === "Delete") {
      setNote("");
      return saveIssueShortcuts(assignIssueShortcut(shortcuts, action, ""));
    }
    const shortcut = issueShortcutOf(event.nativeEvent);
    if (!shortcut) {
      if (!["Meta", "Control", "Shift", "Alt"].includes(event.key))
        setNote("Use ⌘ (Ctrl) with a letter or digit, e.g. ⌘⇧D.");
      return;
    }
    if (RESERVED_SHORTCUTS.has(shortcut)) {
      setNote(
        `${displayShortcut(shortcut)} is kept for the browser or Lotion; try adding ⇧.`,
      );
      return;
    }
    setNote("");
    saveIssueShortcuts(assignIssueShortcut(shortcuts, action, shortcut));
  };
  return (
    <>
      <div className="shortcut-settings">
        {ISSUE_SHORTCUT_ACTIONS.map((action) => {
          const [label, hint] = ISSUE_SHORTCUT_LABELS[action];
          return (
            <label className="shortcut-setting" key={action}>
              <span>
                {label}
                {hint && <small>{hint}</small>}
              </span>
              <input
                aria-label={`${label} shortcut`}
                placeholder="Unassigned"
                readOnly
                data-shortcut-capture
                value={displayShortcut(shortcuts[action])}
                onKeyDown={(event) => capture(event, action)}
              />
            </label>
          );
        })}
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
          saveIssueShortcuts({ ...DEFAULT_ISSUE_SHORTCUTS });
        }}
      >
        Reset issue shortcuts
      </button>
    </>
  );
}
