import type { Block, Inline } from "../document-schema/index";
import { readDatabaseState } from "../database/model";

/**
 * Lotion blocks → Confluence wiki markup (`h2. Title`, `*bold*`, `* item`,
 * `{code}`, `{expand}`, `{info}` …), and a renderer for the same markup so a
 * preview shows exactly what the markup says. Fixed rules only, no AI.
 *
 * Wiki markup has no highlight: background colours are dropped; text colours
 * become `{color:name}`. A checked to-do is `(/)` (Confluence's tick icon), an
 * open one `( )`.
 */

export type WikiOptions = {
  /** Base for Lotion's own `#/page/…` links (e.g. "https://host/"). */
  linkBase?: string;
};

const CODE_LANGUAGES = new Set([
  "actionscript3",
  "applescript",
  "bash",
  "c#",
  "cpp",
  "css",
  "coldfusion",
  "delphi",
  "diff",
  "erl",
  "groovy",
  "html",
  "xml",
  "java",
  "javafx",
  "js",
  "javascript",
  "json",
  "perl",
  "php",
  "powershell",
  "python",
  "ruby",
  "sass",
  "scala",
  "sql",
  "swift",
  "vb",
  "yaml",
  "go",
  "kotlin",
  "typescript",
]);
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  "c++": "cpp",
  csharp: "c#",
  yml: "yaml",
};
function codeLanguage(lang: unknown): string | null {
  const raw = String(lang ?? "")
    .trim()
    .toLowerCase();
  const mapped = LANGUAGE_ALIASES[raw] ?? raw;
  return CODE_LANGUAGES.has(mapped) ? mapped : null;
}

// ---- markup ---------------------------------------------------------------

/** Characters wiki markup reads as formatting, escaped with a backslash. */
const ALWAYS = /[\\{}[\]|!*_+^~]/g;

function escapeText(text: string): string {
  let out = text.replace(ALWAYS, (c) => `\\${c}`);
  // a hyphen can start or end strike-through (-text-) next to a word
  out = out.replace(/(^|\s)-(?=\S)|(?<=\S)-(?=\s|$)/g, (m) =>
    m.replace("-", "\\-"),
  );
  // at the start of a line: lists (#), headings (h1.), quotes (bq.)
  return out.replace(/^(#|h[1-6]\.|bq\.)/gm, (m) => `\\${m}`);
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/** Wrap with a formatting mark, using the {*} form when touching a word. */
function mark(
  text: string,
  sign: string,
  before: string | undefined,
  after: string | undefined,
): string {
  const tight = isWordChar(before) || isWordChar(after);
  return tight ? `{${sign}}${text}{${sign}}` : `${sign}${text}${sign}`;
}

function resolveHref(href: string, options: WikiOptions): string {
  if (href.startsWith("#/") && options.linkBase)
    return options.linkBase.replace(/\/?$/, "/") + href;
  return href;
}

function linkMarkup(label: string, href: string): string {
  const safeLabel = label.replace(/[|\]\\]/g, (c) => `\\${c}`);
  return safeLabel && safeLabel !== href
    ? `[${safeLabel}|${href}]`
    : `[${href}]`;
}

type Piece = { text: string; raw: string };

function inlineMarkup(content: unknown, options: WikiOptions): string {
  if (!Array.isArray(content)) return "";
  const pieces: Piece[] = (content as Inline[]).map((item) => {
    if (item.type === "link") {
      const label = (item.content ?? []).map((c) => c.text ?? "").join("");
      return {
        text: label,
        raw: linkMarkup(label, resolveHref(String(item.href ?? ""), options)),
      };
    }
    if (item.type === "mention") {
      const props = item.props ?? {};
      const label = String(props.label ?? "");
      if (props.kind === "date") return { text: label, raw: escapeText(label) };
      return {
        text: label,
        raw: linkMarkup(label, resolveHref(String(props.href ?? ""), options)),
      };
    }
    return { text: item.text ?? "", raw: "" };
  });
  return (content as Inline[])
    .map((item, i) => {
      if (pieces[i].raw) return pieces[i].raw;
      const text = item.text ?? "";
      if (!text) return "";
      const styles = item.styles ?? {};
      if (styles.code) {
        const code = text.replace(/[{}]/g, (c) => `\\${c}`);
        return `{{${code}}}`;
      }
      // spaces stay outside the marks (`*bold *` would not format)
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
      if (!core) return text;
      const before = lead ? " " : pieces[i - 1]?.text.slice(-1);
      const after = trail ? " " : pieces[i + 1]?.text.slice(0, 1);
      let out = escapeText(core);
      if (styles.bold) out = mark(out, "*", before, after);
      if (styles.italic) out = mark(out, "_", before, after);
      if (styles.underline) out = mark(out, "+", before, after);
      if (styles.strike) out = mark(out, "-", before, after);
      const color = styles.textColor;
      if (typeof color === "string" && color !== "default")
        out = `{color:${color}}${out}{color}`;
      return lead + out + trail;
    })
    .join("");
}

const LIST_SIGN: Record<string, string> = {
  bulletListItem: "*",
  toggleListItem: "*",
  checkListItem: "*",
  numberedListItem: "#",
};

function tableMarkup(rows: string[][]): string {
  return rows
    .map((cells, r) => {
      const sep = r === 0 ? "||" : "|";
      return sep + cells.map((c) => c || " ").join(sep) + sep;
    })
    .join("\n");
}

/** One block (and its nested blocks) as markup lines; lists keep their prefix. */
function blockMarkup(
  block: Block,
  options: WikiOptions,
  prefix = "",
): string[] {
  const props = (block.props ?? {}) as Record<string, any>;
  const text = () => inlineMarkup(block.content, options);
  const children = block.children ?? [];
  const sign = LIST_SIGN[block.type];
  if (sign || prefix) {
    // inside a list everything stays a list item (Confluence has no other way)
    const own = prefix + (sign ?? "*");
    const tick =
      block.type === "checkListItem" ? (props.checked ? "(/) " : "( ) ") : "";
    const line = `${own} ${tick}${sign || block.type === "paragraph" || block.type === "heading" ? text() : blockMarkup(block, options).join(" ")}`;
    return [line, ...children.flatMap((c) => blockMarkup(c, options, own))];
  }
  const nested = children.length
    ? ["", ...joinBlocks(children, options).split("\n")]
    : [];
  switch (block.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(props.level) || 1));
      return [`h${level}. ${text()}`, ...nested];
    }
    case "paragraph":
      return [text(), ...nested];
    case "quote":
      return ["{quote}", text(), ...nested.slice(1), "{quote}"];
    case "callout":
      return ["{info}", text(), ...nested.slice(1), "{info}"];
    case "codeBlock": {
      const code = ((block.content as Inline[] | undefined) ?? [])
        .map((i) => i.text ?? "")
        .join("");
      const lang = codeLanguage(props.language);
      return [
        `{code${lang ? `:language=${lang}` : ""}}`,
        ...code.split("\n"),
        "{code}",
      ];
    }
    case "mermaid":
      return [
        "{code:title=Mermaid}",
        ...String(props.code ?? "").split("\n"),
        "{code}",
      ];
    case "image": {
      const url = String(props.url ?? "");
      const caption = String(props.caption ?? "");
      return url ? [`!${url}!`, ...(caption ? [escapeText(caption)] : [])] : [];
    }
    case "file":
    case "video":
    case "audio":
      return [
        linkMarkup(String(props.name ?? block.type), String(props.url ?? "")),
      ];
    case "divider":
      return ["----"];
    case "tableOfContents":
      return ["{toc}"];
    case "table": {
      const rows = ((block.content as any)?.rows ?? []).map((row: any) =>
        row.cells.map((cell: any) =>
          inlineMarkup(cell.content ?? cell, options).replace(/\n/g, " "),
        ),
      );
      return rows.length ? [tableMarkup(rows)] : [];
    }
    case "database": {
      try {
        const db = readDatabaseState(props.columns, props.rows);
        const rows = [
          ["Page", ...db.columns.map((c) => escapeText(c.name))],
          ...db.rows.map((row: any) => [
            escapeText(String(row.title ?? "")),
            ...db.columns.map((c) =>
              escapeText(String(row.values?.[c.id] ?? "")),
            ),
          ]),
        ];
        return [tableMarkup(rows)];
      } catch {
        return [];
      }
    }
    default:
      return [text(), ...nested];
  }
}

const isList = (b: Block) => !!LIST_SIGN[b.type];

/** Blocks as markup: list items on consecutive lines, other blocks a blank line apart. */
export function joinBlocks(blocks: Block[], options: WikiOptions = {}): string {
  const out: string[] = [];
  blocks.forEach((block, i) => {
    const lines = blockMarkup(block, options);
    if (!lines.length || (lines.length === 1 && !lines[0].trim())) return;
    if (out.length)
      out.push(isList(block) && isList(blocks[i - 1]) ? "\n" : "\n\n");
    out.push(lines.join("\n"));
  });
  return out.join("");
}

// ---- rendering ------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHref(url: string): string {
  return /^(https?:|mailto:|#|\/)/i.test(url) ? url : "#";
}

const ICONS: Record<string, string> = {
  "(/)": '<span class="cf-icon cf-tick" aria-label="done">✓</span>',
  "(x)": '<span class="cf-icon cf-cross" aria-label="no">✕</span>',
  "(i)": '<span class="cf-icon cf-info-icon" aria-label="info">i</span>',
  "(!)": '<span class="cf-icon cf-warn" aria-label="warning">!</span>',
};

/** Inline wiki markup → HTML (the subset `joinBlocks` writes). */
export function renderInline(markup: string): string {
  const escaped: string[] = [];
  const hold = (html: string) => `\uE000${escaped.push(html) - 1}\uE000`;
  // backslash escapes first: the character is plain text
  let s = markup.replace(/\\([\s\S])/g, (_, c) => hold(escapeHtml(c)));
  s = s.replace(/\{\{([\s\S]*?)\}\}/g, (_, code) =>
    hold(
      `<code>${escapeHtml(code.replace(/\uE000(\d+)\uE000/g, (_m: string, n: string) => escaped[Number(n)]))}</code>`,
    ),
  );
  s = s.replace(
    /\[([^\]|]*)\|([^\]]+)\]|\[([^\]|]+)\]/g,
    (_, label, url, bare) => {
      const href = (url ?? bare).trim();
      return hold(
        `<a href="${escapeHtml(safeHref(href))}">${escapeHtml(label ?? bare)}</a>`,
      );
    },
  );
  s = s.replace(/!([^!\s][^!]*)!/g, (_, url) =>
    hold(`<img src="${escapeHtml(safeHref(url))}" alt="" />`),
  );
  s = escapeHtml(s);
  s = s.replace(/\(\/\)|\(x\)|\(i\)|\(!\)/g, (m) => ICONS[m]);
  const wrap = (sign: string, tag: string) => {
    const e = sign.replace(/[*+^]/g, (c) => `\\${c}`);
    s = s.replace(
      new RegExp(`\\{${e}\\}([\\s\\S]+?)\\{${e}\\}`, "g"),
      `<${tag}>$1</${tag}>`,
    );
    s = s.replace(
      new RegExp(
        `(^|[^\\p{L}\\p{N}])${e}(?=\\S)([\\s\\S]*?\\S)${e}(?![\\p{L}\\p{N}])`,
        "gu",
      ),
      `$1<${tag}>$2</${tag}>`,
    );
  };
  wrap("*", "strong");
  wrap("_", "em");
  wrap("+", "u");
  wrap("-", "s");
  s = s.replace(
    /\{color:([#\w]+)\}([\s\S]*?)\{color\}/g,
    (_, color, text) =>
      `<span style="color:${/^#?[\w]+$/.test(color) ? color : "inherit"}">${text}</span>`,
  );
  return s.replace(/\uE000(\d+)\uE000/g, (_, n) => escaped[Number(n)]);
}

const MACRO_START =
  /^\{(expand|info|note|warning|tip|panel|quote)(?::([^}]*))?\}\s*$/;

function macroTitle(name: string, params: string | undefined): string {
  if (!params) return "";
  if (name === "expand" && !params.includes("=")) return params.trim();
  const title = /(?:^|\|)title=([^|]*)/.exec(params);
  return title ? title[1].trim() : "";
}

/** Wiki markup → HTML (the subset `joinBlocks` and the wiki view write). */
export function renderWikiMarkup(markup: string): string {
  const lines = markup.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;

  function parse(until?: string): string {
    const out: string[] = [];
    let para: string[] = [];
    const flushPara = () => {
      if (para.length)
        out.push(`<p>${para.map(renderInline).join("<br />")}</p>`);
      para = [];
    };
    while (i < lines.length) {
      const line = lines[i];
      if (until && line.trim() === `{${until}}`) {
        i++;
        break;
      }
      const heading = /^h([1-6])\.\s+(.*)$/.exec(line);
      const macro = MACRO_START.exec(line.trim());
      const code = /^\{code(?::([^}]*))?\}\s*$/.exec(line.trim());
      if (!line.trim()) {
        flushPara();
        i++;
      } else if (heading) {
        flushPara();
        out.push(
          `<h${heading[1]}>${renderInline(heading[2])}</h${heading[1]}>`,
        );
        i++;
      } else if (code) {
        flushPara();
        i++;
        const body: string[] = [];
        while (i < lines.length && lines[i].trim() !== "{code}")
          body.push(lines[i++]);
        i++;
        const title = /(?:^|\|)title=([^|]*)/.exec(code[1] ?? "")?.[1];
        out.push(
          `<div class="cf-code">${title ? `<div class="cf-code-title">${escapeHtml(title)}</div>` : ""}<pre><code>${escapeHtml(body.join("\n"))}</code></pre></div>`,
        );
      } else if (macro) {
        flushPara();
        i++;
        const [, name, params] = macro;
        const inner = parse(name);
        const title = escapeHtml(macroTitle(name, params));
        if (name === "quote") out.push(`<blockquote>${inner}</blockquote>`);
        else if (name === "expand")
          out.push(
            `<div class="cf-expand"><div class="cf-expand-title">${title || "Click here to expand..."}</div><div class="cf-macro-body">${inner}</div></div>`,
          );
        else
          out.push(
            `<div class="cf-panel cf-${name}">${title ? `<div class="cf-panel-title">${title}</div>` : ""}<div class="cf-macro-body">${inner}</div></div>`,
          );
      } else if (line.trim() === "{toc}") {
        flushPara();
        out.push('<div class="cf-toc">Table of contents</div>');
        i++;
      } else if (/^-{4,}\s*$/.test(line)) {
        flushPara();
        out.push("<hr />");
        i++;
      } else if (/^\|/.test(line)) {
        flushPara();
        const rows: string[] = [];
        while (i < lines.length && /^\|/.test(lines[i])) {
          const row = lines[i++];
          const header = row.startsWith("||");
          const cells = row
            .replace(header ? /^\|\||\|\|\s*$/g : /^\||\|\s*$/g, "")
            .split(header ? "||" : "|");
          const tag = header ? "th" : "td";
          rows.push(
            `<tr>${cells.map((c) => `<${tag}>${renderInline(c.trim())}</${tag}>`).join("")}</tr>`,
          );
        }
        out.push(`<table><tbody>${rows.join("")}</tbody></table>`);
      } else if (/^[*#]+\s/.test(line)) {
        flushPara();
        const items: { signs: string; html: string }[] = [];
        while (i < lines.length && /^[*#]+\s/.test(lines[i])) {
          const [, signs, text] = /^([*#]+)\s(.*)$/.exec(lines[i++])!;
          items.push({ signs, html: renderInline(text) });
        }
        out.push(renderList(items));
      } else {
        para.push(line);
        i++;
      }
    }
    flushPara();
    return out.join("");
  }
  return parse();
}

function renderList(items: { signs: string; html: string }[]): string {
  let html = "";
  const open: string[] = []; // sign per open list level
  for (const { signs, html: text } of items) {
    // close levels that no longer match
    while (
      open.length &&
      (open.length > signs.length ||
        open[open.length - 1] !== signs[open.length - 1])
    ) {
      html += `</li></${open.pop() === "#" ? "ol" : "ul"}>`;
    }
    if (open.length === signs.length) html += "</li>";
    while (open.length < signs.length) {
      const sign = signs[open.length];
      html += `<${sign === "#" ? "ol" : "ul"}>`;
      open.push(sign);
      if (open.length < signs.length) html += "<li>";
    }
    html += `<li>${text}`;
  }
  while (open.length) html += `</li></${open.pop() === "#" ? "ol" : "ul"}>`;
  return html;
}
