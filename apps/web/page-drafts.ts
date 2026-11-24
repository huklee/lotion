/**
 * Unsaved page drafts before an operation that rewrites pages on the server
 * (move, duplicate…): save them first, and refuse if any is still unsaved
 * (a conflict, an offline save). Pure apart from the drafts it is given.
 */
export type Draft = { status: string; flush(): Promise<unknown> };

/**
 * Save the drafts of `ids` (missing drafts are fine) and throw `message` when
 * one of them is still not saved afterwards.
 */
export async function saveDraftsOrThrow(
  drafts: ReadonlyMap<string, Draft>,
  ids: readonly string[],
  message: string,
): Promise<void> {
  for (const id of ids) await drafts.get(id)?.flush();
  if (ids.some((id) => drafts.has(id) && drafts.get(id)!.status !== "Saved"))
    throw new Error(message);
}

/** The set without `id` (a new Set, for React state). */
export function without<T>(set: ReadonlySet<T>, id: T): Set<T> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
