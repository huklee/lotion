import { useState } from "react";
import { api, authHeaders } from "./api";
import { toMarkdown } from "../../packages/markdown/convert";
import type { Content, Document } from "../../packages/document-schema/index";
import type { ImportMode } from "./workspace.types";

type WorkspaceTransferOptions = {
  importMode: ImportMode;
  getCurrentContent: () => Content | undefined;
  flushSaves: () => Promise<void>;
  onImported: (result: {
    documents: Document[];
    warnings: string[];
  }) => Promise<void>;
  onComplete: () => void;
  handleError: (error: unknown) => void;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
};

export function useWorkspaceTransfer({
  importMode,
  getCurrentContent,
  flushSaves,
  onImported,
  onComplete,
  handleError,
  setError,
  setNotice,
}: WorkspaceTransferOptions) {
  const [busy, setBusy] = useState(false);
  async function copyPageMarkdown() {
    const content = getCurrentContent();
    if (!content) return;
    setBusy(true);
    try {
      // Read the current draft, including edits still waiting for auto-save.
      const output = toMarkdown([
        {
          id: "title",
          type: "heading",
          props: { level: 1 },
          content: [
            { type: "text", text: content.title || "Untitled", styles: {} },
          ],
        },
        ...content.blocks,
      ]);
      await navigator.clipboard.writeText(output.markdown);
      setNotice(
        ["Copied this page as Markdown.", ...output.warnings].join(" "),
      );
      onComplete();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportWorkspace(rootId?: string, portable = false) {
    setBusy(true);
    try {
      await flushSaves();
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ rootId, portable }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "lotion-workspace.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      onComplete();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function importFiles(files: { file: File; path: string }[]) {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      for (const item of files)
        body.append(encodeURIComponent(item.path), item.file, item.file.name);
      const result = await api<{ documents: Document[]; warnings: string[] }>(
        `/api/imports?mutationId=${crypto.randomUUID()}&mode=${importMode}`,
        { method: "POST", body },
      );
      await onImported(result);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function dropFolder(event: React.DragEvent) {
    event.preventDefault();
    const items = [...event.dataTransfer.items];
    const files: { file: File; path: string }[] = [];
    async function read(entry: FileSystemEntry, prefix = ""): Promise<void> {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        );
        files.push({ file, path: prefix + entry.name });
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        let found = false;
        while (true) {
          const children: FileSystemEntry[] = await new Promise(
            (resolve, reject) => reader.readEntries(resolve, reject),
          );
          if (!children.length) break;
          found = true;
          for (const child of children)
            await read(child, prefix + entry.name + "/");
        }
        if (!found)
          files.push({
            file: new File([], "directory", {
              type: "application/x-lotion-directory",
            }),
            path: prefix + entry.name + "/",
          });
      }
    }
    try {
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) await read(entry);
        else {
          const file = item.getAsFile();
          if (file) files.push({ file, path: file.name });
        }
      }
      await importFiles(files);
    } catch (e) {
      handleError(e);
    }
  }

  return { busy, copyPageMarkdown, exportWorkspace, importFiles, dropFolder };
}
