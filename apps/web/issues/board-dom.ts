/**
 * Browser helpers for the issue board's keyboard use: whether a key belongs
 * to a text field or a dialog, and the on-screen controls that hints (f) can
 * reach.
 */

/** Whether keys typed at `target` go into a text field. */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Whether a modal dialog is open (it owns the keyboard). */
export const modalOpen = () =>
  !!document.querySelector('[role="dialog"][aria-modal="true"]');

export type HintControl = { el: HTMLElement; left: number; top: number };

/** Buttons, links and fields of the issue view that are on screen now. */
export function visibleControls(): HintControl[] {
  const root = document.querySelector(".issues-view");
  if (!root) return [];
  return [
    ...root.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, textarea, [role='button']",
    ),
  ]
    .filter((el) => {
      if (el.closest(".issue-card") || (el as HTMLButtonElement).disabled)
        return false;
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.right > 0 &&
        r.top < window.innerHeight &&
        r.left < window.innerWidth
      );
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { el, left: r.left, top: r.top };
    });
}

/** What choosing a hint does: fields get focus (a select opens), others click. */
export function activate(el: HTMLElement | undefined) {
  if (!el) return;
  if (el instanceof HTMLSelectElement) {
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      // showPicker needs a user gesture in some browsers; focus is enough
    }
    return;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    return;
  }
  el.click();
}
