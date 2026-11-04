/**
 * Single-key shortcuts by physical key, so they work whatever the keyboard
 * layout or input mode: with Korean (두벌식) input the J key reports "ㅓ" and
 * IMEs may report "Process", but `code` is still "KeyJ".
 */

const PUNCTUATION: Record<string, [string, string]> = {
  Slash: ["/", "?"],
  Period: [".", ">"],
  Comma: [",", "<"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  Backquote: ["`", "~"],
  Backslash: ["\\", "|"],
};

export type KeyLike = { key: string; code?: string; shiftKey?: boolean };

/** The key as it would read on a US layout; named keys (Enter, Escape…) stay. */
export function latinKey(event: KeyLike): string {
  const { key, code = "", shiftKey = false } = event;
  // plain ASCII characters and named keys are already what shortcuts expect
  if (key.length > 1 && key !== "Process" && key !== "Unidentified") return key;
  if (key.length === 1 && key.charCodeAt(0) < 128) return key;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return shiftKey ? letter[1] : letter[1].toLowerCase();
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit && !shiftKey) return digit[1];
  const mark = PUNCTUATION[code];
  if (mark) return mark[shiftKey ? 1 : 0];
  return key;
}

/**
 * Shortcuts with modifiers (⌘K, ⌘⇧Z, ⌥⇧↑…), by physical key as well.
 *
 * - `latinKey` (above) is for single-key commands that care about the typed
 *   character, e.g. "?" or "G" with Shift.
 * - `physicalKey` / `matchShortcut` are for modifier shortcuts: modifiers
 *   change what a key types (⌥R types "®" on a Mac, Shift+2 types "@", Korean
 *   input types "ㄱ" or "Process"), but `code` stays the same.
 */
export type ShortcutLike = KeyLike & {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
};

/**
 * The key part of a shortcut: "A"–"Z", "0"–"9", the unshifted punctuation
 * mark, or a named key ("Enter", "Escape", "ArrowUp"…). Falls back to `key`
 * when the browser gives no `code`.
 */
export function physicalKey(event: KeyLike): string {
  const { key, code = "" } = event;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (digit) return digit[1];
  if (code === "NumpadEnter") return "Enter";
  const mark = PUNCTUATION[code];
  if (mark) return mark[0];
  if (key.length > 1 && key !== "Process" && key !== "Unidentified") return key;
  return key.length === 1 ? key.toUpperCase() : key;
}

/** "Mod+Alt+Shift+K" for an event; Mod is ⌘ on a Mac and Ctrl elsewhere. */
export function shortcutOf(event: ShortcutLike): string {
  return [
    event.metaKey || event.ctrlKey ? "Mod" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    physicalKey(event),
  ]
    .filter(Boolean)
    .join("+");
}

/**
 * Whether the event is exactly one of the shortcuts, e.g.
 * `matchShortcut(event, "Mod+Z")` or `matchShortcut(event, "Alt+Shift+ArrowUp",
 * "Alt+Shift+ArrowDown")`. Modifiers must match exactly (⌘⇧Z is not ⌘Z), and
 * the key is compared case-insensitively ("Mod+k" is "Mod+K").
 */
export function matchShortcut(
  event: ShortcutLike,
  ...shortcuts: string[]
): boolean {
  const pressed = shortcutOf(event).toLowerCase();
  return shortcuts.some((shortcut) => {
    const parts = shortcut.split("+");
    const key = parts.pop() ?? "";
    const order = ["Mod", "Alt", "Shift"].filter((m) => parts.includes(m));
    if (order.length !== parts.length) return false; // unknown modifier name
    return (
      [...order, key.length === 1 ? key.toUpperCase() : key]
        .join("+")
        .toLowerCase() === pressed
    );
  });
}
