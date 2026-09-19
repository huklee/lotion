import { useChecklistInteraction } from "./use-checklist-interaction";
import { useEditorSuggestions } from "./use-editor-suggestions";
import { usePasteLink } from "./use-paste-link";
import { PasteLinkChooser } from "./PasteLinkChooser";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { EditorInteractionOverlays } from "./EditorInteractionOverlays";
import {
  FormattingToolbarController,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { readableCodeColor } from "./code-colors";
import { mermaidFromClipboard } from "./mermaid-paste";
import { clipboardLines, clipboardTextLines } from "./clipboard-lines";
import { structuredBlocksFromClipboard } from "./structured-block-paste";
import {
  rememberSelectedBlockClipboard,
  selectedBlocksFromClipboard,
} from "./selected-block-clipboard";
import { DatePicker } from "./DatePicker";
import { FileReferencePicker } from "./FileReferencePicker";
import { blockToNode } from "@blocknote/core";
import { contentSchema } from "../../packages/document-schema/index";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Layers,
  Link,
  Scissors,
  X,
} from "lucide-react";
import {
  SyntaxHighlightingExtension,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import type {
  Block,
  Content,
  Document,
  TreeNode,
  LinkPreview,
} from "../../packages/document-schema/index";
import {
  moveBlocks,
  sectionIds,
  selectedBlockSubtrees,
} from "../../packages/editor-adapter/movement";
import { toMarkdown } from "../../packages/markdown/convert";
import { api, authHeaders } from "./api";
import { editorSchema } from "./editor-schema";
import {
  matchesFormattingShortcut,
  colorPresets,
  type FormattingShortcuts,
} from "./format-shortcuts";
import { blockIdFromHash, pageIdFromHash } from "./block-links";
import { useBlockSelection } from "./use-block-selection";
import { useDirectBlockLinkTarget } from "./use-direct-block-link";
import { EditorFormattingToolbar } from "./EditorFormattingToolbar";
import { normalizeEditorContent } from "./normalize-editor-content";
import type { MentionProperties } from "./MentionInline";
import { useLinkPreviewRefresh } from "./use-link-preview-refresh";
import { downloadFileReference } from "./file-reference";
import { DatabaseActionsContext } from "./DatabaseBlock";
import { ArrowSubstitutionExtension } from "./arrow-substitution";
import {
  readLastColorStyle,
  writeLastColorStyle,
  type AppliedColorPreset,
} from "./last-color-style";

type EditorReplacementBlocks = Parameters<
  (typeof editorSchema.BlockNoteEditor)["replaceBlocks"]
>[1];

function pageIdFromHref(href: string): string | null {
  const direct = pageIdFromHash(href);
  if (direct) return direct;
  try {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return null;
    return pageIdFromHash(url.hash);
  } catch {
    return null;
  }
}

export default function Editor({
  initial,
  onChange,
  onBackgroundImage,
  onCreateSubpage,
  onCopyBlockLink,
  onOpenPage,
  onLinkPreview,
  pages,
  theme,
  formattingShortcuts,
}: {
  initial: Content;
  onChange: (blocks: Block[]) => void;
  onBackgroundImage: (id: string, url: string, name: string) => void;
  onCreateSubpage: (title?: string) => Promise<Document>;
  onCopyBlockLink: (blockId: string) => Promise<void>;
  onOpenPage: (id: string) => void;
  onLinkPreview: (url: string, preview: LinkPreview) => void;
  pages: TreeNode[];
  theme: "light" | "dark";
  formattingShortcuts: FormattingShortcuts;
}) {
  const normalizedInitial = useMemo(
    () => normalizeEditorContent(initial),
    [initial],
  );
  const uploadAsset = async (file: File, signal?: AbortSignal) => {
    const body = new FormData();
    body.append("file", file);
    const asset = await api<{ url: string; image: boolean }>("/api/assets", {
      method: "POST",
      body,
      signal,
    });
    if (file.type.startsWith("image/") && !asset.image)
      throw new Error(
        "This file is not a supported PNG, JPEG, GIF, or WebP image.",
      );
    return asset.url;
  };
  const upload = (file: File, _blockId?: string) => uploadAsset(file);
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
        const destinationHash = (() => {
          try {
            return new URL(href, location.href).hash;
          } catch {
            return "";
          }
        })();
        if (id && blockIdFromHash(destinationHash))
          location.hash = destinationHash;
        else if (id) onOpenPage(id);
        else window.location.assign(href);
        return true;
      },
    },
    extensions: [
      ArrowSubstitutionExtension,
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
        !sessionStorage.getItem("lotion-token")
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
  const lastColorStyle = useRef<AppliedColorPreset | null>(
    readLastColorStyle(sessionStorage),
  );
  const mounted = useRef(true);
  const host = useRef<HTMLDivElement>(null);
  const [uploadState, setUploadState] = useState("");
  const rememberColorStyle = useCallback((style: AppliedColorPreset) => {
    lastColorStyle.current = style;
    writeLastColorStyle(sessionStorage, style);
  }, []);
  const applyColorStyle = useCallback(
    (style: AppliedColorPreset) => {
      if (style.color === "default")
        editor.removeStyles({
          textColor: style.color,
          backgroundColor: style.color,
        });
      else
        editor.addStyles({
          textColor: style.color,
          backgroundColor: style.color,
        });
      rememberColorStyle(style);
    },
    [editor, rememberColorStyle],
  );
  const [failed, setFailed] = useState<{ file: File; id: string }[]>([]);
  const [dropLine, setDropLine] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState("");
  const { previewHref, refreshingPreview, setPreviewHref, showLinkPreview } =
    useLinkPreviewRefresh({
      editor,
      previews: initial.linkPreviews,
      onLinkPreview,
      setPreviewError,
    });
  const {
    cancel: cancelPaste,
    choice: pasteChoice,
    insert: insertPastedUrl,
    loading: pasteLoading,
    menuRef: pasteMenu,
    open: openPasteLink,
    position: pastePosition,
  } = usePasteLink({
    editor,
    pages,
    mounted,
    insertLinkChip,
    onLinkPreview,
    setPreviewHref,
    setPreviewError,
  });
  const {
    deleteSelected,
    endSelectionDrag,
    rectangle,
    rectangleClick,
    selected,
    selectedBoxes,
    selectionDragActive,
    setSelected,
    startSelectionDrag,
    startRectangle,
  } = useBlockSelection({ editor, host, pasteLoading });
  const directLinkBox = useDirectBlockLinkTarget(host);
  const databaseActions = useMemo(
    () => ({
      pages,
      createRowPage: onCreateSubpage,
      openPage: onOpenPage,
    }),
    [onCreateSubpage, onOpenPage, pages],
  );
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
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected([]);
        cancelPaste();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [cancelPaste]);
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
  const copySelectedBlocks = useCallback(
    async (cut: boolean) => {
      const blocks = selectedBlockSubtrees(
        editor.document as unknown as Block[],
        selected,
      );
      if (!blocks.length) return;
      try {
        const markdown = toMarkdown(blocks).markdown;
        await navigator.clipboard.writeText(markdown);
        rememberSelectedBlockClipboard(markdown, blocks);
        if (cut) deleteSelected();
      } catch (error) {
        setPreviewError(
          `Could not ${cut ? "cut" : "copy"} selected blocks: ${
            (error as Error).message
          }`,
        );
      }
    },
    [deleteSelected, editor, selected],
  );
  useEffect(() => {
    if (!selected.length) return;
    const copyOrCut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const key = event.key.toLowerCase();
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        (key !== "c" && key !== "x") ||
        target.closest("input, textarea, select")
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void copySelectedBlocks(key === "x");
    };
    window.addEventListener("keydown", copyOrCut, true);
    return () => window.removeEventListener("keydown", copyOrCut, true);
  }, [copySelectedBlocks, selected.length]);
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
  function insertLinkChip(
    href: string,
    label: string,
    mention?: MentionProperties,
  ) {
    editor.insertInlineContent(
      [
        mention
          ? {
              type: "mention",
              props: { ...mention, href, label },
            }
          : {
              type: "link",
              href,
              content: [{ type: "text", text: label, styles: {} }],
            },
        { type: "text", text: "\u00a0", styles: {} },
      ] as any,
      { updateSelection: true },
    );
  }
  const {
    slashItems,
    atMentionItems,
    bracketMentionItems,
    dateSelection,
    setDateSelection,
    fileSelection,
    setFileSelection,
  } = useEditorSuggestions({
    editor,
    pages,
    mounted,
    onCreateSubpage,
    insertLinkChip,
    setPreviewError,
  });
  useChecklistInteraction(editor, host);
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
      if (
        value.type === "mention" &&
        value.props?.kind === "page" &&
        typeof value.props.href === "string"
      ) {
        const pageId = pageIdFromHref(value.props.href);
        const target = pageId
          ? pages.find((page) => page.id === pageId)
          : undefined;
        const label = target?.title;
        const icon = target?.icon ?? "📄";
        if (
          target &&
          (value.props.label !== label || value.props.icon !== icon)
        ) {
          changed = true;
          return { ...value, props: { ...value.props, label, icon } };
        }
      }
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
      spellCheck="false"
      onPointerDownCapture={(event) => {
        rectangleClick.current = false;
        const control = (event.target as HTMLElement).closest(
          "input, textarea, select",
        );
        if (control) setSelected([]);
      }}
      onKeyDownCapture={(e) => {
        if ((e.target as HTMLElement).closest("input, textarea, select"))
          return;
        const color = colorPresets.find((candidate) =>
          matchesFormattingShortcut(
            e.nativeEvent,
            formattingShortcuts.colorPresets[candidate],
          ),
        );
        if (color) {
          e.preventDefault();
          e.stopPropagation();
          applyColorStyle({ color });
          return;
        }
        if (
          lastColorStyle.current &&
          matchesFormattingShortcut(
            e.nativeEvent,
            formattingShortcuts.repeatLast,
          )
        ) {
          e.preventDefault();
          e.stopPropagation();
          applyColorStyle(lastColorStyle.current);
          return;
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          !e.altKey &&
          !e.shiftKey &&
          e.key === "Enter"
        ) {
          const current = editor.getTextCursorPosition().block;
          if (current.type === "checkListItem") {
            e.preventDefault();
            e.stopPropagation();
            editor.updateBlock(current.id, {
              props: { checked: !current.props.checked },
            });
            return;
          }
        }
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
        if (rectangleClick.current) {
          rectangleClick.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if ((event.target as HTMLElement).closest(".bn-inline-content")) {
          if (selected.length) {
            (event.target as HTMLElement)
              .closest<HTMLElement>('[contenteditable="true"]')
              ?.focus({ preventScroll: true });
          }
          setSelected([]);
        }
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          ".bn-inline-content a[href]",
        );
        if (anchor?.dataset.lotionMention === "file") {
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          void downloadFileReference(
            anchor.getAttribute("href") ?? "",
            anchor.dataset.lotionMentionLabel ?? "attachment",
          ).catch((error) => setPreviewError((error as Error).message));
          return;
        }
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
        if (href) showLinkPreview(href);
      }}
      onPasteCapture={(event) => {
        // Custom block inputs own their paste events (including Mermaid source).
        if (
          (event.target as HTMLElement).closest(
            'textarea, input, [contenteditable="false"]',
          )
        )
          return;
        const raw = event.clipboardData.getData("text/plain");
        const value = raw.trim();
        const code = mermaidFromClipboard(value);
        if (code !== null) {
          event.preventDefault();
          event.stopPropagation();
          insertOrUpdateBlockForSlashMenu(editor, {
            type: "mermaid",
            props: { code },
          });
          return;
        }
        if (!/^https?:\/\/\S+$/i.test(value)) {
          if (!raw || event.clipboardData.files.length) return;
          event.preventDefault();
          event.stopPropagation();
          try {
            const current = editor.getTextCursorPosition().block;
            const copiedBlocks = selectedBlocksFromClipboard(raw);
            const structured =
              copiedBlocks ??
              (current.type === "paragraph" &&
              (!Array.isArray(current.content) || current.content.length === 0)
                ? structuredBlocksFromClipboard(raw)
                : null);
            const checklistPaste = current.type === "checkListItem";
            const lineOptions = { omitTerminalDelimiter: checklistPaste };
            const blocks = structured ?? clipboardLines(raw, lineOptions);
            // Inserting paragraph nodes at an inline checklist selection
            // changes the containing block into a paragraph. Keep checklist
            // semantics for every pasted line instead.
            const inserted = checklistPaste
              ? blocks.map((block, index) => ({
                  ...block,
                  type: "checkListItem" as const,
                  props: {
                    checked:
                      index === 0 ? current.props.checked === true : false,
                  },
                }))
              : blocks;
            const checked = contentSchema.safeParse({
              title: initial.title,
              blocks: [...editor.document, ...inserted],
            });
            if (!checked.success)
              throw new Error(
                "This paste exceeds the document's save limits. Paste a smaller section.",
              );
            if (structured) {
              if (
                current.type === "paragraph" &&
                (!Array.isArray(current.content) ||
                  current.content.length === 0)
              )
                editor.replaceBlocks(
                  [current],
                  structured as unknown as EditorReplacementBlocks,
                );
              else
                editor.insertBlocks(
                  structured as unknown as EditorReplacementBlocks,
                  current,
                  "after",
                );
              return;
            }
            // Insert schema nodes directly: pasteHTML still applies Markdown
            // paste rules such as **bold**, even for otherwise plain paragraphs.
            const tiptap = editor._tiptapEditor;
            if (blocks.length === 1) {
              const text = checklistPaste
                ? clipboardTextLines(raw, lineOptions)[0]
                : raw;
              if (!text) return;
              tiptap.commands.insertContentAt(
                {
                  from: tiptap.state.selection.from,
                  to: tiptap.state.selection.to,
                },
                { type: "text", text },
                { applyPasteRules: false, applyInputRules: false },
              );
              return;
            }
            if (checklistPaste) {
              const lines = clipboardTextLines(raw, lineOptions);
              let insertion = tiptap.chain().insertContentAt(
                {
                  from: tiptap.state.selection.from,
                  to: tiptap.state.selection.to,
                },
                { type: "text", text: lines[0] },
                { applyPasteRules: false, applyInputRules: false },
              );
              for (const line of lines.slice(1)) {
                insertion = insertion.keyboardShortcut("Enter");
                if (line)
                  insertion = insertion.insertContent(
                    { type: "text", text: line },
                    { applyPasteRules: false, applyInputRules: false },
                  );
              }
              insertion.run();
              return;
            }
            tiptap.commands.insertContentAt(
              {
                from: tiptap.state.selection.from,
                to: tiptap.state.selection.to,
              },
              inserted.map((block) =>
                blockToNode(
                  block as any,
                  tiptap.schema,
                  editor.schema.styleSchema,
                ).toJSON(),
              ),
              { applyPasteRules: false, applyInputRules: false },
            );
          } catch (error) {
            setPreviewError((error as Error).message);
          }
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        openPasteLink(value);
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input, textarea, select"))
          return;
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
          selectionDragActive.current ||
          e.dataTransfer.types.includes("application/lotion-blocks")
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
        if (
          selectionDragActive.current ||
          e.dataTransfer.types.includes("application/lotion-blocks")
        ) {
          e.preventDefault();
          e.stopPropagation();
          const target = targetAt(e);
          if (target) applyMove(target.id, target.side);
          endSelectionDrag();
          setDropLine(null);
        } else void dropImages(e);
      }}
      onDragEnd={() => {
        endSelectionDrag();
        setDropLine(null);
      }}
      onPointerDown={startRectangle}
    >
      <div className="selection-gutter" aria-label="Drag to select blocks" />
      <div className="editor-tools">
        <div>
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
          <button
            className="quiet"
            onClick={() =>
              void onCopyBlockLink(editor.getTextCursorPosition().block.id)
            }
            title="Copy a direct link to the current block"
          >
            <Link size={14} /> Copy block link
          </button>
        </div>
        <span>Drag across blocks to select them</span>
      </div>
      {!!selected.length && (
        <div
          className="selection-toolbar"
          role="toolbar"
          aria-label="Selected blocks"
          data-block-selection-controls
        >
          <button
            aria-label="Drag selected blocks"
            draggable
            onDragStart={(e) => startSelectionDrag(e.dataTransfer)}
            title="Drag selected blocks"
          >
            <GripVertical size={16} />
            {selected.length} selected
          </button>
          <button
            onClick={() => void copySelectedBlocks(false)}
            aria-label="Copy selected blocks"
            title="Copy selected blocks as Markdown"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={() => void copySelectedBlocks(true)}
            aria-label="Cut selected blocks"
            title="Cut selected blocks as Markdown"
          >
            <Scissors size={16} />
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
      <DatabaseActionsContext.Provider value={databaseActions}>
        <BlockNoteView
          editor={editor}
          editable={!pasteLoading}
          theme={theme}
          formattingToolbar={false}
          slashMenu={false}
          onChange={() => onChange(editor.document as unknown as Block[])}
        >
          <FormattingToolbarController
            formattingToolbar={() => (
              <EditorFormattingToolbar
                shortcuts={formattingShortcuts}
                onApplied={rememberColorStyle}
              />
            )}
          />
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={slashItems}
            // A fading, closing menu keeps Floating UI's resize observer alive
            // while the failed-command status changes layout in WebKit.
            floatingUIOptions={{ useTransitionStylesProps: { duration: 0 } }}
          />
          <SuggestionMenuController
            triggerCharacter="@"
            getItems={atMentionItems}
          />
          <SuggestionMenuController
            triggerCharacter="[["
            getItems={bracketMentionItems}
          />
        </BlockNoteView>
      </DatabaseActionsContext.Provider>
      {dateSelection && (
        <DatePicker
          onCancel={() => {
            setDateSelection(null);
            editor.focus();
          }}
          onInsert={(date) => {
            editor._tiptapEditor.commands.setTextSelection(dateSelection);
            insertLinkChip("", date, {
              kind: "date",
              icon: "📅",
              value: date,
            });
            setDateSelection(null);
            editor.focus();
          }}
        />
      )}
      {fileSelection && (
        <FileReferencePicker
          onCancel={() => {
            setFileSelection(null);
            editor.focus();
          }}
          onInsert={async (file, signal) => {
            const href = await uploadAsset(file, signal);
            if (signal.aborted || !mounted.current) return;
            const size = editor._tiptapEditor.state.doc.content.size;
            editor._tiptapEditor.commands.setTextSelection({
              from: Math.min(fileSelection.from, size),
              to: Math.min(fileSelection.to, size),
            });
            insertLinkChip(href, file.name, {
              kind: "file",
              icon: "📎",
            });
            setFileSelection(null);
            editor.focus();
          }}
        />
      )}
      {pasteChoice && (
        <PasteLinkChooser
          choice={pasteChoice}
          loading={pasteLoading}
          position={pastePosition}
          menuRef={pasteMenu}
          onInsert={insertPastedUrl}
          onCancel={() => {
            cancelPaste();
            editor.focus();
          }}
        />
      )}
      {previewError && <p role="status">{previewError}</p>}
      {previewHref && initial.linkPreviews?.[previewHref] && (
        <LinkPreviewCard
          preview={initial.linkPreviews[previewHref]}
          refreshing={refreshingPreview === previewHref}
          onClose={() => setPreviewHref(null)}
        />
      )}
      <EditorInteractionOverlays
        rectangle={rectangle}
        selectedBoxes={selectedBoxes}
        directLinkBox={directLinkBox}
        dropLine={dropLine}
        host={host}
        uploadState={uploadState}
        failed={failed}
        onCancelUploads={cancelPendingUploads}
        onRetryUpload={finishUpload}
      />
    </div>
  );
}
