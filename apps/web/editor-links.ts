import { blockIdFromHash, pageIdFromHash } from "./block-links";

/**
 * Where a link clicked in the editor goes. Pure: the current page URL is
 * passed in, so it is tested without a browser.
 */
export type LinkTarget =
  | { type: "block"; hash: string }
  | { type: "page"; id: string }
  | { type: "external" };

/** The Lotion page a link points to (same origin only), or null. */
export function pageIdFromHref(href: string, base: string): string | null {
  const direct = pageIdFromHash(href);
  if (direct) return direct;
  try {
    const url = new URL(href, base);
    if (url.origin !== new URL(base).origin) return null;
    return pageIdFromHash(url.hash);
  } catch {
    return null;
  }
}

/** A block link opens via the hash, a page link opens the page, else leave. */
export function linkTarget(href: string, base: string): LinkTarget {
  const id = pageIdFromHref(href, base);
  if (!id) return { type: "external" };
  let hash = "";
  try {
    hash = new URL(href, base).hash;
  } catch {
    // keep "" (no block)
  }
  return blockIdFromHash(hash) ? { type: "block", hash } : { type: "page", id };
}
