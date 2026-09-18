import type { Block, Content, Document } from "../document-schema/index";
import { databaseText, readDatabaseState } from "../database/model";

export type SearchField = "title" | "content" | "mermaid";

export type SearchResult = {
  documentId: string;
  title: string;
  icon?: string;
  blockId: string | null;
  field: SearchField;
  excerpt: string;
  score: number;
  draft?: boolean;
};

export type SearchResponse = {
  query: string;
  total: number;
  results: SearchResult[];
};

type SearchSegment = Omit<SearchResult, "score" | "excerpt"> & {
  text: string;
  normalized: string;
};

export interface WorkspaceSearchIndex {
  index(document: Document): void;
  search(
    query: string,
    options?: { limit?: number; include?: (documentId: string) => boolean },
  ): SearchResponse;
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function inlineText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      if ("text" in item && typeof item.text === "string") return item.text;
      if (
        "props" in item &&
        item.props &&
        typeof item.props === "object" &&
        "label" in item.props &&
        typeof item.props.label === "string"
      )
        return item.props.label;
      if ("content" in item) return inlineText(item.content);
      return "";
    })
    .join("");
}

function blockText(block: Block): { text: string; field: SearchField } | null {
  if (block.type === "database") {
    try {
      return {
        text: databaseText(
          readDatabaseState(block.props?.columns, block.props?.rows),
        ),
        field: "content",
      };
    } catch {
      return null;
    }
  }
  if (block.type === "mermaid") {
    const code = block.props?.code;
    return typeof code === "string" && code
      ? { text: code, field: "mermaid" }
      : null;
  }
  if (block.type === "table") {
    const rows = (block.content as any)?.rows;
    if (!Array.isArray(rows)) return null;
    return {
      text: rows
        .map((row: any) =>
          Array.isArray(row?.cells)
            ? row.cells
                .map((cell: unknown) =>
                  inlineText(
                    Array.isArray(cell)
                      ? cell
                      : (cell as { content?: unknown })?.content,
                  ),
                )
                .join("\t")
            : "",
        )
        .join("\n"),
      field: "content",
    };
  }
  const text = inlineText(block.content);
  const propertyText = [block.props?.name, block.props?.caption]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const combined = [text, propertyText].filter(Boolean).join(" ");
  return combined ? { text: combined, field: "content" } : null;
}

function contentSegments(
  documentId: string,
  content: Content,
  draft = false,
): SearchSegment[] {
  const common = {
    documentId,
    title: content.title,
    icon: content.icon,
    draft: draft || undefined,
  };
  const segments: SearchSegment[] = [
    {
      ...common,
      blockId: null,
      field: "title",
      text: content.title,
      normalized: normalize(content.title),
    },
  ];
  const visit = (blocks: readonly Block[]) => {
    for (const block of blocks) {
      const value = blockText(block);
      if (value?.text) {
        segments.push({
          ...common,
          blockId: block.id,
          field: value.field,
          text: value.text,
          normalized: normalize(value.text),
        });
      }
      visit(block.children ?? []);
    }
  };
  visit(content.blocks);
  return segments;
}

function excerpt(text: string, normalizedQuery: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 180) return compact;
  const at = normalize(compact).indexOf(normalizedQuery);
  const start = Math.max(0, at - 70);
  const end = Math.min(compact.length, start + 180);
  return `${start ? "…" : ""}${compact.slice(start, end)}${
    end < compact.length ? "…" : ""
  }`;
}

function searchSegments(
  segments: Iterable<SearchSegment>,
  query: string,
  limit: number,
  include: (documentId: string) => boolean,
): SearchResponse {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) return { query: query.trim(), total: 0, results: [] };
  const matches: SearchResult[] = [];
  for (const segment of segments) {
    if (!include(segment.documentId)) continue;
    const at = segment.normalized.indexOf(normalizedQuery);
    if (at < 0) continue;
    const occurrences = segment.normalized.split(normalizedQuery).length - 1;
    const titleScore =
      segment.field !== "title"
        ? 0
        : segment.normalized === normalizedQuery
          ? 1000
          : segment.normalized.startsWith(normalizedQuery)
            ? 800
            : 600;
    matches.push({
      documentId: segment.documentId,
      title: segment.title,
      icon: segment.icon,
      blockId: segment.blockId,
      field: segment.field,
      excerpt: excerpt(segment.text, normalizedQuery),
      score: titleScore + occurrences * 10 - at / 1000,
      draft: segment.draft,
    });
  }
  matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.title.localeCompare(b.title) ||
      (a.blockId ?? "").localeCompare(b.blockId ?? ""),
  );
  return {
    query: query.trim(),
    total: matches.length,
    results: matches.slice(0, limit),
  };
}

export function searchContent(
  documentId: string,
  content: Content,
  query: string,
  limit = 50,
  draft = false,
): SearchResponse {
  return searchSegments(
    contentSegments(documentId, content, draft),
    query,
    limit,
    () => true,
  );
}

export class LocalWorkspaceSearchIndex implements WorkspaceSearchIndex {
  private readonly segments = new Map<string, SearchSegment[]>();

  index(document: Document): void {
    this.segments.set(document.id, contentSegments(document.id, document));
  }

  search(
    query: string,
    options: { limit?: number; include?: (documentId: string) => boolean } = {},
  ): SearchResponse {
    const allSegments = function* (
      entries: Iterable<SearchSegment[]>,
    ): Generator<SearchSegment> {
      for (const entry of entries) yield* entry;
    };
    return searchSegments(
      allSegments(this.segments.values()),
      query,
      options.limit ?? 50,
      options.include ?? (() => true),
    );
  }
}
