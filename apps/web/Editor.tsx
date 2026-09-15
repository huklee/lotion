import {
  ColorStyleButton,
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useCreateBlockNote,
  useEditorState,
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
import {
  displayShortcut,
  matchesFormattingShortcut,
  textColors,
  type FormattingShortcuts,
  type TextColor,
} from "./format-shortcuts";
import {
  rectangleFromPoints,
  rectanglesIntersect,
  sameSelection,
} from "./rectangle-selection";

type AppliedColorStyle = {
  kind: "textColor" | "backgroundColor";
  color: string;
};

const colorLabels = Object.fromEntries(
  textColors.map((color) => [
    color,
    color === "default"
      ? "Default"
      : `${color[0].toUpperCase()}${color.slice(1)}`,
  ]),
) as Record<TextColor, string>;

function ColorLetter({
  textColor,
  backgroundColor,
}: Partial<{ textColor: string; backgroundColor: string }>) {
  return (
    <span
      className="bn-color-icon lotion-color-letter"
      data-text-color={textColor ?? "default"}
      data-background-color={backgroundColor ?? "default"}
    >
      A
    </span>
  );
}

function ShortcutColorStyleButton({
  shortcuts,
  onApplied,
}: {
  shortcuts: FormattingShortcuts;
  onApplied: (style: AppliedColorStyle) => void;
}) {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext()!;
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      textColor: String(editor.getActiveStyles().textColor ?? "default"),
      backgroundColor: String(
        editor.getActiveStyles().backgroundColor ?? "default",
      ),
    }),
  });
  const apply = (kind: AppliedColorStyle["kind"], color: string) => {
    if (color === "default") editor.removeStyles({ [kind]: color });
    else editor.addStyles({ [kind]: color });
    onApplied({ kind, color });
    setTimeout(() => editor.focus());
  };
  return (
    <Components.Generic.Menu.Root>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          className="bn-button"
          label="Colors"
          mainTooltip="Colors"
          icon={
            <ColorLetter
              textColor={active.textColor}
              backgroundColor={active.backgroundColor}
            />
          }
        />
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-color-picker-dropdown">
        <Components.Generic.Menu.Label>
          Text color
        </Components.Generic.Menu.Label>
        {textColors.map((color) => (
          <Components.Generic.Menu.Item
            className="lotion-color-option"
            icon={<ColorLetter textColor={color} />}
            checked={active.textColor === color}
            key={`text-${color}`}
            onClick={() => apply("textColor", color)}
          >
            <span>{colorLabels[color]}</span>
            {!!shortcuts.textColors[color] && (
              <kbd className="color-shortcut-hint">
                {displayShortcut(shortcuts.textColors[color])}
              </kbd>
            )}
          </Components.Generic.Menu.Item>
        ))}
        <Components.Generic.Menu.Label>
          Background color
        </Components.Generic.Menu.Label>
        {textColors.map((color) => (
          <Components.Generic.Menu.Item
            className="lotion-background-option"
            icon={<ColorLetter backgroundColor={color} />}
            checked={active.backgroundColor === color}
            key={`background-${color}`}
            onClick={() => apply("backgroundColor", color)}
          >
            {colorLabels[color]}
          </Components.Generic.Menu.Item>
        ))}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

function ShortcutFormattingToolbar({
  shortcuts,
  onApplied,
}: {
  shortcuts: FormattingShortcuts;
  onApplied: (style: AppliedColorStyle) => void;
}) {
  return (
    <FormattingToolbar>
      {getFormattingToolbarItems().map((item) =>
        item.type === ColorStyleButton ? (
          <ShortcutColorStyleButton
            key="colorStyleButton"
            shortcuts={shortcuts}
            onApplied={onApplied}
          />
        ) : (
          item
        ),
      )}
    </FormattingToolbar>
  );
}

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
  formattingShortcuts,
}: {
  initial: Content;
  onChange: (blocks: Block[]) => void;
  onBackgroundImage: (id: string, url: string, name: string) => void;
  onCreateSubpage: () => Promise<Document>;
  onOpenPage: (id: string) => void;
  onLinkPreview: (url: string, preview: LinkPreview) => void;
  pages: TreeNode[];
  theme: "light" | "dark";
  formattingShortcuts: FormattingShortcuts;
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
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedBoxes, setSelectedBoxes] = useState<
    { id: string; x: number; y: number; w: number; h: number }[]
  >([]);
  const rectangleClick = useRef(false);
  const [rectangle, setRectangle] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
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
  const [pasteChoice, setPasteChoice] = useState<string | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);
  const [dateSelection, setDateSelection] = useState<{
    from: number;
    to: number;
  } | null>(null);
  useEffect(() => {
    let pending: {
      id: string;
      checked: boolean;
      scroller: HTMLElement | null;
      scrollLeft: number;
      scrollTop: number;
      windowX: number;
      windowY: number;
      pointerId: number;
      pointerX: number;
      pointerY: number;
    } | null = null;
    const checkboxAt = (event: Event) => {
      if (!host.current?.contains(event.target as Node)) return;
      const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>(
        '[data-content-type="checkListItem"] input[type="checkbox"]',
      );
      const id = checkbox?.closest<HTMLElement>(".bn-block-outer")?.dataset.id;
      return checkbox && id ? { checkbox, id } : undefined;
    };
    const rememberChecklist = (event: PointerEvent) => {
      const target = checkboxAt(event);
      if (!target) return;
      const block = editor.getBlock(target.id);
      if (block?.type !== "checkListItem") return;
      const scroller = document.querySelector<HTMLElement>(".main-scroll");
      pending = {
        id: target.id,
        checked: block.props.checked !== true,
        scroller,
        scrollLeft: scroller?.scrollLeft ?? 0,
        scrollTop: scroller?.scrollTop ?? 0,
        windowX: window.scrollX,
        windowY: window.scrollY,
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
    };
    const finishChecklist = (event: PointerEvent) => {
      if (
        !pending ||
        event.pointerId !== pending.pointerId ||
        Math.hypot(
          event.clientX - pending.pointerX,
          event.clientY - pending.pointerY,
        ) > 5
      ) {
        pending = null;
        return;
      }
      const change = pending;
      pending = null;
      const restoreScroll = () => {
        if (change.scroller) {
          change.scroller.scrollLeft = change.scrollLeft;
          change.scroller.scrollTop = change.scrollTop;
        }
        window.scrollTo(change.windowX, change.windowY);
      };
      // Run after the browser's click/change sequence so every engine lands on
      // the state captured at pointer-down exactly once.
      requestAnimationFrame(() => {
        const block = editor.getBlock(change.id);
        if (
          block?.type === "checkListItem" &&
          block.props.checked !== change.checked
        )
          editor.updateBlock(change.id, { props: { checked: change.checked } });
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
    };
    window.addEventListener("pointerdown", rememberChecklist, true);
    window.addEventListener("pointerup", finishChecklist, true);
    return () => {
      window.removeEventListener("pointerdown", rememberChecklist, true);
      window.removeEventListener("pointerup", finishChecklist, true);
    };
  }, [editor]);
  useEffect(() => {
    if (!selected.length) return;
    const outside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setSelected([]);
    };
    const removeSelection = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key !== "Backspace" ||
        pasteLoading ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest("input, textarea, select") ||
        (target !== document.body && !host.current?.contains(target))
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const ids: string[] = [];
      const collect = (blocks: Block[]) => {
        for (const block of blocks) {
          if (selected.includes(block.id)) ids.push(block.id);
          else collect(block.children ?? []);
        }
      };
      collect(editor.document as unknown as Block[]);
      if (ids.length) editor.transact(() => editor.removeBlocks(ids));
      setSelected([]);
      editor.focus();
    };
    window.addEventListener("keydown", removeSelection, true);
    window.addEventListener("pointerdown", outside, true);
    return () => {
      window.removeEventListener("keydown", removeSelection, true);
      window.removeEventListener("pointerdown", outside, true);
    };
  }, [selected, pasteLoading, editor]);
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
    const drag = (event: DragEvent) => {
      event.dataTransfer?.setData(
        "application/lotion-blocks",
        JSON.stringify(selected),
      );
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    };
    const sync = () => {
      const blocks = element.querySelectorAll<HTMLElement>(
        ".bn-block-outer[data-id]",
      );
      for (const block of blocks) {
        const active = selected.includes(block.dataset.id!);
        block.removeEventListener("dragstart", drag);
        if (active) {
          block.draggable = true;
          block.addEventListener("dragstart", drag);
        } else block.removeAttribute("draggable");
      }
    };
    sync();
    const firstFrame = requestAnimationFrame(() => {
      sync();
      secondFrame = requestAnimationFrame(sync);
    });
    let secondFrame = 0;
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      for (const block of element.querySelectorAll<HTMLElement>(
        ".bn-block-outer[data-id]",
      )) {
        block.removeEventListener("dragstart", drag);
        block.removeAttribute("draggable");
      }
    };
  }, [selected]);
  useEffect(() => {
    const element = host.current;
    if (!element || !selected.length) {
      setSelectedBoxes([]);
      return;
    }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = [
          ...element.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]"),
        ]
          .filter((block) => selected.includes(block.dataset.id!))
          .map((block) => {
            const rect = block.getBoundingClientRect();
            return {
              id: block.dataset.id!,
              x: rect.x,
              y: rect.y,
              w: rect.width,
              h: rect.height,
            };
          });
        setSelectedBoxes(next);
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
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
    const target = event.target as HTMLElement;
    if (
      event.button !== 0 ||
      target.closest("button, a, input, select, textarea, [draggable=true]")
    )
      return;
    const start = { x: event.clientX, y: event.clientY };
    const startedInText = !!target.closest(
      ".bn-inline-content, [contenteditable=true]",
    );
    const startBlockId = target.closest<HTMLElement>(".bn-block-outer[data-id]")
      ?.dataset.id;
    const pointerId = event.pointerId;
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const baseSelection = additive ? selected : [];
    const scroller = document.querySelector<HTMLElement>(".main-scroll");
    const startDocumentY = start.y + (scroller?.scrollTop ?? 0);
    let lastPoint = start;
    let active = false;
    let autoScrollFrame = 0;
    const update = (point: { x: number; y: number }) => {
      lastPoint = point;
      const scrollTop = scroller?.scrollTop ?? 0;
      const startViewportY = startDocumentY - scrollTop;
      const visibleBox = rectangleFromPoints(
        { x: start.x, y: startViewportY },
        point,
      );
      setRectangle(visibleBox);
      const documentBox = rectangleFromPoints(
        { x: start.x, y: startDocumentY },
        { x: point.x, y: point.y + scrollTop },
      );
      const elements = [
        ...(host.current?.querySelectorAll<HTMLElement>(
          ".bn-block-outer[data-id]",
        ) ?? []),
      ];
      const rawHits = elements.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rectanglesIntersect(documentBox, {
          x: rect.x,
          y: rect.y + scrollTop,
          w: rect.width,
          h: rect.height,
        });
      });
      const hitElements = new Set(rawHits);
      const hits = rawHits
        .filter((element) => {
          let parent = element.parentElement?.closest<HTMLElement>(
            ".bn-block-outer[data-id]",
          );
          while (parent) {
            if (hitElements.has(parent)) return false;
            parent = parent.parentElement?.closest<HTMLElement>(
              ".bn-block-outer[data-id]",
            );
          }
          return true;
        })
        .map((element) => element.dataset.id!);
      const next = additive ? [...new Set([...baseSelection, ...hits])] : hits;
      setSelected((current) => (sameSelection(current, next) ? current : next));
    };
    const autoScroll = () => {
      if (!active || !scroller) return;
      const bounds = scroller.getBoundingClientRect();
      const edge = 48;
      const topDistance = lastPoint.y - bounds.top;
      const bottomDistance = bounds.bottom - lastPoint.y;
      const speed =
        topDistance < edge
          ? -Math.ceil((edge - topDistance) / 3)
          : bottomDistance < edge
            ? Math.ceil((edge - bottomDistance) / 3)
            : 0;
      if (speed) {
        const before = scroller.scrollTop;
        scroller.scrollTop += Math.max(-18, Math.min(18, speed));
        if (scroller.scrollTop !== before) update(lastPoint);
      }
      autoScrollFrame = requestAnimationFrame(autoScroll);
    };
    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      if (!active && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5)
        return;
      if (!active && startedInText && startBlockId) {
        const currentBlockId = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>(".bn-block-outer[data-id]")?.dataset.id;
        if (currentBlockId === startBlockId) return;
      }
      if (!active) {
        active = true;
        rectangleClick.current = true;
        autoScrollFrame = requestAnimationFrame(autoScroll);
      }
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      update({ x: e.clientX, y: e.clientY });
    }
    function end(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      setRectangle(null);
      cancelAnimationFrame(autoScrollFrame);
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
            aliases: ["calendar", "today", "날짜", "달력"],
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
      spellCheck="false"
      onPointerDownCapture={(event) => {
        rectangleClick.current = false;
        const control = (event.target as HTMLElement).closest(
          "input, textarea, select",
        );
        if (control) setSelected([]);
      }}
      onKeyDownCapture={(e) => {
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
            <ShortcutFormattingToolbar
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
      {selectedBoxes.map((box) => (
        <div
          className="block-selection-highlight"
          data-block-id={box.id}
          key={box.id}
          style={{
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
          }}
        />
      ))}
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
