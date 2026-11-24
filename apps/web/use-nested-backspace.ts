import { useEffect, type RefObject } from "react";
import { handleBackspace } from "./backspace";
import type { LotionEditor } from "./editor.types";

/**
 * Backspace at the start of a nested line deletes or merges it instead of
 * lifting it (which re-parented the following lines); see backspace.ts.
 */
export function useNestedBackspace(
  editor: LotionEditor,
  host: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const key = (event: KeyboardEvent) => {
      if (
        event.key !== "Backspace" ||
        event.defaultPrevented ||
        event.isComposing ||
        event.shiftKey ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey
      )
        return;
      const target = event.target as HTMLElement;
      // only this editor's own text (not a nested feed editor or a form field)
      if (target.closest(".bn-editor") !== editor.domElement) return;
      if (target.closest("input, textarea, select")) return;
      if (handleBackspace(editor)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    element.addEventListener("keydown", key, true);
    return () => element.removeEventListener("keydown", key, true);
  }, [editor, host]);
}
