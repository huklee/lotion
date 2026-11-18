import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Block } from "../../packages/document-schema/index";
import {
  WRAP_KINDS,
  WRAP_LABELS,
  addWrap,
  removeWrap,
  renderWiki,
  updateWrap,
  validWraps,
  type Wrap,
  type WrapKind,
  type WikiUnit,
} from "../../packages/confluence/wiki";
import { prefs } from "./browser-prefs";

type Selection =
  | { type: "range"; anchor: string; focus: string }
  | { type: "wrap"; id: string }
  | null;

const wrapsPref = (pageId: string) => `confluence-wraps:${pageId}`;

function readWraps(pageId: string): Wrap[] {
  return prefs.json<Wrap[]>(wrapsPref(pageId), [], (value) =>
    Array.isArray(value) ? (value as Wrap[]) : null,
  );
}

/**
 * The open page as a Confluence wiki page. Click a block (Shift-click to
 * extend) and turn the selection into an Expand or a panel; click a macro's
 * frame to rename it, change its kind or remove it. Layout choices are kept
 * per page in this browser; the page itself is not changed.
 */
export function ConfluenceWikiView({
  pageId,
  title,
  blocks,
  onClose,
  onCopied,
}: {
  pageId: string;
  title: string;
  blocks: Block[];
  onClose: () => void;
  onCopied: (message: string) => void;
}) {
  const [wraps, setWraps] = useState<Wrap[]>(() =>
    validWraps(blocks, readWraps(pageId)),
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<"wiki" | "markup">("wiki");
  const page = useMemo(
    () =>
      renderWiki(title, blocks, wraps, {
        linkBase: `${location.origin}${location.pathname}`,
      }),
    [title, blocks, wraps],
  );
  const order = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const save = (next: Wrap[]) => {
    setWraps(next);
    prefs.setJson(wrapsPref(pageId), next);
  };

  const selectedRange = useMemo(() => {
    if (selection?.type !== "range") return new Set<string>();
    const a = order.indexOf(selection.anchor);
    const b = order.indexOf(selection.focus);
    return new Set(order.slice(Math.min(a, b), Math.max(a, b) + 1));
  }, [selection, order]);
  const selectedWrap =
    selection?.type === "wrap"
      ? wraps.find((w) => w.id === selection.id)
      : undefined;

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (selection) setSelection(null);
      else onClose();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [selection, onClose]);

  const pickUnit = (event: MouseEvent, id: string) => {
    event.stopPropagation();
    // links inside the page stay inert here
    if ((event.target as HTMLElement).closest("a")) event.preventDefault();
    setSelection((current) =>
      event.shiftKey && current?.type === "range"
        ? { ...current, focus: id }
        : { type: "range", anchor: id, focus: id },
    );
  };

  const apply = (kind: WrapKind) => {
    if (selection?.type === "range") {
      const id = crypto.randomUUID();
      save(addWrap(blocks, wraps, kind, selection.anchor, selection.focus, id));
      setSelection({ type: "wrap", id });
    } else if (selectedWrap) {
      save(updateWrap(wraps, selectedWrap.id, { kind }));
    }
  };

  async function copyMarkup() {
    try {
      await navigator.clipboard.writeText(page.markup);
      onCopied("Copied the page as Confluence wiki markup.");
    } catch (error) {
      onCopied(`Could not copy: ${(error as Error).message}`);
    }
  }

  function downloadMarkup() {
    const url = URL.createObjectURL(
      new Blob([page.markup], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title || "Untitled").replace(/[\\/:*?"<>|]+/g, "_").trim() || "Untitled"}.confluence.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const unit = (u: WikiUnit) =>
    u.html ? (
      <div
        key={u.id}
        className={`cf-unit${selectedRange.has(u.id) ? " selected" : ""}`}
        data-block-id={u.id}
        onClick={(event) => pickUnit(event, u.id)}
        dangerouslySetInnerHTML={{ __html: u.html }}
      />
    ) : null;

  const count = selectedRange.size;
  return (
    <div
      className="cf-view"
      role="dialog"
      aria-modal="true"
      aria-label="Confluence wiki view"
    >
      <header className="cf-view-bar">
        <strong>Confluence wiki view</strong>
        <div role="tablist" aria-label="Confluence view mode">
          <button
            role="tab"
            aria-selected={tab === "wiki"}
            onClick={() => setTab("wiki")}
          >
            Wiki
          </button>
          <button
            role="tab"
            aria-selected={tab === "markup"}
            onClick={() => setTab("markup")}
          >
            Wiki markup
          </button>
        </div>
        <span className="cf-view-actions">
          {wraps.length > 0 && (
            <button
              onClick={() => {
                save([]);
                setSelection(null);
              }}
              title="Remove every Expand and panel on this page"
            >
              Reset layout
            </button>
          )}
          <button onClick={downloadMarkup}>Download .txt</button>
          <button className="primary" onClick={() => void copyMarkup()}>
            Copy wiki markup
          </button>
          <button
            className="icon-button"
            aria-label="Close Confluence view"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </span>
      </header>
      {tab === "wiki" && (
        <div
          className="cf-toolbar"
          role="toolbar"
          aria-label="Confluence layout"
        >
          {selection === null ? (
            <span className="cf-hint">
              Click a block (Shift-click for several), then choose a format.
            </span>
          ) : (
            <>
              <span className="cf-hint">
                {selectedWrap
                  ? `${WRAP_LABELS[selectedWrap.kind]} selected`
                  : `${count} block${count === 1 ? "" : "s"} selected`}
              </span>
              {WRAP_KINDS.map((kind) => (
                <button
                  key={kind}
                  className={`cf-kind cf-kind-${kind}`}
                  aria-pressed={selectedWrap?.kind === kind}
                  onClick={() => apply(kind)}
                >
                  {WRAP_LABELS[kind]}
                </button>
              ))}
              {selectedWrap && (
                <>
                  <input
                    aria-label="Macro title"
                    placeholder="Title"
                    value={selectedWrap.title}
                    onChange={(event) =>
                      save(
                        updateWrap(wraps, selectedWrap.id, {
                          title: event.target.value,
                        }),
                      )
                    }
                  />
                  <button
                    onClick={() => {
                      save(removeWrap(wraps, selectedWrap.id));
                      setSelection(null);
                    }}
                  >
                    Remove
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
      {tab === "wiki" ? (
        <div className="cf-scroll" onClick={() => setSelection(null)}>
          <article className="cf-page">
            <h1>{title || "Untitled"}</h1>
            {page.parts.map((part) => {
              if (part.type === "unit") return unit(part.unit);
              const { wrap, units } = part;
              const picked = selectedWrap?.id === wrap.id;
              const pick = (event: MouseEvent) => {
                event.stopPropagation();
                if (event.shiftKey && selection?.type === "range")
                  setSelection({
                    ...selection,
                    focus: wrap.blockIds[wrap.blockIds.length - 1],
                  });
                else setSelection({ type: "wrap", id: wrap.id });
              };
              const body = (
                <div className="cf-macro-body">{units.map(unit)}</div>
              );
              return wrap.kind === "expand" ? (
                <section
                  key={wrap.id}
                  className={`cf-expand${picked ? " selected" : ""}`}
                  data-wrap={wrap.kind}
                  onClick={pick}
                >
                  <div className="cf-expand-title">
                    <ChevronDown size={14} />
                    {wrap.title.trim() || "Click here to expand..."}
                  </div>
                  {body}
                </section>
              ) : (
                <section
                  key={wrap.id}
                  className={`cf-panel cf-${wrap.kind}${picked ? " selected" : ""}`}
                  data-wrap={wrap.kind}
                  onClick={pick}
                >
                  {wrap.title.trim() && (
                    <div className="cf-panel-title">{wrap.title.trim()}</div>
                  )}
                  {body}
                </section>
              );
            })}
          </article>
        </div>
      ) : (
        <pre className="cf-storage" aria-label="Confluence wiki markup">
          {page.markup}
        </pre>
      )}
    </div>
  );
}
