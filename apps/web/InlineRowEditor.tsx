import { useContext, useEffect, useRef, useState } from "react";
import type { Document } from "../../packages/document-schema/index";
import Editor from "./Editor";
import { RowPagesContext } from "./row-pages";
import type { SaveCoordinator } from "./save-coordinator";

/**
 * A row page edited inside a database feed. It shares the page's save coordinator
 * with the main editor, so drafts, retries and conflicts behave the same way.
 */
export function InlineRowEditor({ pageId }: { pageId: string }) {
  const rowPages = useContext(RowPagesContext);
  const [coordinator, setCoordinator] = useState<SaveCoordinator | null>(null);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  // Pointer events inside this editor must not reach the page's own editor, which
  // would otherwise select the whole database block or start a block selection.
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const stop = (event: Event) => event.stopPropagation();
    const types = ["mousedown", "pointerdown", "click", "dblclick"];
    for (const type of types) element.addEventListener(type, stop);
    return () => {
      for (const type of types) element.removeEventListener(type, stop);
    };
  });
  useEffect(() => {
    if (!rowPages) return;
    let alive = true;
    rowPages
      .coordinator(pageId)
      .then((next) => alive && setCoordinator(next))
      .catch((reason) => alive && setError((reason as Error).message));
    return () => {
      alive = false;
    };
    // The coordinator is resolved once per page; context changes only bump versions.
  }, [pageId]);
  if (!rowPages) return null;
  if (error) return <p role="alert">{error}</p>;
  if (!coordinator) return <p className="lotion-feed-loading">Loading…</p>;
  if (coordinator.status === "Conflict")
    return (
      <p role="alert">
        This meeting has a save conflict.{" "}
        <button type="button" onClick={() => rowPages.openPage(pageId)}>
          Open the page to resolve it
        </button>
      </p>
    );
  const c = coordinator;
  return (
    <div ref={box} className="lotion-feed-editor" data-row-page={pageId}>
      <Editor
        key={`${pageId}:${c.editorVersion}`}
        initial={c.content}
        theme={rowPages.theme}
        formattingShortcuts={rowPages.formattingShortcuts}
        pages={rowPages.pages}
        onCreateSubpage={(title) => rowPages.createSubpage(pageId, title)}
        onCopyBlockLink={(blockId) => rowPages.copyBlockLink(pageId, blockId)}
        onOpenPage={rowPages.openPage}
        onLinkPreview={(url, preview) =>
          c.edit({
            ...c.content,
            linkPreviews: { ...c.content.linkPreviews, [url]: preview },
          })
        }
        onChange={(blocks) => c.edit({ ...c.content, blocks })}
        onBackgroundImage={(id, url, name) => {
          let found = false;
          const update = (blocks: Document["blocks"]): Document["blocks"] =>
            blocks.map((block) => {
              if (block.id === id) {
                found = true;
                return {
                  ...block,
                  props: { ...block.props, url, name, caption: "" },
                };
              }
              return { ...block, children: update(block.children ?? []) };
            });
          const blocks = update(c.content.blocks);
          if (found) c.edit({ ...c.content, blocks });
        }}
      />
    </div>
  );
}
