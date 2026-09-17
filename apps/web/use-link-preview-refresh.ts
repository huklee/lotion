import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkPreview } from "../../packages/document-schema/index";
import { LINK_PREVIEW_CACHE_TTL_MS } from "../../packages/link-preview/constants";
import { api } from "./api";
import type { LotionEditor } from "./editor.types";

type LinkPreviewRefreshOptions = {
  editor: LotionEditor;
  previews: Record<string, LinkPreview> | undefined;
  onLinkPreview: (url: string, preview: LinkPreview) => void;
  setPreviewError: (message: string) => void;
};

function replaceExternalMentionLabel(
  editor: LotionEditor,
  href: string,
  label: string,
) {
  let changed = false;
  const update = (value: any): any => {
    if (Array.isArray(value)) return value.map(update);
    if (!value || typeof value !== "object") return value;
    if (
      value.type === "mention" &&
      value.props?.kind === "external" &&
      value.props.href === href &&
      value.props.label !== label
    ) {
      changed = true;
      return { ...value, props: { ...value.props, label } };
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, update(item)]),
    );
  };
  const blocks = update(editor.document);
  if (changed) editor.replaceBlocks(editor.document, blocks);
}

export function useLinkPreviewRefresh({
  editor,
  previews,
  onLinkPreview,
  setPreviewError,
}: LinkPreviewRefreshOptions) {
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  const [refreshingPreview, setRefreshingPreview] = useState<string | null>(
    null,
  );
  const refreshes = useRef(new Map<string, AbortController>());
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      refreshes.current.forEach((controller) => controller.abort());
    };
  }, []);

  const showLinkPreview = useCallback(
    (href: string) => {
      const preview = previews?.[href];
      if (!preview) return;
      setPreviewHref(href);
      const fetchedAt = preview.fetchedAt
        ? Date.parse(preview.fetchedAt)
        : Number.NaN;
      if (
        Number.isFinite(fetchedAt) &&
        Date.now() - fetchedAt < LINK_PREVIEW_CACHE_TTL_MS
      )
        return;
      if (refreshes.current.has(href)) return;
      const controller = new AbortController();
      refreshes.current.set(href, controller);
      setRefreshingPreview(href);
      void api<LinkPreview>("/api/link-preview", {
        method: "POST",
        body: JSON.stringify({ url: href }),
        signal: controller.signal,
      })
        .then((next) => {
          if (!active.current || controller.signal.aborted) return;
          replaceExternalMentionLabel(editor, href, next.title);
          onLinkPreview(href, next);
        })
        .catch(() => {
          if (active.current && !controller.signal.aborted)
            setPreviewError(
              "Could not refresh this preview; showing saved metadata.",
            );
        })
        .finally(() => {
          refreshes.current.delete(href);
          if (active.current)
            setRefreshingPreview((current) =>
              current === href ? null : current,
            );
        });
    },
    [editor, onLinkPreview, previews, setPreviewError],
  );

  return {
    previewHref,
    refreshingPreview,
    setPreviewHref,
    showLinkPreview,
  };
}
