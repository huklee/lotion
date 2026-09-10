import type { Content } from "../../packages/document-schema/index";

const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = Object.keys(a),
    right = Object.keys(b);
  return (
    left.length === right.length &&
    left.every(
      (key) => Object.hasOwn(b, key) && equal((a as any)[key], (b as any)[key]),
    )
  );
};
export const sameContent = (a: Content, b: Content) => equal(a, b);
export function mergeContent(
  base: Content | undefined,
  local: Content,
  remote: Content,
): { content: Content; conflicts: string[] } {
  const conflicts: string[] = [];
  function merge(original: any, mine: any, theirs: any, path: string): any {
    if (equal(mine, theirs)) return mine;
    if (base && equal(mine, original)) return theirs;
    if (base && equal(theirs, original)) return mine;
    if (
      base &&
      path === "blocks" &&
      Array.isArray(original) &&
      Array.isArray(mine) &&
      Array.isArray(theirs)
    ) {
      // Merge edits by stable block ID only when both retain the original order.
      const ids = (blocks: any[]) => blocks.map((b) => b.id);
      if (equal(ids(original), ids(mine)) && equal(ids(original), ids(theirs)))
        return original.map((b: any, i: number) =>
          merge(b, mine[i], theirs[i], `block ${b.id}`),
        );
    }
    conflicts.push(path);
    return mine;
  }
  const content = Object.fromEntries(
    ["title", "icon", "blocks", "linkPreviews"].map((key) => [
      key,
      merge(
        (base as any)?.[key],
        (local as any)[key],
        (remote as any)[key],
        key,
      ),
    ]),
  ) as Content;
  return { content, conflicts };
}
