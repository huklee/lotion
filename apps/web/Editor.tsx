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
import { clipboardLines } from "./clipboard-lines";
import { DatePicker } from "./DatePicker";
import { blockToNode } from "@blocknote/core";
import { contentSchema } from "../../packages/document-schema/index";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Layers,
  Link,
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
import { moveBlocks, sectionIds } from "../../packages/editor-adapter/movement";
import { api, authHeaders } from "./api";
import { editorSchema } from "./editor-schema";
import {
  matchesFormattingShortcut,
  textColors,
  type FormattingShortcuts,
} from "./format-shortcuts";
import { blockIdFromHash, pageIdFromHash } from "./block-links";
import { useBlockSelection } from "./use-block-selection";
import { useDirectBlockLinkTarget } from "./use-direct-block-link";
import {
  EditorFormattingToolbar,
  type AppliedColorStyle,
} from "./EditorFormattingToolbar";
import { normalizeEditorContent } from "./normalize-editor-content";

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
  onCreateSubpage: () => Promise<Document>;
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
  const lastColorStyle = useRef<AppliedColorStyle | null>(null);
  const mounted = useRef(true);
  const host = useRef<HTMLDivElement>(null);
  const [uploadState, setUploadState] = useState("");
  const applyColorStyle = useCallback(
    (style: AppliedColorStyle) => {
      if (style.color === "default")
        editor.removeStyles({ [style.kind]: style.color });
      else editor.addStyles({ [style.kind]: style.color });
      lastColorStyle.current = style;
    },
    [editor],
  );
  const [failed, setFailed] = useState<{ file: File; id: string }[]>([]);
  const [dropLine, setDropLine] = useState<number | null>(null);
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
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
    rectangle,
    rectangleClick,
    selected,
    selectedBoxes,
    setSelected,
    startRectangle,
  } = useBlockSelection({ editor, host, pasteLoading });
  const directLinkBox = useDirectBlockLinkTarget(host);
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
  const {
    slashItems,
    atMentionItems,
    bracketMentionItems,
    dateSelection,
    setDateSelection,
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
        const color = textColors.find((candidate) =>
          matchesFormattingShortcut(
            e.nativeEvent,
            formattingShortcuts.textColors[candidate],
          ),
        );
        if (color) {
          e.preventDefault();
          e.stopPropagation();
          applyColorStyle({ kind: "textColor", color });
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
            const blocks = clipboardLines(raw);
            const current = editor.getTextCursorPosition().block;
            // Inserting paragraph nodes at an inline checklist selection
            // changes the containing block into a paragraph. Keep checklist
            // semantics for every pasted line instead.
            const inserted =
              current.type === "checkListItem"
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
            // Insert schema nodes directly: pasteHTML still applies Markdown
            // paste rules such as **bold**, even for otherwise plain paragraphs.
            const tiptap = editor._tiptapEditor;
            if (blocks.length === 1) {
              tiptap.commands.insertContentAt(
                {
                  from: tiptap.state.selection.from,
                  to: tiptap.state.selection.to,
                },
                { type: "text", text: raw },
                { applyPasteRules: false, applyInputRules: false },
              );
              return;
            }
            if (current.type === "checkListItem") {
              const lines = raw.replace(/\r\n?/g, "\n").split("\n");
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
        if (e.dataTransfer.types.includes("application/lotion-blocks")) {
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
        >
          <button
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData(
                "application/lotion-blocks",
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
        formattingToolbar={false}
        slashMenu={false}
        onChange={() => onChange(editor.document as unknown as Block[])}
      >
        <FormattingToolbarController
          formattingToolbar={() => (
            <EditorFormattingToolbar
              shortcuts={formattingShortcuts}
              onApplied={(style) => {
                lastColorStyle.current = style;
              }}
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
      {dateSelection && (
        <DatePicker
          onCancel={() => {
            setDateSelection(null);
            editor.focus();
          }}
          onInsert={(date) => {
            editor._tiptapEditor.commands.setTextSelection(dateSelection);
            editor.insertInlineContent(`📅 ${date} `);
            setDateSelection(null);
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
