import { useCallback, useRef, useState, type RefObject } from "react";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import {
  BookOpenText,
  Database,
  FilePlus2,
  MessageSquareQuote,
} from "lucide-react";
import type { Document, TreeNode } from "../../packages/document-schema/index";
import type { LotionEditor } from "./editor.types";
import type { MentionKind } from "./MentionInline";

type EditorSuggestionsOptions = {
  editor: LotionEditor;
  pages: TreeNode[];
  mounted: RefObject<boolean>;
  onCreateSubpage: () => Promise<Document>;
  insertLinkChip: (
    href: string,
    label: string,
    mention?: { kind: MentionKind; icon: string },
  ) => void;
  setPreviewError: (message: string) => void;
};

export function useEditorSuggestions({
  editor,
  pages,
  mounted,
  onCreateSubpage,
  insertLinkChip,
  setPreviewError,
}: EditorSuggestionsOptions) {
  const creatingSubpage = useRef(false);
  const [dateSelection, setDateSelection] = useState<{
    from: number;
    to: number;
  } | null>(null);
  function insertPageMention(page: TreeNode) {
    insertLinkChip(`#/page/${page.id}`, page.title, {
      kind: "page",
      icon: page.icon ?? "📄",
    });
  }
  const mentionItems = (query: string) =>
    pages
      .filter((page) =>
        page.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      )
      .slice(0, 20)
      .map((page) => ({
        title: page.title,
        subtext: "Page",
        icon: <span className="mention-menu-icon">{page.icon ?? "📄"}</span>,
        onItemClick: () => insertPageMention(page),
      }));
  const slashItems = useCallback(
    async (query: string) =>
      filterSuggestionItems(
        [
          {
            title: "Page",
            subtext: "Create a subpage in this page",
            aliases: ["subpage", "child page"],
            group: "Lotion",
            icon: <FilePlus2 size={18} />,
            onItemClick: async () => {
              if (creatingSubpage.current) return;
              creatingSubpage.current = true;
              const anchorId = editor.getTextCursorPosition().block.id;
              try {
                const page = await onCreateSubpage();
                if (!mounted.current) return;
                const block = {
                  type: "paragraph",
                  content: [
                    {
                      type: "link",
                      href: `#/page/${page.id}`,
                      content: [
                        {
                          type: "text",
                          text: `${page.icon ?? "📄"} ${page.title}`,
                          styles: {},
                        },
                      ],
                    },
                  ],
                } as const;
                const anchor = editor.getBlock(anchorId);
                const pageBlock =
                  anchor &&
                  Array.isArray(anchor.content) &&
                  anchor.content.length === 0
                    ? editor.updateBlock(anchor, block as any)
                    : editor.insertBlocks(
                        [block as any],
                        anchor ?? editor.document.at(-1)!,
                        "after",
                      )[0];
                const next = editor.insertBlocks(
                  [{ type: "paragraph" }],
                  pageBlock,
                  "after",
                )[0];
                editor.setTextCursorPosition(next, "start");
              } catch (error) {
                if (mounted.current)
                  setPreviewError(
                    `Could not create subpage: ${(error as Error).message}`,
                  );
              } finally {
                creatingSubpage.current = false;
              }
            },
          },
          {
            title: "Table of contents",
            subtext: "Live links to headings in this page",
            aliases: ["toc", "outline"],
            group: "Lotion",
            icon: <BookOpenText size={18} />,
            onItemClick: () =>
              insertOrUpdateBlockForSlashMenu(editor, {
                type: "tableOfContents",
              }),
          },
          {
            title: "Mermaid",
            subtext: "Diagram with editable Mermaid source",
            aliases: ["diagram", "flowchart"],
            group: "Lotion",
            icon: <BookOpenText size={18} />,
            onItemClick: () =>
              insertOrUpdateBlockForSlashMenu(editor, { type: "mermaid" }),
          },
          {
            title: "Callout",
            subtext: "Emphasize an important note",
            aliases: ["notice", "info", "alert"],
            group: "Lotion",
            icon: <MessageSquareQuote size={18} />,
            onItemClick: () =>
              insertOrUpdateBlockForSlashMenu(editor, {
                type: "callout",
                props: { icon: "💡" },
              }),
          },
          {
            title: "Database",
            subtext: "Insert an editable table database",
            aliases: ["data source", "collection"],
            group: "Lotion",
            icon: <Database size={18} />,
            onItemClick: () => {
              const table = insertOrUpdateBlockForSlashMenu(editor, {
                type: "table",
                content: {
                  type: "tableContent",
                  headerRows: 1,
                  rows: [
                    {
                      cells: [
                        [{ type: "text", text: "Name", styles: {} }],
                        [{ type: "text", text: "Status", styles: {} }],
                      ],
                    },
                    { cells: [[], []] },
                  ],
                },
              });
              const next = editor.insertBlocks(
                [{ type: "paragraph" }],
                table,
                "after",
              )[0];
              editor.setTextCursorPosition(next, "start");
              editor.focus();
            },
          },
          ...getDefaultReactSlashMenuItems(editor),
        ],
        query,
      ),
    [editor, onCreateSubpage],
  );
  const atMentionItems = useCallback(
    async (query: string) => [
      ...filterSuggestionItems(
        [
          {
            title: "Date",
            subtext: "Choose a date from the calendar",
            aliases: ["calendar", "today", "date", "schedule"],
            group: "Lotion",
            icon: <BookOpenText size={18} />,
            onItemClick: () => {
              const { from, to } = editor._tiptapEditor.state.selection;
              setDateSelection({ from, to });
            },
          },
        ],
        query,
      ),
      ...mentionItems(query),
    ],
    [pages, editor],
  );
  const bracketMentionItems = useCallback(
    async (query: string) => mentionItems(query),
    [pages],
  );
  return {
    slashItems,
    atMentionItems,
    bracketMentionItems,
    dateSelection,
    setDateSelection,
  };
}
