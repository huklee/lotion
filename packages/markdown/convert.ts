import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { type Block, type Inline, emptyBlock } from "../document-schema/index";
import { readDatabaseState } from "../database/model";
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
          if (
            [
              "<!-- lotion:table-of-contents -->",
              "<!-- yestion:table-of-contents -->",
            ].includes(n.value.trim())
          )
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
    if (item.type === "mention") {
      const label = String(item.props?.label ?? "Untitled");
      const icon = String(item.props?.icon ?? "");
      if (item.props?.kind === "date")
        return {
          type: "text",
          value: [icon, label].filter(Boolean).join(" "),
        };
      return {
        type: "link",
        url: String(item.props?.href ?? ""),
        children: [
          {
            type: "text",
            value: [icon, label].filter(Boolean).join(" "),
          },
        ],
      };
    }
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
      // remark encodes a whitespace-only paragraph as `&#x20;`. Empty editor
      // blocks should become ordinary blank Markdown lines when copied.
      const portableContent = content.every(
        (item: any) => item.type === "text" && /^\s*$/.test(item.value),
      )
        ? []
        : content;
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
            { type: "paragraph", children: portableContent },
            ...convert(b.children ?? []),
          ],
        });
        continue;
      }
      if (b.type === "heading")
        output.push({
          type: "heading",
          depth: Math.min(6, Math.max(1, Number(props.level) || 1)),
          children: portableContent,
        });
      else if (b.type === "tableOfContents") {
        output.push({
          type: "html",
          value: "<!-- lotion:table-of-contents -->",
        });
        warnings.push(
          "Table of contents is a Lotion marker; external Markdown viewers do not render the live index.",
        );
      } else if (b.type === "callout") {
        output.push({
          type: "blockquote",
          children: [
            { type: "paragraph", children: portableContent },
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
            { type: "paragraph", children: portableContent },
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
      else if (b.type === "database") {
        try {
          const database = readDatabaseState(props.columns, props.rows);
          output.push({
            type: "table",
            children: [
              {
                type: "tableRow",
                children: [
                  "Page",
                  ...database.columns.map((column) => column.name),
                ].map((value) => ({
                  type: "tableCell",
                  children: [{ type: "text", value }],
                })),
              },
              ...database.rows.map((row) => ({
                type: "tableRow",
                children: [
                  {
                    type: "tableCell",
                    children: [
                      {
                        type: "link",
                        url: row.href,
                        children: [
                          {
                            type: "text",
                            value: row.title || "Untitled row",
                          },
                        ],
                      },
                    ],
                  },
                  ...database.columns.map((column) => {
                    const value = row.values[column.id];
                    return {
                      type: "tableCell",
                      children: [
                        {
                          type: "text",
                          value:
                            column.type === "checkbox"
                              ? value
                                ? "Yes"
                                : "No"
                              : value === null || value === undefined
                                ? ""
                                : String(value),
                        },
                      ],
                    };
                  }),
                ],
              })),
            ],
          });
          warnings.push(
            "Portable Markdown renders a database as a static table; exact bundles preserve typed properties and row-page behavior.",
          );
        } catch {
          output.push({ type: "paragraph", children: [] });
          warnings.push("Invalid database content was omitted from Markdown.");
        }
      } else {
        output.push({ type: "paragraph", children: portableContent });
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
