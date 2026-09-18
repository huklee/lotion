import { colorPresets, type ColorPreset } from "./format-shortcuts";

export type AppliedColorPreset = { color: ColorPreset };

export const LAST_COLOR_STYLE_KEY = "lotion-last-color-style";

export function readLastColorStyle(
  storage: Pick<Storage, "getItem">,
): AppliedColorPreset | null {
  try {
    const value: unknown = JSON.parse(
      storage.getItem(LAST_COLOR_STYLE_KEY) ?? "null",
    );
    if (!value || typeof value !== "object") return null;
    const { kind, color } = value as Record<string, unknown>;
    if (
      kind !== undefined &&
      kind !== "textColor" &&
      kind !== "backgroundColor"
    )
      return null;
    if (!colorPresets.includes(color as ColorPreset)) return null;
    return { color: color as ColorPreset };
  } catch {
    return null;
  }
}

export function writeLastColorStyle(
  storage: Pick<Storage, "setItem">,
  style: AppliedColorPreset,
): void {
  try {
    storage.setItem(LAST_COLOR_STYLE_KEY, JSON.stringify(style));
  } catch {
    // A blocked/full browser store should not prevent applying the style now.
  }
}
