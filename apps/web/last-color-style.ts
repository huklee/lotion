import { textColors } from "./format-shortcuts";

export type AppliedColorStyle = {
  kind: "textColor" | "backgroundColor";
  color: (typeof textColors)[number];
};

export const LAST_COLOR_STYLE_KEY = "lotion-last-color-style";

export function readLastColorStyle(
  storage: Pick<Storage, "getItem">,
): AppliedColorStyle | null {
  try {
    const value: unknown = JSON.parse(
      storage.getItem(LAST_COLOR_STYLE_KEY) ?? "null",
    );
    if (!value || typeof value !== "object") return null;
    const { kind, color } = value as Record<string, unknown>;
    if (kind !== "textColor" && kind !== "backgroundColor") return null;
    if (!textColors.includes(color as AppliedColorStyle["color"])) return null;
    return { kind, color: color as AppliedColorStyle["color"] };
  } catch {
    return null;
  }
}

export function writeLastColorStyle(
  storage: Pick<Storage, "setItem">,
  style: AppliedColorStyle,
): void {
  try {
    storage.setItem(LAST_COLOR_STYLE_KEY, JSON.stringify(style));
  } catch {
    // A blocked/full browser store should not prevent applying the style now.
  }
}
