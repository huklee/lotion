/**
 * Bounded smooth scrolling for table-of-contents jumps.
 *
 * Native `scrollIntoView({ behavior: "smooth" })` takes longer the farther it
 * goes and keeps chasing a target that moves while blocks below it render, so
 * a long jump could drag on. Here the page accelerates, cruises and decelerates
 * within a duration that grows with distance but never exceeds
 * `MAX_SCROLL_MS`, and the target is re-measured every frame so layout shifts
 * cannot extend the animation.
 */

export const MIN_SCROLL_MS = 180;
export const MAX_SCROLL_MS = 650;

/** Duration for a jump of `distance` pixels: short hops are quick, long ones are capped. */
export function scrollDuration(distance: number): number {
  const d = Math.abs(distance);
  if (d < 1) return 0;
  return Math.round(Math.min(MAX_SCROLL_MS, MIN_SCROLL_MS + 9 * Math.sqrt(d)));
}

/** Ease in-out (cubic): accelerate for the first half, decelerate for the second. */
export function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export type ScrollAlign = "start" | "center";

/** Scroll offset that places `element` at the top (or centre) of `scroller`, clamped to the scroll range. */
export function scrollTargetFor(
  scroller: HTMLElement,
  element: HTMLElement,
  align: ScrollAlign,
): number {
  const box = element.getBoundingClientRect();
  const frame = scroller.getBoundingClientRect();
  let top = box.top - frame.top + scroller.scrollTop;
  if (align === "center") top -= (scroller.clientHeight - box.height) / 2;
  const max = scroller.scrollHeight - scroller.clientHeight;
  return Math.max(0, Math.min(max, Math.round(top)));
}

let cancelCurrent: (() => void) | null = null;

/**
 * Animate `scroller` to `element`. A new jump replaces one in progress; wheel,
 * touch, pointer or key input stops it where it is. Users who prefer reduced
 * motion jump instantly. Resolves when the scroll has settled.
 */
export function smoothScrollToElement(
  element: HTMLElement,
  align: ScrollAlign = "start",
  scroller: HTMLElement | null = document.querySelector<HTMLElement>(
    ".main-scroll",
  ),
): Promise<void> {
  cancelCurrent?.();
  if (!scroller) {
    element.scrollIntoView({ block: align });
    return Promise.resolve();
  }
  const from = scroller.scrollTop;
  const initialTarget = scrollTargetFor(scroller, element, align);
  const duration = scrollDuration(initialTarget - from);
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!duration || reduced) {
    scroller.scrollTop = initialTarget;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let frame = 0;
    const startedAt = performance.now();
    const interruptions = ["wheel", "touchstart", "pointerdown", "keydown"];
    const finish = () => {
      cancelAnimationFrame(frame);
      interruptions.forEach((type) =>
        scroller.removeEventListener(type, stop, true),
      );
      if (cancelCurrent === stop) cancelCurrent = null;
      resolve();
    };
    const stop = () => finish();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      // Re-measure so content rendering in mid-flight cannot move the goal
      // past the end of the animation.
      const target = scrollTargetFor(scroller, element, align);
      scroller.scrollTop = from + (target - from) * easeInOutCubic(t);
      if (t < 1) frame = requestAnimationFrame(step);
      else finish();
    };
    interruptions.forEach((type) =>
      scroller.addEventListener(type, stop, { capture: true, passive: true }),
    );
    cancelCurrent = stop;
    frame = requestAnimationFrame(step);
  });
}
