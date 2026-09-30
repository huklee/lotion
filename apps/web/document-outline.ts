/**
 * Pure document-outline helpers shared by the inline `/toc` block and the
 * right-hand outline panel. No React, DOM or editor dependencies.
 */

export type OutlineHeading = { id: string; level: number; title: string };

/** Plain text of BlockNote inline content, including mention labels. */
export function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      if ("text" in item && typeof item.text === "string") return item.text;
      if (
        "props" in item &&
        item.props &&
        typeof item.props === "object" &&
        "label" in item.props &&
        typeof item.props.label === "string"
      )
        return item.props.label;
      if ("content" in item) return inlineText(item.content);
      return "";
    })
    .join("");
}

type OutlineBlock = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: readonly OutlineBlock[];
};

/** Headings in document order, including headings nested in child blocks. */
export function headingsIn(
  blocks: readonly OutlineBlock[] | undefined,
): OutlineHeading[] {
  return (blocks ?? []).flatMap((block) => [
    ...(block.type === "heading"
      ? [
          {
            id: block.id,
            level: Number(block.props?.level) || 1,
            title: inlineText(block.content).trim() || "Untitled heading",
          },
        ]
      : []),
    ...headingsIn(block.children),
  ]);
}

/**
 * The heading the reader is currently in: the last heading whose top edge is
 * at or above the reading line. Before the first heading, the first one.
 * `tops` are top offsets relative to the scroll container, in document order.
 *
 * When the container is scrolled to the end, headings of short final sections
 * can never reach the reading line, so the last heading visible in the
 * viewport becomes active instead.
 */
export function activeHeadingIndex(
  tops: readonly number[],
  readingLine: number,
  end?: { atBottom: boolean; viewportHeight: number },
): number {
  if (!tops.length) return -1;
  let active = 0;
  tops.forEach((top, index) => {
    if (top <= readingLine) active = index;
  });
  if (end?.atBottom) {
    tops.forEach((top, index) => {
      if (top < end.viewportHeight && index > active) active = index;
    });
  }
  return active;
}

/** Indentation relative to the shallowest heading level on the page. */
export function outlineDepth(
  heading: OutlineHeading,
  headings: readonly OutlineHeading[],
): number {
  const shallowest = Math.min(...headings.map((item) => item.level));
  return Math.max(0, heading.level - shallowest);
}
