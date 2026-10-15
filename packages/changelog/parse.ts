export type Release = {
  version: string;
  date: string;
  /** Pull request number that shipped the release, when recorded. */
  pr?: number;
  /** Markdown body of the release section (without its heading). */
  body: string;
};

const heading =
  /^## (\d+\.\d+\.\d+)(?:\s+—\s+([^·\n]+?))?(?:\s+·\s+\[#(\d+)\]\([^)]*\))?\s*$/;

/** Releases of `docs/changelog.md`, in file order (newest first). */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let current: Release | null = null;
  const lines: string[] = [];
  const close = () => {
    if (current) releases.push({ ...current, body: lines.join("\n").trim() });
    lines.length = 0;
  };
  for (const line of markdown.split("\n")) {
    const match = heading.exec(line);
    if (match) {
      close();
      current = {
        version: match[1],
        date: (match[2] ?? "").trim(),
        ...(match[3] ? { pr: Number(match[3]) } : {}),
        body: "",
      };
    } else if (line.startsWith("## ")) {
      close();
      current = null;
    } else if (current) lines.push(line);
  }
  close();
  return releases;
}

/** -1, 0 or 1 comparing semantic versions "a.b.c". */
export function compareVersions(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  }
  return 0;
}

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

/** Minimal inline Markdown used by the changelog: **bold**, `code`, [text](href). */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last)
      out.push({ kind: "text", text: text.slice(last, match.index) });
    if (match[1] !== undefined) out.push({ kind: "strong", text: match[1] });
    else if (match[2] !== undefined) out.push({ kind: "code", text: match[2] });
    else out.push({ kind: "link", text: match[3], href: match[4] });
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export type BodyBlock =
  | { kind: "heading"; text: string }
  | { kind: "item"; text: string; depth: number }
  | { kind: "paragraph"; text: string };

/** Headings (###), list items (with nesting) and paragraphs of a release body. */
export function parseBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const raw of body.split("\n")) {
    if (!raw.trim()) continue;
    const item = /^(\s*)[-*] (.*)$/.exec(raw);
    if (raw.startsWith("### "))
      blocks.push({ kind: "heading", text: raw.slice(4).trim() });
    else if (item)
      blocks.push({
        kind: "item",
        text: item[2],
        depth: Math.floor(item[1].length / 2),
      });
    else {
      const previous = blocks[blocks.length - 1];
      // a wrapped continuation line joins the block before it
      if (previous && previous.kind !== "heading" && /^\s+/.test(raw))
        previous.text += ` ${raw.trim()}`;
      else blocks.push({ kind: "paragraph", text: raw.trim() });
    }
  }
  return blocks;
}

/** Only same-site relative links and https links are followed from the panel. */
export function safeHref(href: string, base: string): string | null {
  if (/^https:\/\//.test(href)) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  return `${base}${href.replace(/^\.\//, "")}`;
}
