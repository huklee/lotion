import { useEffect } from "react";

/**
 * While a `.modal` is open: focus its first control, keep Tab and Shift+Tab
 * inside it, and give focus back on close. `key` changes when another modal
 * opens; `returnTo` names the element to focus afterwards (default: the one
 * focused when the modal opened).
 */
export function useModalFocus(
  open: boolean,
  key: string,
  returnTo: () => HTMLElement | null = () =>
    document.activeElement as HTMLElement | null,
) {
  useEffect(() => {
    if (!open) return;
    const previous = returnTo();
    const modal = document.querySelector<HTMLElement>(".modal");
    const focusable = () =>
      [
        ...(modal?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([hidden]),select,a[href]",
        ) ?? []),
      ].filter((e) => e.offsetParent !== null);
    if (!modal?.contains(document.activeElement)) focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus();
      });
    };
    // returnTo is read once per opening, on purpose
  }, [open, key]);
}
