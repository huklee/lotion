import { useMemo } from "react";
import type { TreeNode } from "../../packages/document-schema/index";

/**
 * Links to pages in the Trash are marked wherever a page is shown (main
 * editor, meeting feeds, inline row editors): the title is struck through and
 * an "In Trash" badge follows it. The documents themselves are not changed, so
 * a link looks normal again as soon as its page is restored.
 *
 * Done with one generated stylesheet keyed by page id. It covers page mention
 * chips and plain links alike, and every link form: `#/page/<id>`,
 * `#/page/<id>#block=…`, and absolute `https://…/#/page/<id>` URLs.
 */
// inside a quoted attribute value only `"` and `\` need escaping
const quoted = (value: string) => value.replace(/["\\]/g, "\\$&");

export function trashedLinkCss(ids: readonly string[]): string {
  if (!ids.length) return "";
  const links = ids.map((id) => `.bn-editor a[href*="#/page/${quoted(id)}"]`);
  const all = (suffix: string) => links.map((l) => l + suffix).join(",\n");
  return `${all("")} {
  opacity: 0.7;
}
${all(":not(.lotion-mention)")},
${all(".lotion-mention > span:not(.lotion-mention-icon)")} {
  text-decoration: line-through;
}
${all("::after")} {
  content: "In Trash";
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--muted);
  font-size: 0.75em;
  font-weight: 500;
  line-height: 1.5;
  text-decoration: none;
  vertical-align: 0.1em;
}`;
}

/** The stylesheet for every page currently in the Trash. */
export function TrashedLinkStyles({ pages }: { pages: readonly TreeNode[] }) {
  const css = useMemo(
    () =>
      trashedLinkCss(
        pages.filter((page) => page.deletedAt).map((page) => page.id),
      ),
    [pages],
  );
  return css ? <style data-lotion-trashed-links="">{css}</style> : null;
}
