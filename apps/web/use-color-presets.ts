import { useCallback, useRef } from "react";
import { safeStorage } from "./browser-prefs";
import {
  colorShortcutAction,
  type FormattingShortcuts,
} from "./format-shortcuts";
import {
  readLastColorStyle,
  writeLastColorStyle,
  type AppliedColorPreset,
} from "./last-color-style";
import type { LotionEditor } from "./editor.types";

/**
 * The combined text + background colour presets in the editor: applying one,
 * remembering the last one for this tab (shared across pages and reloads),
 * and the keyboard shortcuts set in the Control panel.
 */
export function useColorPresets(
  editor: LotionEditor,
  shortcuts: FormattingShortcuts,
) {
  const last = useRef<AppliedColorPreset | null>(
    readLastColorStyle(safeStorage("session")),
  );
  const remember = useCallback((style: AppliedColorPreset) => {
    last.current = style;
    writeLastColorStyle(safeStorage("session"), style);
  }, []);
  const apply = useCallback(
    (style: AppliedColorPreset) => {
      if (style.color === "default")
        editor.removeStyles({
          textColor: style.color,
          backgroundColor: style.color,
        });
      else
        editor.addStyles({
          textColor: style.color,
          backgroundColor: style.color,
        });
      remember(style);
    },
    [editor, remember],
  );
  /** Apply a colour shortcut; true when the key was one. */
  const handleKey = (event: KeyboardEvent): boolean => {
    const action = colorShortcutAction(event, shortcuts, !!last.current);
    if (!action) return false;
    apply(action.type === "preset" ? { color: action.color } : last.current!);
    return true;
  };
  return { remember, handleKey };
}
