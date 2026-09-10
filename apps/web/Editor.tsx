import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { readableCodeColor } from "./code-colors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  Database,
  FilePlus2,
  GripVertical,
  Layers,
  MessageSquareQuote,
  X,
} from "lucide-react";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
  SyntaxHighlightingExtension,
} from "@blocknote/core/extensions";
import type {
  Block,
  Content,
  Document,
  TreeNode,
  LinkPreview,
} from "../../packages/document-schema/index";
import { moveBlocks, sectionIds } from "../../packages/editor-adapter/movement";
import { api, authHeaders } from "./api";
import { editorSchema } from "./editor-schema";

function PreviewImage({ url }: { url: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void fetch(url, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) return;
        const blob = await response.blob();
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return source ? <img src={source} alt="Page preview" /> : null;
}

function pageIdFromHref(href: string): string | null {
  const direct = /^#\/page\/([a-zA-Z0-9_-]+)$/.exec(href);
  if (direct) return direct[1];
  try {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return null;
    return /^#\/page\/([a-zA-Z0-9_-]+)$/.exec(url.hash)?.[1] ?? null;
  } catch {
    return null;
  }
}

export default function Editor({
  initial,
  onChange,
  onBackgroundImage,
  onCreateSubpage,
  onOpenPage,
  onLinkPreview,
  pages,
  theme,
}: {
  initial: Content;
  onChange: (blocks: Block[]) => void;
  onBackgroundImage: (id: string, url: string, name: string) => void;
  onCreateSubpage: () => Promise<Document>;
  onOpenPage: (id: string) => void;
  onLinkPreview: (url: string, preview: LinkPreview) => void;
  pages: TreeNode[];
  theme: "light" | "dark";
}) {
  const normalizedInitial = useMemo(() => {
    let changed = false;
    const normalize = (blocks: Block[]): Block[] =>
      blocks.map((block) => {
        let next = block;
        if (block.type === "codeBlock") {
          const allowed = new Set(["json", "html", "python", "go", "cpp"]);
          const language = String(block.props?.language ?? "").toLowerCase();
          if (!allowed.has(language)) {
            const source = Array.isArray(block.content)
              ? block.content.map((item) => item.text ?? "").join("")
              : "";
            const inferred = /^\s*</.test(source)
              ? "html"
              : /#include|std::|\bnamespace\s+\w+/.test(source)
                ? "cpp"
                : /\bpackage\s+main\b|\bfunc\s+\w+\s*\(/.test(source)
                  ? "go"
                  : /\bdef\s+\w+\s*\(|\bfrom\s+\w+\s+import\b|\bprint\s*\(/.test(
                        source,
                      )
                    ? "python"
                    : "json";
            next = {
              ...block,
              props: { ...block.props, language: inferred },
            };
            changed = true;
          }
        }
        if (next.children?.length) {
          const children = normalize(next.children);
          if (children !== next.children) next = { ...next, children };
        }
        return next;
      });
    const blocks = normalize(initial.blocks);
    return { content: { ...initial, blocks }, changed };
  }, [initial]);
  const upload = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const asset = await api<{ url: string; image: boolean }>("/api/assets", {
      method: "POST",
      body,
    });
    if (file.type.startsWith("image/") && !asset.image)
      throw new Error(
        "This file is not a supported PNG, JPEG, GIF, or WebP image.",
      );
    return asset.url;
  };
  const editor = useCreateBlockNote({
    schema: editorSchema,
    links: {
      HTMLAttributes: { target: "_self" },
      onClick: (event) => {
        const anchor = (event.target as HTMLElement).closest("a[href]");
        const href = anchor?.getAttribute("href");
        if (!href) return false;
        event.preventDefault();
        const id = pageIdFromHref(href);
        if (id) onOpenPage(id);
        else window.location.assign(href);
        return true;
      },
    },
    extensions: [
      SyntaxHighlightingExtension({
        createHighlighter: async () => {
          const { createHighlighter } = await import("shiki");
          const { default: lightTheme } =
            await import("@shikijs/themes/github-light-high-contrast");
          return createHighlighter({
            themes: [
              {
                ...lightTheme,
                // The stock palette targets white, not our warmer beige surface.
                tokenColors: lightTheme.tokenColors?.map((token) => ({
                  ...token,
                  settings: {
                    ...token.settings,
                    ...(token.settings.foreground
                      ? {
                          foreground: readableCodeColor(
                            token.settings.foreground,
                          ),
                        }
                      : {}),
                  },
                })),
              },
              "github-dark",
            ],
            langs: ["json", "html", "python", "go", "cpp"],
          });
        },
      }),
    ],
    initialContent: normalizedInitial.content.blocks as any,
    uploadFile: upload,
    resolveFileUrl: async (url) => {
      if (
        !url.startsWith("/api/assets/") ||
        !sessionStorage.getItem("yestion-token")
      )
        return url;
      const response = await fetch(url, { headers: authHeaders() });
      if (!response.ok) throw new Error("Attachment unavailable");
      const objectUrl = URL.createObjectURL(await response.blob());
      objectUrls.current.push(objectUrl);
      return objectUrl;
    },
  });
  const objectUrls = useRef<string[]>([]);
  const mounted = useRef(true);
  const host = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [rectangle, setRectangle] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [uploadState, setUploadState] = useState("");
  const [failed, setFailed] = useState<{ file: File; id: string }[]>([]);
  const [dropLine, setDropLine] = useState<number | null>(null);
  const [pasteChoice, setPasteChoice] = useState<string | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);
  const pasteAbort = useRef<AbortController | null>(null);
  const [pastePosition, setPastePosition] = useState({ left: 0, top: 0 });
  const pasteMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pasteChoice) return;
    const position = () => {
      const selection = pasteSelection.current;
      if (!selection) return;
      const coords = editor._tiptapEditor.view.coordsAtPos(selection.from);
      const width = pasteMenu.current?.offsetWidth ?? 420;
      const height = pasteMenu.current?.offsetHeight ?? 52;
      setPastePosition({
        left: Math.max(8, Math.min(coords.left, window.innerWidth - width - 8)),
        top: Math.max(
          8,
          coords.bottom + height + 16 < window.innerHeight
            ? coords.bottom + 8
            : coords.top - height - 8,
        ),
      });
    };
    position();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [pasteChoice, editor]);
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const creatingSubpage = useRef(false);
  const pasteSelection = useRef<{ from: number; to: number } | null>(null);
  const refreshedPageTitles = useRef("");
  const migrationSent = useRef(false);
  useEffect(() => {
    if (normalizedInitial.changed && !migrationSent.current) {
      migrationSent.current = true;
      onChange(editor.document as unknown as Block[]);
    }
  }, [editor, normalizedInitial.changed, onChange]);
  const pendingUploads = useRef(new Set<string>());
  function cancelPendingUploads() {
    const ids = [...pendingUploads.current].filter((id) => editor.getBlock(id));
    pendingUploads.current.clear();
    if (ids.length) editor.removeBlocks(ids);
    setFailed([]);
    setUploadState("");
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pasteAbort.current?.abort();
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected([]);
        pasteAbort.current?.abort();
        pasteSelection.current = null;
        setPasteLoading(false);
        setPasteChoice(null);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  useEffect(() => {
    const undo = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z" &&
        pendingUploads.current.size
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelPendingUploads();
      }
    };
    window.addEventListener("keydown", undo, true);
    return () => window.removeEventListener("keydown", undo, true);
  });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const blocks = [
      ...element.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]"),
    ];
    const drag = (event: DragEvent) => {
      event.dataTransfer?.setData(
        "application/yestion-blocks",
        JSON.stringify(selected),
      );
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    };
    for (const block of blocks) {
      const active = selected.includes(block.dataset.id!);
      block.dataset.boxSelected = String(active);
      if (active) {
        block.draggable = true;
        block.addEventListener("dragstart", drag);
      } else block.removeAttribute("draggable");
    }
    return () => {
      for (const block of blocks) {
        block.removeEventListener("dragstart", drag);
        block.removeAttribute("draggable");
      }
    };
  }, [selected]);
  function applyMove(target: string, side: "before" | "after") {
    const blocks = editor.document as unknown as Block[];
    const next = moveBlocks(blocks, selected, target, side);
    if (next !== blocks) {
      editor.transact(() => editor.replaceBlocks(editor.document, next as any));
      requestAnimationFrame(() => editor.focus());
    }
    setSelected([]);
  }
  function directionalMove(direction: "up" | "down") {
    const blocks = editor.document as unknown as Block[];
    const indices = blocks
      .map((b, i) => (selected.includes(b.id) ? i : -1))
      .filter((i) => i >= 0);
    if (!indices.length) return;
    const target =
      direction === "up"
        ? blocks[Math.min(...indices) - 1]
        : blocks[Math.max(...indices) + 1];
    if (target) applyMove(target.id, direction === "up" ? "before" : "after");
  }
  function startRectangle(event: React.PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest(
        "button, a, input, select, textarea, [draggable=true]",
      )
    )
      return;
    const start = { x: event.clientX, y: event.clientY };
    let active = false;
    function move(e: PointerEvent) {
      if (!active && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5)
        return;
      active = true;
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      const box = {
        x: Math.min(start.x, e.clientX),
        y: Math.min(start.y, e.clientY),
        w: Math.abs(start.x - e.clientX),
        h: Math.abs(start.y - e.clientY),
      };
      setRectangle(box);
      const hits = [
        ...(host.current?.querySelectorAll<HTMLElement>(
          ".bn-block-outer[data-id]",
        ) ?? []),
      ]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.bottom > box.y &&
            r.top < box.y + box.h &&
            r.right > box.x &&
            r.left < box.x + box.w
          );
        })
        .map((el) => el.dataset.id!);
      setSelected(hits);
    }
    function end() {
      setRectangle(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  const targetAt = (event: { clientX: number; clientY: number }) => {
    const el = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(".bn-block-outer[data-id]");
    return el
      ? {
          id: el.dataset.id!,
          side:
            event.clientY <
            el.getBoundingClientRect().top +
              el.getBoundingClientRect().height / 2
              ? ("before" as const)
              : ("after" as const),
          rect: el.getBoundingClientRect(),
        }
      : null;
  };
  async function finishUpload(file: File, id: string) {
    try {
      setUploadState(`Uploading ${file.name}…`);
      const url = await upload(file);
      if (!pendingUploads.current.has(id)) return;
      if (!mounted.current) {
        onBackgroundImage(id, url, file.name);
        return;
      }
      if (editor.getBlock(id))
        editor.updateBlock(id, {
          type: "image",
          props: { url, name: file.name, caption: "" },
        });
      setFailed((f) => f.filter((item) => item.id !== id));
    } catch (error) {
      setFailed((f) =>
        f.some((item) => item.id === id) ? f : [...f, { file, id }],
      );
      setUploadState((error as Error).message);
    } finally {
      pendingUploads.current.delete(id);
    }
  }
  async function dropImages(event: React.DragEvent) {
    const files = [...event.dataTransfer.files];
    if (!files.length || !files.every((f) => f.type.startsWith("image/")))
      return;
    event.preventDefault();
    event.stopPropagation();
    setDropLine(null);
    const target = targetAt(event);
    const ids = files.map(() => crypto.randomUUID());
    ids.forEach((id) => pendingUploads.current.add(id));
    editor.insertBlocks(
      files.map((file, i) => ({
        id: ids[i],
        type: "image" as const,
        props: {
          url: "",
          name: file.name,
          caption: "Upload pending — retry if this tab was reloaded",
        },
      })),
      target?.id ?? editor.document.at(-1)!.id,
      target?.side ?? "after",
    );
    for (let i = 0; i < files.length; i++) await finishUpload(files[i], ids[i]);
    setUploadState("");
  }
  function insertLinkChip(href: string, label: string) {
    editor.insertInlineContent(
      [
        {
          type: "link",
          href,
          content: [{ type: "text", text: label, styles: {} }],
        },
        { type: "text", text: "\u00a0", styles: {} },
      ] as any,
      { updateSelection: true },
    );
  }
  function insertPageMention(page: TreeNode) {
    insertLinkChip(`#/page/${page.id}`, `${page.icon ?? "📄"} ${page.title}`);
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
            group: "Yestion",
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
            group: "Yestion",
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
            group: "Yestion",
            icon: <BookOpenText size={18} />,
            onItemClick: () =>
              insertOrUpdateBlockForSlashMenu(editor, { type: "mermaid" }),
          },
          {
            title: "Callout",
            subtext: "Emphasize an important note",
            aliases: ["notice", "info", "alert"],
            group: "Yestion",
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
            group: "Yestion",
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
              const next = editor.insertBlocks([{ type: "paragraph" }], table, "after")[0];
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
    async (query: string) => mentionItems(query),
    [pages],
  );
  const bracketMentionItems = useCallback(
    async (query: string) => mentionItems(query),
    [pages],
  );
  async function insertPastedUrl(asMention: boolean) {
    if (!pasteChoice || pasteLoading) return;
    let label = pasteChoice;
    const internalId = pageIdFromHref(pasteChoice);
    if (asMention && internalId) {
      label = pages.find((page) => page.id === internalId)?.title ?? label;
    } else if (asMention) {
      try {
        label = new URL(pasteChoice).hostname.replace(/^www\./, "");
      } catch {
        // The URL was validated before the chooser opened.
      }
    }
    if (asMention && !internalId) {
      const abort = new AbortController();
      pasteAbort.current = abort;
      setPasteLoading(true);
      setPreviewError("");
      try {
        const preview = await api<LinkPreview>("/api/link-preview", {
          method: "POST",
          body: JSON.stringify({ url: pasteChoice }),
          signal: abort.signal,
        });
        if (!mounted.current || abort.signal.aborted) return;
        label = `📄 ${preview.title}`;
        onLinkPreview(pasteChoice, preview);
        setPreviewHref(pasteChoice);
      } catch {
        if (!mounted.current || abort.signal.aborted) return;
        setPreviewError(
          "Preview unavailable. The link was inserted with its hostname.",
        );
      } finally {
        if (mounted.current) setPasteLoading(false);
      }
    }
    const selection = pasteSelection.current;
    if (selection) {
      const size = editor._tiptapEditor.state.doc.content.size;
      editor._tiptapEditor.commands.setTextSelection({
        from: Math.min(selection.from, size),
        to: Math.min(selection.to, size),
      });
    }
    insertLinkChip(
      asMention && internalId ? `#/page/${internalId}` : pasteChoice,
      label,
    );
    pasteSelection.current = null;
    setPasteChoice(null);
  }
  useEffect(() => {
    const signature = pages
      .map((page) => `${page.id}:${page.icon}:${page.title}`)
      .join("\n");
    if (signature === refreshedPageTitles.current) return;
    refreshedPageTitles.current = signature;
    const titles = new Map(pages.map((page) => [page.id, page.title]));
    let changed = false;
    const update = (value: any): any => {
      if (Array.isArray(value)) return value.map(update);
      if (!value || typeof value !== "object") return value;
      if (value.type === "link" && typeof value.href === "string") {
        const pageId = pageIdFromHref(value.href);
        const target = pageId
          ? pages.find((page) => page.id === pageId)
          : undefined;
        const currentTitle = target
          ? `${target.icon ?? "📄"} ${titles.get(target.id)}`
          : undefined;
        if (currentTitle && inlineLabel(value.content) !== currentTitle) {
          changed = true;
          return {
            ...value,
            content: [{ type: "text", text: currentTitle, styles: {} }],
          };
        }
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, update(item)]),
      );
    };
    const inlineLabel = (content: any): string =>
      Array.isArray(content)
        ? content.map((item) => item.text ?? inlineLabel(item.content)).join("")
        : "";
    const next = update(editor.document);
    if (changed) editor.replaceBlocks(editor.document, next);
  }, [editor, pages]);
  return (
    <div
      className="editor-shell"
      ref={host}
      onKeyDownCapture={(e) => {
        if (
          (e.metaKey || e.ctrlKey) &&
          e.key.toLowerCase() === "z" &&
          pendingUploads.current.size
        ) {
          e.preventDefault();
          cancelPendingUploads();
          return;
        }
      }}
      onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          ".bn-inline-content a[href]",
        );
        const id = anchor
          ? pageIdFromHref(anchor.getAttribute("href") ?? "")
          : null;
        if (!id) return;
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        onOpenPage(id);
      }}
      onMouseOver={(event) => {
        const href = (event.target as HTMLElement)
          .closest("a[href]")
          ?.getAttribute("href");
        if (href && initial.linkPreviews?.[href]) setPreviewHref(href);
      }}
      onPasteCapture={(event) => {
        const value = event.clipboardData.getData("text/plain").trim();
        if (!/^https?:\/\/\S+$/i.test(value)) return;
        event.preventDefault();
        event.stopPropagation();
        pasteSelection.current = {
          from: editor._tiptapEditor.state.selection.from,
          to: editor._tiptapEditor.state.selection.to,
        };
        setPasteChoice(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setSelected([]);
        if (
          e.altKey &&
          e.shiftKey &&
          (e.key === "ArrowUp" || e.key === "ArrowDown")
        ) {
          e.preventDefault();
          directionalMove(e.key === "ArrowUp" ? "up" : "down");
        }
      }}
      onDragOverCapture={(e) => {
        if (
          e.dataTransfer.types.includes("Files") ||
          e.dataTransfer.types.includes("application/yestion-blocks")
        ) {
          e.preventDefault();
          const target = targetAt(e);
          setDropLine(
            target
              ? target.side === "before"
                ? target.rect.top
                : target.rect.bottom
              : null,
          );
          const scroll = document.querySelector(".main-scroll");
          if (scroll) {
            const r = scroll.getBoundingClientRect();
            if (e.clientY > r.bottom - 70) scroll.scrollTop += 16;
            else if (e.clientY < r.top + 70) scroll.scrollTop -= 16;
          }
        }
      }}
      onDropCapture={(e) => {
        if (e.dataTransfer.types.includes("application/yestion-blocks")) {
          e.preventDefault();
          e.stopPropagation();
          const target = targetAt(e);
          if (target) applyMove(target.id, target.side);
          setDropLine(null);
        } else void dropImages(e);
      }}
      onDragEnd={() => setDropLine(null)}
      onPointerDown={startRectangle}
    >
      <div className="selection-gutter" aria-label="Drag to select blocks" />
      <div className="editor-tools">
        <button
          className="quiet"
          onClick={() => {
            const current = editor.getTextCursorPosition().block;
            setSelected(
              sectionIds(editor.document as unknown as Block[], current.id),
            );
          }}
          title="Select the current heading and its section"
        >
          <Layers size={14} /> Select section
        </button>
        <span>Drag across blocks to select them</span>
      </div>
      {!!selected.length && (
        <div
          className="selection-toolbar"
          role="toolbar"
          aria-label="Selected blocks"
        >
          <button
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData(
                "application/yestion-blocks",
                JSON.stringify(selected),
              )
            }
            title="Drag selected blocks"
          >
            <GripVertical size={16} />
            {selected.length} selected
          </button>
          <button
            onClick={() => directionalMove("up")}
            aria-label="Move selection up"
          >
            <ArrowUp size={16} />
          </button>
          <button
            onClick={() => directionalMove("down")}
            aria-label="Move selection down"
          >
            <ArrowDown size={16} />
          </button>
          <button
            onClick={() => setSelected([])}
            aria-label="Clear block selection"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <BlockNoteView
        editor={editor}
        editable={!pasteLoading}
        theme={theme}
        slashMenu={false}
        onChange={() => onChange(editor.document as unknown as Block[])}
      >
        <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={atMentionItems}
        />
        <SuggestionMenuController
          triggerCharacter="[["
          getItems={bracketMentionItems}
        />
      </BlockNoteView>
      {pasteChoice && (
        <div
          ref={pasteMenu}
          style={pastePosition}
          className="paste-link-chooser"
          role="dialog"
          aria-label="Paste link"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span>{pasteChoice}</span>
          <button
            disabled={pasteLoading}
            onClick={() => void insertPastedUrl(true)}
          >
            {pasteLoading ? "Loading preview…" : "Paste as mention"}
          </button>
          <button
            disabled={pasteLoading}
            onClick={() => void insertPastedUrl(false)}
          >
            Paste as URL
          </button>
          <button
            aria-label="Cancel paste"
            onClick={() => {
              pasteAbort.current?.abort();
              setPasteLoading(false);
              pasteSelection.current = null;
              setPasteChoice(null);
              editor.focus();
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {previewError && <p role="status">{previewError}</p>}
      {previewHref && initial.linkPreviews?.[previewHref] && (
        <aside className="link-preview-card" aria-label="Link preview">
          <button
            aria-label="Close link preview"
            onClick={() => setPreviewHref(null)}
          >
            ×
          </button>
          <strong>{initial.linkPreviews[previewHref].title}</strong>
          <p>{initial.linkPreviews[previewHref].description}</p>
          {initial.linkPreviews[previewHref].image && (
            <PreviewImage url={initial.linkPreviews[previewHref].image!} />
          )}
        </aside>
      )}
      {rectangle && (
        <div
          className="selection-rectangle"
          style={{
            left: rectangle.x,
            top: rectangle.y,
            width: rectangle.w,
            height: rectangle.h,
          }}
        />
      )}
      {dropLine !== null && (
        <div
          className="drop-line"
          style={{
            top: dropLine,
            left: host.current?.getBoundingClientRect().left ?? 0,
            width: host.current?.clientWidth ?? 0,
          }}
        />
      )}
      {uploadState && (
        <div className="upload-status">
          <p role="status">{uploadState}</p>
          {uploadState.startsWith("Uploading ") && (
            <button onClick={cancelPendingUploads}>Cancel upload</button>
          )}
        </div>
      )}
      {failed.map((item) => (
        <button
          className="upload-retry"
          key={item.id}
          onClick={() => void finishUpload(item.file, item.id)}
        >
          Retry {item.file.name}
        </button>
      ))}
    </div>
  );
}
