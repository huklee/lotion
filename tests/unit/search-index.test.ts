import { describe, expect, it } from "vitest";
import type { Document } from "../../packages/document-schema/index";
import {
  LocalWorkspaceSearchIndex,
  searchContent,
} from "../../packages/search/index";

const document = (id: string, title: string): Document => ({
  schemaVersion: 1,
  id,
  title,
  icon: "📄",
  revision: 1,
  parentId: null,
  position: id,
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
  deletedAt: null,
  blocks: [
    {
      id: `${id}-formatted`,
      type: "paragraph",
      content: [
        { type: "text", text: "Search", styles: { bold: true } },
        { type: "text", text: "able content", styles: {} },
      ],
    },
    {
      id: `${id}-table`,
      type: "table",
      content: {
        type: "tableContent",
        rows: [
          {
            cells: [[{ type: "text", text: "Table needle", styles: {} }]],
          },
        ],
      },
    },
    {
      id: `${id}-mermaid`,
      type: "mermaid",
      props: { code: "graph TD\n  IndexedNode --> Result" },
    },
    {
      id: `${id}-mention`,
      type: "paragraph",
      content: [
        {
          type: "mention",
          props: {
            kind: "external",
            href: "https://example.com",
            label: "Reference needle",
            icon: "🌐",
          },
        },
      ],
    },
  ],
});

describe("workspace search index", () => {
  it("searches formatting boundaries, tables, Mermaid source, and Unicode", () => {
    const index = new LocalWorkspaceSearchIndex();
    index.index(document("one", "Résumé Search"));

    expect(index.search("searchable").results[0]).toMatchObject({
      documentId: "one",
      blockId: "one-formatted",
      field: "content",
    });
    expect(index.search("table needle").results[0]?.blockId).toBe("one-table");
    expect(index.search("indexednode").results[0]).toMatchObject({
      blockId: "one-mermaid",
      field: "mermaid",
    });
    expect(index.search("reference needle").results[0]?.blockId).toBe(
      "one-mention",
    );
    expect(index.search("ＲÉSUMÉ").results[0]?.field).toBe("title");
  });

  it("replaces stale revisions, ranks titles first, filters, and limits", () => {
    const index = new LocalWorkspaceSearchIndex();
    index.index(document("one", "Needle"));
    index.index(document("two", "Other"));
    index.index(document("three", "Needle guide"));
    const updated = document("one", "Renamed");
    updated.blocks[0].content = [
      { type: "text", text: "fresh needle", styles: {} },
    ];
    index.index(updated);

    expect(index.search("Résumé").total).toBe(0);
    expect(index.search("needle").results[0]).toMatchObject({
      documentId: "three",
      field: "title",
    });
    expect(index.search("needle").results).toContainEqual(
      expect.objectContaining({
        documentId: "one",
        blockId: "one-formatted",
      }),
    );
    expect(
      index
        .search("needle", { include: (id) => id !== "one" })
        .results.some((result) => result.documentId === "one"),
    ).toBe(false);
    expect(index.search("e", { limit: 1 }).results).toHaveLength(1);
  });

  it("marks current unsaved content as a draft", () => {
    const draft = document("draft-id", "Draft");
    const response = searchContent("draft-id", draft, "IndexedNode", 50, true);
    expect(response.results[0]).toMatchObject({
      documentId: "draft-id",
      draft: true,
      field: "mermaid",
    });
  });
});
