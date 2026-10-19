import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

/**
 * Markdown → Confluence, with fixed rules only (no AI).
 *
 * `storage` is Confluence's storage format: the XHTML Confluence keeps for a page,
 * with `ac:` macros for code blocks, task lists, the table of contents and images.
 * It is what the REST API and source editors take.
 * `html` is plain HTML in the same structure that pastes cleanly into the
 * Confluence editor and is used for the in-app preview.
 */

const parser = unified().use(remarkParse).use(remarkGfm);

export type ConfluenceOutput = { storage: string; html: string };
type Mode = "storage" | "html";

/** Code languages Confluence's code macro knows (others become "none"). */
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
  "py",
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
  "ts",
  "shell",
  "sh",
  "text",
  "none",
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
  text: "none",
  plaintext: "none",
  txt: "none",
};

function escapeText(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(text: string) {
  return escapeText(text).replace(/"/g, "&quot;");
}
/** CDATA cannot contain "]]>": split it across two sections. */
function cdata(text: string) {
  return `<![CDATA[${text.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}
function safeHref(url: string) {
  return /^(https?:|mailto:|#|\/)/i.test(url) ? url : "#";
}

function codeLanguage(lang: string | null | undefined) {
  const raw = (lang ?? "").trim().toLowerCase();
  const mapped = LANGUAGE_ALIASES[raw] ?? raw;
  return CODE_LANGUAGES.has(mapped) ? mapped : "none";
}

function inline(nodes: any[], mode: Mode): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return escapeText(n.value);
        case "strong":
          return `<strong>${inline(n.children, mode)}</strong>`;
        case "emphasis":
          return `<em>${inline(n.children, mode)}</em>`;
        case "delete":
          return `<s>${inline(n.children, mode)}</s>`;
        case "inlineCode":
          return `<code>${escapeText(n.value)}</code>`;
        case "break":
          return "<br />";
        case "link":
          return `<a href="${escapeAttr(safeHref(n.url))}">${inline(n.children, mode)}</a>`;
        case "image":
          return mode === "storage"
            ? `<ac:image${n.alt ? ` ac:alt="${escapeAttr(n.alt)}"` : ""}><ri:url ri:value="${escapeAttr(n.url)}" /></ac:image>`
            : `<img src="${escapeAttr(n.url)}" alt="${escapeAttr(n.alt ?? "")}" />`;
        case "html":
          return escapeText(n.value);
        default:
          return n.children
            ? inline(n.children, mode)
            : escapeText(n.value ?? "");
      }
    })
    .join("");
}

/** A list item's content: a lone paragraph stays inline (Confluence's own shape). */
function itemBody(
  children: any[],
  mode: Mode,
  counter: { task: number },
): string {
  if (children.length === 1 && children[0].type === "paragraph")
    return inline(children[0].children, mode);
  return children
    .map((c, i) =>
      c.type === "paragraph" && i === 0
        ? inline(c.children, mode)
        : block(c, mode, counter),
    )
    .join("");
}

function list(node: any, mode: Mode, counter: { task: number }): string {
  // a Markdown list can mix task and plain items: render each run on its own
  const isTask = (li: any) => typeof li.checked === "boolean";
  const runs: any[][] = [];
  for (const li of node.children) {
    const run = runs[runs.length - 1];
    if (run && isTask(run[0]) === isTask(li)) run.push(li);
    else runs.push([li]);
  }
  if (runs.length > 1)
    return runs
      .map((items, i) =>
        list(
          {
            ...node,
            children: items,
            start: node.ordered
              ? (node.start ?? 1) +
                runs.slice(0, i).reduce((n, r) => n + r.length, 0)
              : node.start,
          },
          mode,
          counter,
        ),
      )
      .join("");
  const tasks = node.children.every(isTask);
  if (tasks) {
    if (mode === "storage")
      return `<ac:task-list>${node.children
        .map(
          (li: any) =>
            `<ac:task><ac:task-id>${++counter.task}</ac:task-id><ac:task-status>${li.checked ? "complete" : "incomplete"}</ac:task-status><ac:task-body>${itemBody(li.children, mode, counter)}</ac:task-body></ac:task>`,
        )
        .join("")}</ac:task-list>`;
    return `<ul class="task-list">${node.children
      .map(
        (li: any) =>
          `<li><input type="checkbox" disabled${li.checked ? " checked" : ""} /> ${itemBody(li.children, mode, counter)}</li>`,
      )
      .join("")}</ul>`;
  }
  const tag = node.ordered ? "ol" : "ul";
  const start =
    node.ordered && node.start && node.start !== 1
      ? ` start="${node.start}"`
      : "";
  return `<${tag}${start}>${node.children
    .map((li: any) => `<li>${itemBody(li.children, mode, counter)}</li>`)
    .join("")}</${tag}>`;
}

function table(node: any, mode: Mode): string {
  const align = node.align ?? [];
  const rows = node.children
    .map((row: any, r: number) => {
      const cells = row.children
        .map((cell: any, c: number) => {
          const tag = r === 0 ? "th" : "td";
          const style = align[c] ? ` style="text-align: ${align[c]};"` : "";
          return `<${tag}${style}>${inline(cell.children, mode) || (mode === "storage" ? "<br />" : "")}</${tag}>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table><tbody>${rows}</tbody></table>`;
}

function code(node: any, mode: Mode): string {
  const isMermaid = (node.lang ?? "").toLowerCase() === "mermaid";
  const language = isMermaid ? "none" : codeLanguage(node.lang);
  if (mode === "storage")
    return `<ac:structured-macro ac:name="code" ac:schema-version="1">${
      isMermaid ? `<ac:parameter ac:name="title">Mermaid</ac:parameter>` : ""
    }<ac:parameter ac:name="language">${language}</ac:parameter><ac:plain-text-body>${cdata(node.value)}</ac:plain-text-body></ac:structured-macro>`;
  return `<div class="code-panel">${isMermaid ? '<div class="code-title">Mermaid</div>' : ""}<pre><code${language !== "none" ? ` data-language="${language}"` : ""}>${escapeText(node.value)}</code></pre></div>`;
}

function block(node: any, mode: Mode, counter: { task: number }): string {
  switch (node.type) {
    case "heading":
      return `<h${node.depth}>${inline(node.children, mode)}</h${node.depth}>`;
    case "paragraph":
      return `<p>${inline(node.children, mode)}</p>`;
    case "list":
      return list(node, mode, counter);
    case "code":
      return code(node, mode);
    case "blockquote":
      return `<blockquote>${node.children.map((c: any) => block(c, mode, counter)).join("")}</blockquote>`;
    case "table":
      return table(node, mode);
    case "thematicBreak":
      return "<hr />";
    case "html": {
      if (/<!--\s*(lotion|yestion):table-of-contents\s*-->/.test(node.value))
        return mode === "storage"
          ? `<ac:structured-macro ac:name="toc" ac:schema-version="1" />`
          : `<div class="toc-macro">Table of contents</div>`;
      // other raw HTML is shown as text, never passed through
      return `<p>${escapeText(node.value)}</p>`;
    }
    default:
      return node.children
        ? `<p>${inline(node.children, mode)}</p>`
        : `<p>${escapeText(node.value ?? "")}</p>`;
  }
}

export function markdownToConfluence(markdown: string): ConfluenceOutput {
  const tree: any = parser.parse(markdown);
  const render = (mode: Mode) => {
    const counter = { task: 0 };
    return tree.children.map((n: any) => block(n, mode, counter)).join("\n");
  };
  return { storage: render("storage"), html: render("html") };
}
