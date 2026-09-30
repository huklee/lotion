import { useEffect, useMemo, useState } from "react";
import type { Block } from "../../packages/document-schema/index";
import {
  activeHeadingIndex,
  headingsIn,
  outlineDepth,
} from "./document-outline";

const READING_LINE_PX = 96;

function headingElement(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.bn-block-outer[data-id="${CSS.escape(id)}"]`,
  );
}

/**
 * Right-hand table of contents rendered automatically for every page that
 * has headings. It follows live edits and highlights the section in view.
 */
export function DocumentOutline({ blocks }: { blocks: readonly Block[] }) {
  const headings = useMemo(() => headingsIn(blocks), [blocks]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!headings.length) return;
    const scroller = document.querySelector<HTMLElement>(".main-scroll");
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scroller?.getBoundingClientRect().top ?? 0;
      const tops = headings.map(
        (heading) =>
          (headingElement(heading.id)?.getBoundingClientRect().top ??
            Number.POSITIVE_INFINITY) - top,
      );
      const atBottom =
        !!scroller &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      const index = activeHeadingIndex(tops, READING_LINE_PX, {
        atBottom,
        viewportHeight: scroller?.clientHeight ?? window.innerHeight,
      });
      setActiveId(index >= 0 ? headings[index].id : null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [headings]);

  if (!headings.length) return null;
  return (
    <aside className="document-outline" aria-label="Page outline">
      <div className="document-outline-title">On this page</div>
      <nav>
        {headings.map((heading) => (
          <button
            key={heading.id}
            type="button"
            className={heading.id === activeId ? "active" : undefined}
            aria-current={heading.id === activeId ? "location" : undefined}
            style={{
              paddingLeft: `${8 + outlineDepth(heading, headings) * 12}px`,
            }}
            title={heading.title}
            onClick={() => {
              headingElement(heading.id)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
              setActiveId(heading.id);
            }}
          >
            {heading.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
