import { readSetting } from "./storage-compat";
import { paletteColors } from "./color-palette";

export const colorPresets = ["default", ...paletteColors] as const;

export type ColorPreset = (typeof colorPresets)[number];
export type FormattingShortcutTarget = ColorPreset | "repeatLast";
export type FormattingShortcuts = {
  colorPresets: Record<ColorPreset, string>;
  repeatLast: string;
};

export const defaultFormattingShortcuts: FormattingShortcuts = {
  colorPresets: Object.fromEntries(
    colorPresets.map((color) => [color, ""]),
  ) as Record<ColorPreset, string>,
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
    const legacySource = source as Partial<FormattingShortcuts> & {
      textColors?: Partial<Record<ColorPreset, unknown>>;
    };
    const savedColors =
      source.colorPresets && typeof source.colorPresets === "object"
        ? source.colorPresets
        : legacySource.textColors && typeof legacySource.textColors === "object"
          ? legacySource.textColors
          : ({} as Partial<Record<ColorPreset, unknown>>);
    return {
      colorPresets: Object.fromEntries(
        colorPresets.map((color) => {
          const value = savedColors[color];
          return [
            color,
            value === "" || isFormattingShortcut(value) ? value : "",
          ];
        }),
      ) as Record<ColorPreset, string>,
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
    for (const color of colorPresets)
      if (next.colorPresets[color] === shortcut) next.colorPresets[color] = "";
    if (next.repeatLast === shortcut) next.repeatLast = "";
  }
  if (target === "repeatLast") next.repeatLast = shortcut;
  else next.colorPresets[target] = shortcut;
  return next;
}

export function displayShortcut(shortcut: string): string {
  return shortcut
    .replace("Mod", navigator.platform.includes("Mac") ? "⌘" : "Ctrl")
    .replace("Alt", navigator.platform.includes("Mac") ? "⌥" : "Alt")
    .replace("Shift", "⇧")
    .replaceAll("+", " ");
}
