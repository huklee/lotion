import { useEffect, useState, type RefObject } from "react";
import { blockIdFromHash } from "./block-links";

export type ViewportBlockBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const outerBlocks = (host: HTMLElement) =>
  host.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]");

export function useDirectBlockLinkTarget(
  host: RefObject<HTMLDivElement | null>,
): ViewportBlockBox | null {
  const [targetBox, setTargetBox] = useState<ViewportBlockBox | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let frame = 0;
    let attempts = 0;
    let currentId: string | null = null;
    const findTarget = () =>
      currentId
        ? ([...outerBlocks(element)].find(
            (candidate) => candidate.dataset.id === currentId,
          ) ?? null)
        : null;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = findTarget();
        if (!target) {
          setTargetBox(null);
          return;
        }
        const rect = target.getBoundingClientRect();
        setTargetBox({
          id: currentId!,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      });
    };
    const reveal = () => {
      currentId = blockIdFromHash(location.hash);
      setTargetBox(null);
      attempts = 0;
      const findAndReveal = () => {
        const target = findTarget();
        if (!target && currentId && attempts++ < 20) {
          frame = requestAnimationFrame(findAndReveal);
          return;
        }
        target?.scrollIntoView({ block: "center" });
        measure();
      };
      frame = requestAnimationFrame(findAndReveal);
    };

    reveal();
    window.addEventListener("hashchange", reveal);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", reveal);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [host]);

  return targetBox;
}
