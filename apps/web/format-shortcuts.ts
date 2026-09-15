import { readSetting } from "./storage-compat";

export const textColors = [
  "default",
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;

export type TextColor = (typeof textColors)[number];
export type FormattingShortcutTarget = TextColor | "repeatLast";
export type FormattingShortcuts = {
  textColors: Record<TextColor, string>;
  repeatLast: string;
};

export const defaultFormattingShortcuts: FormattingShortcuts = {
  textColors: Object.fromEntries(
    textColors.map((color) => [color, ""]),
  ) as Record<TextColor, string>,
  repeatLast: "Mod+Shift+H",
};

const shortcutPattern =
  /^(?=.*(?:Mod|Alt)\+)(?:Mod\+)?(?:Alt\+)?(?:Shift\+)?(?:[A-Z0-9]|Enter)$/;

export function isFormattingShortcut(value: unknown): value is string {
  return typeof value === "string" && shortcutPattern.test(value);
}

export function readFormattingShortcuts(
  storage: Pick<Storage, "getItem" | "setItem">,
): FormattingShortcuts {
  try {
    const saved: unknown = JSON.parse(
      readSetting(storage, "formatting-shortcuts") ?? "{}",
    );
    const source =
      saved && typeof saved === "object"
        ? (saved as Partial<FormattingShortcuts>)
        : {};
    const savedColors =
      source.textColors && typeof source.textColors === "object"
        ? source.textColors
        : ({} as Partial<Record<TextColor, unknown>>);
    return {
      textColors: Object.fromEntries(
        textColors.map((color) => {
          const value = savedColors[color];
          return [
            color,
            value === "" || isFormattingShortcut(value) ? value : "",
          ];
        }),
      ) as Record<TextColor, string>,
      repeatLast: isFormattingShortcut(source.repeatLast)
        ? source.repeatLast
        : defaultFormattingShortcuts.repeatLast,
    };
  } catch {
    return structuredClone(defaultFormattingShortcuts);
  }
}

export function shortcutFromKeyboardEvent(
  event: Pick<
    KeyboardEvent,
    "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
  >,
): string | null {
  if (!event.metaKey && !event.ctrlKey && !event.altKey) return null;
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (!/^[A-Z0-9]$/.test(key) && key !== "Enter") return null;
  return [
    event.metaKey || event.ctrlKey ? "Mod" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    key,
  ]
    .filter(Boolean)
    .join("+");
}

export function matchesFormattingShortcut(
  event: Pick<
    KeyboardEvent,
    "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
  >,
  shortcut: string,
): boolean {
  return shortcut !== "" && shortcutFromKeyboardEvent(event) === shortcut;
}

export function assignFormattingShortcut(
  settings: FormattingShortcuts,
  target: FormattingShortcutTarget,
  shortcut: string,
): FormattingShortcuts {
  const next = structuredClone(settings);
  if (shortcut) {
    for (const color of textColors)
      if (next.textColors[color] === shortcut) next.textColors[color] = "";
    if (next.repeatLast === shortcut) next.repeatLast = "";
  }
  if (target === "repeatLast") next.repeatLast = shortcut;
  else next.textColors[target] = shortcut;
  return next;
}

export function displayShortcut(shortcut: string): string {
  return shortcut
    .replace("Mod", navigator.platform.includes("Mac") ? "⌘" : "Ctrl")
    .replace("Alt", navigator.platform.includes("Mac") ? "⌥" : "Alt")
    .replace("Shift", "⇧")
    .replaceAll("+", " ");
}
