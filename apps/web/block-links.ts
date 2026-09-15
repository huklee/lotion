const pageHashPattern =
  /^#\/page\/([a-zA-Z0-9_-]{1,100})(?:#block=([a-zA-Z0-9_-]{1,100}))?$/;

export function pageIdFromHash(hash: string): string | null {
  return pageHashPattern.exec(hash)?.[1] ?? null;
}

export function blockIdFromHash(hash: string): string | null {
  return pageHashPattern.exec(hash)?.[2] ?? null;
}

export function pageHash(pageId: string, blockId?: string): string {
  return `#/page/${pageId}${blockId ? `#block=${blockId}` : ""}`;
}

export function directBlockUrl(
  currentUrl: string,
  pageId: string,
  blockId: string,
): string {
  const url = new URL(currentUrl);
  url.hash = pageHash(pageId, blockId);
  return url.href;
}
