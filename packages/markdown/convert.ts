import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { type Block, type Inline, emptyBlock } from "../document-schema/index";
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStringify, { bullet: "-", fences: true });
function inline(nodes: any[], styles: Record<string, boolean> = {}): Inline[] {
  return nodes.flatMap((node): Inline[] => {
    if (["strong", "emphasis", "delete"].includes(node.type))
      return inline(node.children, {
        ...styles,
        [({ strong: "bold", emphasis: "italic", delete: "strike" } as any)[
          node.type
        ]]: true,
      });
    if (node.type === "link")
      return [
        {
          type: "link",
          href: node.url,
          content: inline(node.children, styles),
        },
      ];
    return [
      {
        type: "text",
        text: node.type === "break" ? "\n" : (node.value ?? node.alt ?? ""),
        styles: node.type === "inlineCode" ? { ...styles, code: true } : styles,
      },
    ];
  });
}
export function fromMarkdown(markdown: string): {
  blocks: Block[];
  warnings: string[];
} {
  const tree = processor.parse(markdown);
  const warnings: string[] = [];
  function block(
    type: string,
    content: Inline[] | Record<string, any> = [],
    props: Record<string, unknown> = {},
    children: Block[] = [],
  ): Block {
    return { id: crypto.randomUUID(), type, props, content, children };
  }
  function convert(nodes: any[]): Block[] {
    return nodes.flatMap((n): Block[] => {
      switch (n.type) {
        case "html":
          if (n.value.trim() === "<!-- yestion:table-of-contents -->")
            return [
              {
                id: crypto.randomUUID(),
                type: "tableOfContents",
                props: {},
                children: [],
              },
            ];
          warnings.push("Preserved unsupported Markdown node as text: html");
          return [
            block("paragraph", [{ type: "text", text: n.value, styles: {} }]),
          ];
        case "heading":
          return [block("heading", inline(n.children), { level: n.depth })];
        case "paragraph": {
          const output: Block[] = [];
          let run: any[] = [];
          for (const child of n.children) {
            if (child.type === "image") {
              if (run.length) output.push(block("paragraph", inline(run)));
              run = [];
              output.push(
                block("image", [], {
                  url: child.url,
                  caption: child.alt ?? "",
                  name: child.alt ?? "",
                }),
              );
            } else run.push(child);
          }
          if (run.length) output.push(block("paragraph", inline(run)));
          return output;
        }
        case "list":
          return n.children.flatMap((item: any) => {
            const children = convert(item.children);
            const first = children.shift() ?? block("paragraph");
            return [
              block(
                item.checked !== null && item.checked !== undefined
                  ? "checkListItem"
                  : n.ordered
                    ? "numberedListItem"
                    : "bulletListItem",
                first.content ?? [],
                item.checked == null ? {} : { checked: item.checked },
                [...(first.children ?? []), ...children],
              ),
            ];
          });
        case "blockquote": {
          const nested = convert(n.children);
          const first = nested[0];
          if (first?.type === "paragraph") {
            nested.shift();
            return [
              block("quote", first.content ?? [], {}, [
                ...(first.children ?? []),
                ...nested,
              ]),
            ];
          }
          return [block("quote", [], {}, nested)];
        }
        case "code":
          if (n.lang?.toLowerCase() === "mermaid")
            return [
              {
                id: crypto.randomUUID(),
                type: "mermaid",
                props: { code: n.value },
                children: [],
              },
            ];
          return [
            block("codeBlock", [{ type: "text", text: n.value, styles: {} }], {
              language: n.lang ?? "text",
            }),
          ];
        case "table":
          return [
            block("table", {
              type: "tableContent",
              headerRows: 1,
              rows: n.children.map((row: any) => ({
                cells: row.children.map((cell: any) => inline(cell.children)),
              })),
            }),
          ];
        case "thematicBreak":
          return [
            block("paragraph", [{ type: "text", text: "—", styles: {} }]),
          ];
        default:
          warnings.push(
            `Preserved unsupported Markdown node as text: ${n.type}`,
          );
          return [
            block("paragraph", [
              {
                type: "text",
                text:
                  n.value ??
                  processor.stringify({ type: "root", children: [n] }),
                styles: {},
              },
            ]),
          ];
      }
    });
  }
  const blocks = convert(tree.children);
  return { blocks: blocks.length ? blocks : [emptyBlock()], warnings };
}
function toInline(content: any): any[] {
  if (typeof content === "string") return [{ type: "text", value: content }];
  if (!Array.isArray(content)) return [];
  return content.map((item: Inline) => {
    if (item.type === "link")
      return { type: "link", url: item.href, children: toInline(item.content) };
    let node: any = {
      type: item.styles?.code ? "inlineCode" : "text",
      value: item.text ?? "",
    };
    for (const [key, type] of [
      ["bold", "strong"],
      ["italic", "emphasis"],
      ["strike", "delete"],
    ])
      if (item.styles?.[key]) node = { type, children: [node] };
    return node;
  });
}
export function toMarkdown(blocks: Block[]): {
  markdown: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  function convert(items: Block[]): any[] {
    const output: any[] = [];
    for (const b of items) {
      const content = toInline(b.content);
      const props = b.props ?? {};
      if (
        ["bulletListItem", "numberedListItem", "checkListItem"].includes(b.type)
      ) {
        const ordered = b.type === "numberedListItem";
        let list = output.at(-1);
        if (list?.type !== "list" || list.ordered !== ordered) {
          list = {
            type: "list",
            ordered,
            start: ordered ? 1 : null,
            spread: false,
            children: [],
          };
          output.push(list);
        }
        list.children.push({
          type: "listItem",
          checked: b.type === "checkListItem" ? !!props.checked : null,
          spread: false,
          children: [
            { type: "paragraph", children: content },
            ...convert(b.children ?? []),
          ],
        });
        continue;
      }
      if (b.type === "heading")
        output.push({
          type: "heading",
          depth: Math.min(6, Math.max(1, Number(props.level) || 1)),
          children: content,
        });
      else if (b.type === "tableOfContents") {
        output.push({
          type: "html",
          value: "<!-- yestion:table-of-contents -->",
        });
        warnings.push(
          "Table of contents is a Yestion marker; external Markdown viewers do not render the live index.",
        );
      } else if (b.type === "callout") {
        output.push({
          type: "blockquote",
          children: [
            { type: "paragraph", children: content },
            ...convert(b.children ?? []),
          ],
        });
        warnings.push(
          "Portable Markdown renders callout as a quote; exact bundles preserve its type and icon.",
        );
        continue;
      } else if (b.type === "mermaid")
        output.push({
          type: "code",
          lang: "mermaid",
          value: String(props.code ?? ""),
        });
      else if (b.type === "codeBlock")
        output.push({
          type: "code",
          lang: String(props.language ?? "text"),
          value: ((b.content as Inline[]) ?? [])
            .map((i) => i.text ?? "")
            .join(""),
        });
      else if (b.type === "quote") {
        output.push({
          type: "blockquote",
          children: [
            { type: "paragraph", children: content },
            ...convert(b.children ?? []),
          ],
        });
        continue;
      } else if (b.type === "image")
        output.push({
          type: "paragraph",
          children: [
            {
              type: "image",
              url: String(props.url ?? ""),
              alt: String(props.caption ?? props.name ?? ""),
            },
          ],
        });
      else if (["file", "video", "audio"].includes(b.type))
        output.push({
          type: "paragraph",
          children: [
            {
              type: "link",
              url: String(props.url ?? ""),
              children: [{ type: "text", value: String(props.name ?? b.type) }],
            },
          ],
        });
      else if (b.type === "table")
        output.push({
          type: "table",
          children: ((b.content as any)?.rows ?? []).map((row: any) => ({
            type: "tableRow",
            children: row.cells.map((cell: any) => ({
              type: "tableCell",
              children: toInline(cell.content ?? cell),
            })),
          })),
        });
      else {
        output.push({ type: "paragraph", children: content });
        if (b.type !== "paragraph")
          warnings.push(`Portable Markdown flattens ${b.type}`);
      }
      if (
        props.previewWidth ||
        (props.backgroundColor && props.backgroundColor !== "default") ||
        (props.textColor && props.textColor !== "default")
      )
        warnings.push(
          "Visual styling is preserved in the exact bundle, not plain Markdown",
        );
      output.push(...convert(b.children ?? []));
    }
    return output;
  }
  return {
    markdown: processor.stringify({ type: "root", children: convert(blocks) }),
    warnings: [...new Set(warnings)],
  };
}
