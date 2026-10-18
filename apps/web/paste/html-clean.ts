/**
 * Clipboard HTML → clean, semantic HTML for BlockNote's parser (paste engine v2).
 *
 * Handles what the apps people copy from actually put on the clipboard:
 *  - Google Docs: the all-bold `<b id="docs-internal-guid…" style="font-weight:normal">`
 *    wrapper; formatting given only as inline styles; list nesting given only as
 *    `aria-level` on flat lists.
 *  - Word / Outlook: `mso-list` paragraphs with "levelN" and bullet glyph spans.
 *  - Notion: to-do lists drawn with checkbox divs.
 *  - everything: inline styles (font-weight, italic, underline, strike) become tags;
 *    then styles, classes, colours and fonts are dropped so pasted text matches the page.
 */

const SEMANTIC =
  "p,h1,h2,h3,h4,h5,h6,ul,ol,li,table,pre,blockquote,strong,b,em,i,a,code,hr,img";

/** HTML that carries structure or formatting (vs. a code editor's coloured divs). */
export function isSemanticHtml(html: string): boolean {
  if (!html) return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (doc.querySelector("[data-pm-slice], [data-content-type]")) return true;
  // VS Code & friends: monospace divs/spans with colours only
  const mono =
    /font-family:[^;"]*(menlo|monaco|consolas|courier|monospace)/i.test(html);
  if (mono && !doc.body.querySelector("p,h1,h2,h3,ul,ol,li,table"))
    return false;
  return !!doc.body.querySelector(SEMANTIC);
}

function styleOf(el: Element) {
  return (el.getAttribute("style") ?? "").toLowerCase();
}

function wrap(el: Element, tag: string) {
  const outer = el.ownerDocument.createElement(tag);
  while (el.firstChild) outer.appendChild(el.firstChild);
  el.appendChild(outer);
}

function unwrap(el: Element) {
  el.replaceWith(...Array.from(el.childNodes));
}

/** Inline-style formatting → tags (inside headings, bold is the heading's own). */
function stylesToTags(root: Element) {
  for (const el of Array.from(
    root.querySelectorAll("span, font, b, i, u, s"),
  )) {
    const style = styleOf(el);
    if (!style) continue;
    const inHeading = !!el.closest("h1,h2,h3,h4,h5,h6");
    const weight = /font-weight\s*:\s*(\w+)/.exec(style)?.[1];
    if (
      (el.tagName === "B" || el.tagName === "STRONG") &&
      weight &&
      (weight === "normal" || Number(weight) < 600)
    ) {
      unwrap(el);
      continue;
    }
    if (
      !inHeading &&
      weight &&
      (weight === "bold" || weight === "bolder" || Number(weight) >= 600)
    )
      wrap(el, "strong");
    if (/font-style\s*:\s*italic/.test(style)) wrap(el, "em");
    if (/text-decoration[^;]*underline/.test(style)) wrap(el, "u");
    if (/text-decoration[^;]*line-through/.test(style)) wrap(el, "s");
  }
}

/** Flat lists with `aria-level` (Google Docs) → properly nested lists. */
function nestByAriaLevel(root: Element) {
  const doc = root.ownerDocument;
  const lists = Array.from(root.querySelectorAll("ul, ol")).filter(
    (list) =>
      !list.parentElement?.closest("ul, ol") &&
      list.querySelector(":scope > li[aria-level]"),
  );
  // consecutive top-level lists form one run (Docs starts a new <ul> per level)
  const runs: Element[][] = [];
  for (const list of lists) {
    const run = runs[runs.length - 1];
    let prev = list.previousElementSibling;
    while (prev && prev.tagName === "BR") prev = prev.previousElementSibling;
    if (run && prev === run[run.length - 1]) run.push(list);
    else runs.push([list]);
  }
  for (const run of runs) {
    const items = run.flatMap((list) =>
      Array.from(list.querySelectorAll(":scope > li")).map((li) => ({
        li,
        level: Math.max(1, Number(li.getAttribute("aria-level")) || 1),
        ordered: list.tagName === "OL",
      })),
    );
    const top = doc.createElement(items[0]?.ordered ? "ol" : "ul");
    const stack: { level: number; list: Element }[] = [{ level: 1, list: top }];
    for (const { li, level, ordered } of items) {
      while (stack.length > 1 && stack[stack.length - 1].level > level)
        stack.pop();
      let current = stack[stack.length - 1];
      while (current.level < level) {
        const host =
          current.list.lastElementChild ??
          current.list.appendChild(doc.createElement("li"));
        const sub = doc.createElement(ordered ? "ol" : "ul");
        host.appendChild(sub);
        current = { level: current.level + 1, list: sub };
        stack.push(current);
      }
      current.list.appendChild(li);
    }
    run[0].replaceWith(top);
    for (const list of run.slice(1)) list.remove();
  }
}

/** Word / Outlook list paragraphs (`mso-list: l0 level2 lfo1`) → nested lists. */
function wordLists(root: Element) {
  const doc = root.ownerDocument;
  const paragraphs = Array.from(root.querySelectorAll("p")).filter((p) =>
    /mso-list\s*:/.test(styleOf(p)),
  );
  let run: { p: Element; level: number; ordered: boolean }[] = [];
  const flush = () => {
    if (!run.length) return;
    const top = doc.createElement(run[0].ordered ? "ol" : "ul");
    const stack: { level: number; list: Element }[] = [{ level: 1, list: top }];
    for (const { p, level, ordered } of run) {
      while (stack.length > 1 && stack[stack.length - 1].level > level)
        stack.pop();
      let current = stack[stack.length - 1];
      while (current.level < level) {
        const host =
          current.list.lastElementChild ??
          current.list.appendChild(doc.createElement("li"));
        const sub = doc.createElement(ordered ? "ol" : "ul");
        host.appendChild(sub);
        current = { level: current.level + 1, list: sub };
        stack.push(current);
      }
      const li = doc.createElement("li");
      while (p.firstChild) li.appendChild(p.firstChild);
      current.list.appendChild(li);
    }
    run[0].p.replaceWith(top);
    for (const item of run.slice(1)) item.p.remove();
    run = [];
  };
  for (const p of paragraphs) {
    const level = Number(/level(\d+)/.exec(styleOf(p))?.[1] ?? 1);
    const glyph = p.querySelector(
      '[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]',
    );
    const ordered = /^\s*\(?[0-9a-zA-Z]{1,3}[.)]/.test(
      glyph?.textContent ?? "",
    );
    glyph?.remove();
    const prev = run[run.length - 1]?.p;
    if (prev && prev.nextElementSibling !== p) flush();
    run.push({ p, level, ordered });
  }
  flush();
}

/** Notion to-do items (checkbox divs) and GitHub task lists → checkbox inputs. */
function checkboxes(root: Element) {
  for (const box of Array.from(
    root.querySelectorAll(
      ".checkbox, .to-do-list .checkbox-on, .to-do-list .checkbox-off",
    ),
  )) {
    const input = root.ownerDocument.createElement("input");
    input.type = "checkbox";
    if (/checkbox-on/.test(box.className)) input.setAttribute("checked", "");
    box.replaceWith(input);
  }
}

const KEEP: Record<string, string[]> = {
  a: ["href"],
  img: ["src", "alt"],
  ol: ["start"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  input: ["type", "checked"],
  li: ["data-checked"],
  code: ["class"],
  pre: ["class"],
};

const INLINE = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "DEL",
  "A",
  "SPAN",
  "CODE",
  "FONT",
  "SUB",
  "SUP",
  "MARK",
  "SMALL",
  "BR",
  "IMG",
]);

/**
 * Loose text in the body or a <div> (Slack, chat apps, some editors) becomes one
 * paragraph per line: runs of inline nodes are wrapped in <p>, split at <br>.
 */
function paragraphsFromLooseText(container: Element) {
  const doc = container.ownerDocument;
  let run: Node[] = [];
  const flush = (before: Node | null) => {
    const meaningful = run.some((n) =>
      n.nodeType === 3
        ? n.textContent!.trim()
        : (n as Element).tagName !== "BR",
    );
    if (meaningful) {
      let p = doc.createElement("p");
      container.insertBefore(p, before);
      for (const node of run) {
        if (node.nodeType === 1 && (node as Element).tagName === "BR") {
          if (p.childNodes.length) {
            const next = doc.createElement("p");
            container.insertBefore(next, before);
            p = next;
          }
          node.parentNode?.removeChild(node);
        } else p.appendChild(node);
      }
      if (!p.childNodes.length) p.remove();
    } else run.forEach((n) => n.parentNode?.removeChild(n));
    run = [];
  };
  for (const node of Array.from(container.childNodes)) {
    const inline =
      node.nodeType === 3 ||
      (node.nodeType === 1 && INLINE.has((node as Element).tagName));
    if (inline) run.push(node);
    else flush(node);
  }
  flush(null);
  for (const div of Array.from(container.children))
    if (div.tagName === "DIV") paragraphsFromLooseText(div);
}

export function cleanClipboardHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  body
    .querySelectorAll(
      "script, style, meta, link, title, xml, o\\:p, template, svg, button",
    )
    .forEach((n) => n.remove());
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));
  body.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);
  wordLists(body);
  nestByAriaLevel(body);
  checkboxes(body);
  stylesToTags(body);
  // images: only real web URLs (data: URIs and local files cannot be stored as-is)
  body.querySelectorAll("img").forEach((img) => {
    if (!/^https?:\/\//.test(img.getAttribute("src") ?? "")) img.remove();
  });
  // links: only safe protocols
  body.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!/^(https?:|mailto:|#\/page\/)/i.test(href)) a.removeAttribute("href");
  });
  // drop presentation: styles, classes, colours, fonts, ids
  body.querySelectorAll("*").forEach((el) => {
    const keep = KEEP[el.tagName.toLowerCase()] ?? [];
    for (const attr of Array.from(el.attributes))
      if (
        !keep.includes(attr.name) &&
        !(attr.name.startsWith("data-") && el.closest("[data-pm-slice]"))
      )
        el.removeAttribute(attr.name);
    if (
      el.tagName === "FONT" ||
      (el.tagName === "SPAN" && !el.attributes.length)
    )
      unwrap(el);
  });
  paragraphsFromLooseText(body);
  // a <br> that only ends a block adds an empty line
  body
    .querySelectorAll(
      "p > br:last-child, li > br:last-child, div > br:last-child",
    )
    .forEach((br) => {
      if (br.nextSibling === null && br.previousSibling) br.remove();
    });
  return body.innerHTML;
}
