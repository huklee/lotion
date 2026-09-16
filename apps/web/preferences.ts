import { readSetting } from "./storage-compat";

export type ThemeMode = "system" | "light" | "dark" | "black";
export const editorFonts = [
  "dm-sans",
  "manrope",
  "system",
  "serif",
  "monospace",
] as const;
export type EditorFont = (typeof editorFonts)[number];
export type EditorTextSize = "small" | "medium" | "large";
export type PageWidth = "comfortable" | "wide";

export function readChoice<T extends string>(
  storage: Pick<Storage, "getItem" | "setItem">,
  name: string,
  choices: readonly T[],
  fallback: T,
): T {
  const value = readSetting(storage, name);
  return choices.includes(value as T) ? (value as T) : fallback;
}

export function readBoolean(
  storage: Pick<Storage, "getItem" | "setItem">,
  name: string,
  fallback: boolean,
): boolean {
  const value = readSetting(storage, name);
  return value === "true" ? true : value === "false" ? false : fallback;
}
