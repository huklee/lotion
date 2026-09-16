import { useEffect, type RefObject } from "react";
import type { LotionEditor } from "./editor.types";

export function useChecklistInteraction(
  editor: LotionEditor,
  host: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    let pending: {
      id: string;
      checked: boolean;
      scroller: HTMLElement | null;
      scrollLeft: number;
      scrollTop: number;
      windowX: number;
      windowY: number;
      pointerId: number;
      pointerX: number;
      pointerY: number;
    } | null = null;
    const checkboxAt = (event: Event) => {
      if (!host.current?.contains(event.target as Node)) return;
      const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>(
        '[data-content-type="checkListItem"] input[type="checkbox"]',
      );
      const id = checkbox?.closest<HTMLElement>(".bn-block-outer")?.dataset.id;
      return checkbox && id ? { checkbox, id } : undefined;
    };
    const rememberChecklist = (event: PointerEvent) => {
      const target = checkboxAt(event);
      if (!target) return;
      const block = editor.getBlock(target.id);
      if (block?.type !== "checkListItem") return;
      const scroller = document.querySelector<HTMLElement>(".main-scroll");
      pending = {
        id: target.id,
        checked: block.props.checked !== true,
        scroller,
        scrollLeft: scroller?.scrollLeft ?? 0,
        scrollTop: scroller?.scrollTop ?? 0,
        windowX: window.scrollX,
        windowY: window.scrollY,
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
    };
    const finishChecklist = (event: PointerEvent) => {
      if (
        !pending ||
        event.pointerId !== pending.pointerId ||
        Math.hypot(
          event.clientX - pending.pointerX,
          event.clientY - pending.pointerY,
        ) > 5
      ) {
        pending = null;
        return;
      }
      const change = pending;
      pending = null;
      const restoreScroll = () => {
        if (change.scroller) {
          change.scroller.scrollLeft = change.scrollLeft;
          change.scroller.scrollTop = change.scrollTop;
        }
        window.scrollTo(change.windowX, change.windowY);
      };
      // Run after the browser's click/change sequence so every engine lands on
      // the state captured at pointer-down exactly once.
      requestAnimationFrame(() => {
        const block = editor.getBlock(change.id);
        if (
          block?.type === "checkListItem" &&
          block.props.checked !== change.checked
        )
          editor.updateBlock(change.id, { props: { checked: change.checked } });
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
    };
    window.addEventListener("pointerdown", rememberChecklist, true);
    window.addEventListener("pointerup", finishChecklist, true);
    return () => {
      window.removeEventListener("pointerdown", rememberChecklist, true);
      window.removeEventListener("pointerup", finishChecklist, true);
    };
  }, [editor, host]);
}
