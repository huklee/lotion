import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  LinkPreview,
  TreeNode,
} from "../../packages/document-schema/index";
import { api } from "./api";
import { pageIdFromHash } from "./block-links";
import type { LotionEditor } from "./editor.types";
import type { MentionKind } from "./MentionInline";

type UsePasteLinkOptions = {
  editor: LotionEditor;
  pages: TreeNode[];
  mounted: RefObject<boolean>;
  insertLinkChip: (
    href: string,
    label: string,
    mention?: { kind: MentionKind; icon: string },
  ) => void;
  onLinkPreview: (url: string, preview: LinkPreview) => void;
  setPreviewHref: (href: string | null) => void;
  setPreviewError: (message: string) => void;
};

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

export function usePasteLink({
  editor,
  pages,
  mounted,
  insertLinkChip,
  onLinkPreview,
  setPreviewHref,
  setPreviewError,
}: UsePasteLinkOptions) {
  const [choice, setChoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ from: number; to: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!choice) return;
    const updatePosition = () => {
      const selection = selectionRef.current;
      if (!selection) return;
      const coords = editor._tiptapEditor.view.coordsAtPos(selection.from);
      const width = menuRef.current?.offsetWidth ?? 420;
      const height = menuRef.current?.offsetHeight ?? 52;
      setPosition({
        left: Math.max(8, Math.min(coords.left, window.innerWidth - width - 8)),
        top: Math.max(
          8,
          coords.bottom + height + 16 < window.innerHeight
            ? coords.bottom + 8
            : coords.top - height - 8,
        ),
      });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [choice, editor]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    selectionRef.current = null;
    setLoading(false);
    setChoice(null);
  }, []);

  const open = (href: string) => {
    selectionRef.current = {
      from: editor._tiptapEditor.state.selection.from,
      to: editor._tiptapEditor.state.selection.to,
    };
    setChoice(href);
  };

  const insert = async (asMention: boolean) => {
    if (!choice || loading) return;
    let label = choice;
    const internalId = pageIdFromHref(choice);
    const internalPage = internalId
      ? pages.find((page) => page.id === internalId)
      : undefined;
    if (asMention && internalId) {
      label = internalPage?.title ?? label;
    } else if (asMention) {
      try {
        label = new URL(choice).hostname.replace(/^www\./, "");
      } catch {
        // The URL was validated before the chooser opened.
      }
    }
    if (asMention && !internalId) {
      const abort = new AbortController();
      abortRef.current = abort;
      setLoading(true);
      setPreviewError("");
      try {
        const preview = await api<LinkPreview>("/api/link-preview", {
          method: "POST",
          body: JSON.stringify({ url: choice }),
          signal: abort.signal,
        });
        if (!mounted.current || abort.signal.aborted) return;
        label = preview.title;
        onLinkPreview(choice, preview);
        setPreviewHref(choice);
      } catch {
        if (!mounted.current || abort.signal.aborted) return;
        setPreviewError(
          "Preview unavailable. The link was inserted with its hostname.",
        );
      } finally {
        if (mounted.current) setLoading(false);
      }
    }
    const selection = selectionRef.current;
    if (selection) {
      const size = editor._tiptapEditor.state.doc.content.size;
      editor._tiptapEditor.commands.setTextSelection({
        from: Math.min(selection.from, size),
        to: Math.min(selection.to, size),
      });
    }
    insertLinkChip(
      asMention && internalId ? `#/page/${internalId}` : choice,
      label,
      asMention
        ? {
            kind: internalId ? "page" : "external",
            icon: internalId ? (internalPage?.icon ?? "📄") : "🌐",
          }
        : undefined,
    );
    selectionRef.current = null;
    setChoice(null);
  };

  return { cancel, choice, insert, loading, menuRef, open, position };
}
