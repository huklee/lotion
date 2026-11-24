import { useEffect, useRef, useState, type RefObject } from "react";
import { api } from "./api";
import { matchShortcut } from "./keyboard-layout";
import type { LotionEditor } from "./editor.types";

/** Upload a file as a workspace asset; images must really be images. */
export async function uploadAsset(file: File, signal?: AbortSignal) {
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
}

export type FailedUpload = { file: File; id: string };

/**
 * Images dropped into the editor: a placeholder block per file, uploaded one
 * by one. Failed uploads can be retried; ⌘Z (or Cancel) removes the pending
 * placeholders. An upload that finishes after the editor closed is handed to
 * `onBackgroundImage` so the page is still updated.
 */
export function useImageUploads({
  editor,
  mounted,
  onBackgroundImage,
}: {
  editor: LotionEditor;
  mounted: RefObject<boolean>;
  onBackgroundImage: (id: string, url: string, name: string) => void;
}) {
  const [uploadState, setUploadState] = useState("");
  const [failed, setFailed] = useState<FailedUpload[]>([]);
  const pending = useRef(new Set<string>());

  function cancel() {
    const ids = [...pending.current].filter((id) => editor.getBlock(id));
    pending.current.clear();
    if (ids.length) editor.removeBlocks(ids);
    setFailed([]);
    setUploadState("");
  }

  async function finish(file: File, id: string) {
    try {
      setUploadState(`Uploading ${file.name}…`);
      const url = await uploadAsset(file);
      if (!pending.current.has(id)) return;
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
      pending.current.delete(id);
    }
  }

  /** Insert a placeholder per image next to `target`, then upload them. */
  async function insertAndUpload(
    files: File[],
    target: { id: string; side: "before" | "after" } | null,
  ) {
    const ids = files.map(() => crypto.randomUUID());
    ids.forEach((id) => pending.current.add(id));
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
    for (let i = 0; i < files.length; i++) await finish(files[i], ids[i]);
    setUploadState("");
  }

  // ⌘Z while uploads are pending cancels them (before the editor's own undo)
  useEffect(() => {
    const undo = (event: KeyboardEvent) => {
      if (matchShortcut(event, "Mod+Z") && pending.current.size) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", undo, true);
    return () => window.removeEventListener("keydown", undo, true);
  });

  return {
    uploadState,
    failed,
    hasPending: () => pending.current.size > 0,
    cancel,
    retry: finish,
    insertAndUpload,
  };
}
