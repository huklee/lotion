import { smoothScrollToElement } from "./scroll-to";

const FLASH_CLASS = "lotion-flash";
const FLASH_MS = 1700;

function blockElement(blockId: string): HTMLElement | null {
  const outer = document.querySelector<HTMLElement>(
    `.bn-block-outer[data-id="${CSS.escape(blockId)}"]`,
  );
  // highlight the block's own content, not its nested children
  return (
    outer?.querySelector<HTMLElement>(
      ":scope > .bn-block > .bn-block-content",
    ) ?? outer
  );
}

/**
 * Once the block is rendered, scroll it to the middle of the page and flash it
 * once (a short double pulse). Gives up quietly when the block no longer exists.
 * Returns a cancel function.
 */
export function flashBlockWhenRendered(
  blockId: string,
  timeoutMs = 4000,
): () => void {
  const started = performance.now();
  let frame = 0;
  let timer = 0;
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    const target = blockElement(blockId);
    if (!target) {
      if (performance.now() - started < timeoutMs)
        frame = requestAnimationFrame(tick);
      return;
    }
    void smoothScrollToElement(target, "center").then(() => {
      if (cancelled) return;
      target.classList.remove(FLASH_CLASS);
      void target.offsetWidth; // restart the animation if it was already applied
      target.classList.add(FLASH_CLASS);
      timer = window.setTimeout(
        () => target.classList.remove(FLASH_CLASS),
        FLASH_MS,
      );
    });
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
  };
}
