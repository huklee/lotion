import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { Block } from "../../packages/document-schema/index";
import { removeBlocksPreservingHierarchy } from "../../packages/editor-adapter/movement";
import { editorSchema } from "./editor-schema";
import {
  rectangleFromPoints,
  rectanglesIntersect,
  sameSelection,
  type SelectionRectangle,
} from "./rectangle-selection";
import type { ViewportBlockBox } from "./editor-overlays.types";

type LotionEditor = typeof editorSchema.BlockNoteEditor;
type ReplacementBlocks = Parameters<LotionEditor["replaceBlocks"]>[1];

type UseBlockSelectionOptions = {
  editor: LotionEditor;
  host: RefObject<HTMLDivElement | null>;
  pasteLoading: boolean;
};

const outerBlocks = (host: HTMLElement) =>
  host.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]");

const ownBlockRectangle = (outer: HTMLElement) =>
  (
    outer.querySelector<HTMLElement>(
      ":scope > .bn-block > .bn-block-content",
    ) ?? outer
  ).getBoundingClientRect();

export function useBlockSelection({
  editor,
  host,
  pasteLoading,
}: UseBlockSelectionOptions) {
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedBoxes, setSelectedBoxes] = useState<ViewportBlockBox[]>([]);
  const [rectangle, setRectangle] = useState<SelectionRectangle | null>(null);
  const rectangleClick = useRef(false);

  useEffect(() => {
    if (!selected.length) return;
    const outside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setSelected([]);
    };
    const removeSelection = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key !== "Backspace" ||
        pasteLoading ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest("input, textarea, select") ||
        (target !== document.body && !host.current?.contains(target))
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const current = editor.document as unknown as Block[];
      const next = removeBlocksPreservingHierarchy(current, selected);
      if (next !== current) {
        const replacement = (next.length
          ? next
          : [{ type: "paragraph" }]) as unknown as ReplacementBlocks;
        editor.replaceBlocks(editor.document, replacement);
      }
      setSelected([]);
      editor.focus();
    };
    window.addEventListener("keydown", removeSelection, true);
    window.addEventListener("pointerdown", outside, true);
    return () => {
      window.removeEventListener("keydown", removeSelection, true);
      window.removeEventListener("pointerdown", outside, true);
    };
  }, [editor, host, pasteLoading, selected]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const drag = (event: DragEvent) => {
      event.dataTransfer?.setData(
        "application/lotion-blocks",
        JSON.stringify(selected),
      );
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    };
    const sync = () => {
      for (const block of outerBlocks(element)) {
        const active = selected.includes(block.dataset.id!);
        block.removeEventListener("dragstart", drag);
        if (active) {
          block.draggable = true;
          block.addEventListener("dragstart", drag);
        } else block.removeAttribute("draggable");
      }
    };
    sync();
    const firstFrame = requestAnimationFrame(() => {
      sync();
      secondFrame = requestAnimationFrame(sync);
    });
    let secondFrame = 0;
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      for (const block of outerBlocks(element)) {
        block.removeEventListener("dragstart", drag);
        block.removeAttribute("draggable");
      }
    };
  }, [host, selected]);

  useEffect(() => {
    const element = host.current;
    if (!element || !selected.length) {
      setSelectedBoxes([]);
      return;
    }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSelectedBoxes(
          [...outerBlocks(element)]
            .filter((block) => selected.includes(block.dataset.id!))
            .map((block) => {
              const rect = block.getBoundingClientRect();
              return {
                id: block.dataset.id!,
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              };
            }),
        );
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [host, selected]);

  const startRectangle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      event.button !== 0 ||
      target.closest("button, a, input, select, textarea, [draggable=true]")
    )
      return;
    const start = { x: event.clientX, y: event.clientY };
    const startedInText = !!target.closest(
      ".bn-inline-content, [contenteditable=true]",
    );
    const startBlockId = target.closest<HTMLElement>(".bn-block-outer[data-id]")
      ?.dataset.id;
    const pointerId = event.pointerId;
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const baseSelection = additive ? selected : [];
    const scroller = document.querySelector<HTMLElement>(".main-scroll");
    const startDocumentY = start.y + (scroller?.scrollTop ?? 0);
    let lastPoint = start;
    let active = false;
    let autoScrollFrame = 0;
    const update = (point: { x: number; y: number }) => {
      lastPoint = point;
      const scrollTop = scroller?.scrollTop ?? 0;
      setRectangle(
        rectangleFromPoints(
          { x: start.x, y: startDocumentY - scrollTop },
          point,
        ),
      );
      const documentBox = rectangleFromPoints(
        { x: start.x, y: startDocumentY },
        { x: point.x, y: point.y + scrollTop },
      );
      const elements = host.current ? [...outerBlocks(host.current)] : [];
      const rawHits = elements.filter((element) => {
        const rect = ownBlockRectangle(element);
        return rectanglesIntersect(documentBox, {
          x: rect.x,
          y: rect.y + scrollTop,
          w: rect.width,
          h: rect.height,
        });
      });
      const hitElements = new Set(rawHits);
      const hits = rawHits
        .filter((element) => {
          let parent = element.parentElement?.closest<HTMLElement>(
            ".bn-block-outer[data-id]",
          );
          while (parent) {
            if (hitElements.has(parent)) return false;
            parent = parent.parentElement?.closest<HTMLElement>(
              ".bn-block-outer[data-id]",
            );
          }
          return true;
        })
        .map((element) => element.dataset.id!);
      const next = additive ? [...new Set([...baseSelection, ...hits])] : hits;
      setSelected((current) => (sameSelection(current, next) ? current : next));
    };
    const autoScroll = () => {
      if (!active || !scroller) return;
      const bounds = scroller.getBoundingClientRect();
      const edge = 48;
      const topDistance = lastPoint.y - bounds.top;
      const bottomDistance = bounds.bottom - lastPoint.y;
      const speed =
        topDistance < edge
          ? -Math.ceil((edge - topDistance) / 3)
          : bottomDistance < edge
            ? Math.ceil((edge - bottomDistance) / 3)
            : 0;
      if (speed) {
        const before = scroller.scrollTop;
        scroller.scrollTop += Math.max(-18, Math.min(18, speed));
        if (scroller.scrollTop !== before) update(lastPoint);
      }
      autoScrollFrame = requestAnimationFrame(autoScroll);
    };
    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (
        !active &&
        Math.hypot(
          pointerEvent.clientX - start.x,
          pointerEvent.clientY - start.y,
        ) < 5
      )
        return;
      if (!active && startedInText && startBlockId) {
        const currentBlockId = document
          .elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
          ?.closest<HTMLElement>(".bn-block-outer[data-id]")?.dataset.id;
        if (currentBlockId === startBlockId) return;
      }
      if (!active) {
        active = true;
        rectangleClick.current = true;
        autoScrollFrame = requestAnimationFrame(autoScroll);
      }
      pointerEvent.preventDefault();
      window.getSelection()?.removeAllRanges();
      update({ x: pointerEvent.clientX, y: pointerEvent.clientY });
    };
    const end = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      setRectangle(null);
      cancelAnimationFrame(autoScrollFrame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return {
    rectangle,
    rectangleClick,
    selected,
    selectedBoxes,
    setSelected,
    startRectangle,
  };
}
