import { z } from "zod";

export type Inline = {
  type: string;
  text?: string;
  styles?: Record<string, string | boolean>;
  href?: string;
  props?: Record<string, string | boolean | number>;
  content?: Inline[];
};
export type Block = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: Inline[] | Record<string, any>;
  children?: Block[];
};
export type LinkPreview = {
  title: string;
  description?: string;
  image?: string;
  fetchedAt?: string;
};
export type Content = {
  title: string;
  icon?: string;
  blocks: Block[];
  linkPreviews?: Record<string, LinkPreview>;
};
export type Document = Content & {
  schemaVersion: 1;
  id: string;
  revision: number;
  parentId: string | null;
  position: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  lastMutationId?: string;
  lastMutationDigest?: string;
  sourcePath?: string;
};
export type TreeNode = Omit<Document, "blocks"> & { hidden: boolean };
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const mutationSchema = z.string().uuid();
const allowedBlocks = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
  "codeBlock",
  "table",
  "image",
  "file",
  "video",
  "audio",
  "divider",
  "tableOfContents",
  "callout",
  "mermaid",
]);
export function safeUrl(value: string): boolean {
  return (
    // eslint-disable-next-line no-control-regex -- reject invisible control characters in imported URLs
    !/[\u0000-\u001f]/.test(value) &&
    !value.startsWith("//") &&
    /^(https?:\/\/|mailto:|\/api\/assets\/|#|\.\.?\/|[^:/?#]+(?:\/|$))/.test(
      value,
    )
  );
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
export const contentSchema = z
  .object({
    title: z.string().max(500),
    icon: z.string().max(32).optional(),
    linkPreviews: z
      .record(
        z.string().max(4096),
        z.object({
          title: z.string().max(500),
          description: z.string().max(1000).optional(),
          image: z
            .string()
            .regex(/^\/api\/assets\/[a-f0-9]{64}\.(png|jpg|gif|webp)$/)
            .optional(),
          fetchedAt: z.string().datetime().optional(),
        }),
      )
      .optional(),
    blocks: z.array(z.any()).min(1).max(10000),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    let count = 0;
    function inspect(value: any, depth: number) {
      if (depth > 64 || ++count > 100000)
        throw new Error("Document is too deeply nested or large");
      if (!value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        if (
          (key === "href" || key === "url") &&
          typeof item === "string" &&
          item &&
          !safeUrl(item)
        )
          throw new Error("Unsafe link URL");
        if (item && typeof item === "object") inspect(item, depth + 1);
      }
    }
    function visit(blocks: any[], depth = 0) {
      if (depth > 32) throw new Error("Maximum block depth exceeded");
      for (const block of blocks) {
        if (
          !block ||
          !idSchema.safeParse(block.id).success ||
          ids.has(block.id) ||
          !allowedBlocks.has(block.type)
        )
          throw new Error("Invalid or duplicate block");
        ids.add(block.id);
        if (
          block.props !== undefined &&
          (!block.props ||
            typeof block.props !== "object" ||
            Array.isArray(block.props))
        )
          throw new Error("Invalid block properties");
        function inline(items: any, level = 0) {
          if (!Array.isArray(items) || level > 8)
            throw new Error("Invalid inline content");
          for (const item of items) {
            if (item?.type === "text") {
              if (
                typeof item.text !== "string" ||
                (item.styles !== undefined &&
                  (!item.styles ||
                    typeof item.styles !== "object" ||
                    Array.isArray(item.styles)))
              )
                throw new Error("Invalid text content");
            } else if (item?.type === "link") {
              if (typeof item.href !== "string")
                throw new Error("Invalid link");
              inline(item.content, level + 1);
            } else if (item?.type === "mention") {
              const props = item.props;
              if (
                !props ||
                !["page", "external", "file", "date"].includes(props.kind) ||
                typeof props.href !== "string" ||
                typeof props.label !== "string" ||
                props.label.length > 500 ||
                typeof props.icon !== "string" ||
                props.icon.length > 32 ||
                (props.value !== undefined &&
                  (typeof props.value !== "string" ||
                    props.value.length > 100)) ||
                item.content !== undefined
              )
                throw new Error("Invalid mention");
              if (
                (props.kind === "date" &&
                  (props.href !== "" ||
                    typeof props.value !== "string" ||
                    !isIsoDate(props.value) ||
                    props.label !== props.value)) ||
                (props.kind === "file" &&
                  !/^\/api\/assets\/[a-f0-9]{64}\.(png|jpg|gif|webp|bin)$/.test(
                    props.href,
                  )) ||
                (props.kind !== "date" &&
                  props.value !== undefined &&
                  props.value !== "")
              )
                throw new Error("Invalid mention reference");
            } else throw new Error("Unknown inline content");
          }
        }
        if (block.type === "table") {
          if (
            !block.content ||
            block.content.type !== "tableContent" ||
            !Array.isArray(block.content.rows) ||
            block.content.rows.length > 1000
          )
            throw new Error("Invalid table");
          for (const row of block.content.rows) {
            if (!Array.isArray(row.cells) || row.cells.length > 100)
              throw new Error("Invalid table row");
            for (const cell of row.cells)
              inline(Array.isArray(cell) ? cell : cell?.content);
          }
        } else if (block.type === "mermaid") {
          if (
            block.content !== undefined ||
            typeof block.props?.code !== "string" ||
            block.props.code.length > 20000
          )
            throw new Error(
              "Invalid Mermaid source (maximum 20000 characters)",
            );
        } else if (block.type === "tableOfContents") {
          if (block.content !== undefined)
            throw new Error("Table of contents cannot contain inline content");
        } else if (block.content !== undefined) inline(block.content);
        if (block.children !== undefined && !Array.isArray(block.children))
          throw new Error("Invalid children");
        if (block.children) visit(block.children, depth + 1);
      }
    }
    try {
      visit(data.blocks);
      inspect(data.blocks, 0);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: (error as Error).message });
    }
  });
export function emptyBlock(): Block {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [],
    children: [],
  };
}
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
