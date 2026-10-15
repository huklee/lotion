import { useEffect, useMemo, useRef, useState } from "react";
import changelogSource from "../../docs/changelog.md?raw";
import {
  compareVersions,
  parseBody,
  parseChangelog,
  parseInline,
  safeHref,
  type Release,
} from "../../packages/changelog/parse";

const REPO = "https://github.com/huklee/lotion";
const DOCS = `${REPO}/blob/main/docs/`;
const SEEN_KEY = "lotion-seen-version";

export const APP_VERSION = __LOTION_VERSION__;

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) => {
        if (part.kind === "strong")
          return <strong key={index}>{part.text}</strong>;
        if (part.kind === "code") return <code key={index}>{part.text}</code>;
        if (part.kind === "link") {
          const href = safeHref(part.href, DOCS);
          return href ? (
            <a key={index} href={href} target="_blank" rel="noreferrer">
              {part.text}
            </a>
          ) : (
            <span key={index}>{part.text}</span>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

function ReleaseBody({ release }: { release: Release }) {
  const blocks = useMemo(() => parseBody(release.body), [release.body]);
  return (
    <div className="version-release-body">
      {blocks.map((block, index) =>
        block.kind === "heading" ? (
          <h4 key={index}>{block.text}</h4>
        ) : block.kind === "item" ? (
          <p
            key={index}
            className="version-item"
            style={{ marginLeft: block.depth * 14 }}
          >
            <Inline text={block.text} />
          </p>
        ) : (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        ),
      )}
    </div>
  );
}

/**
 * The running version in the bottom bar. A dot marks a version the viewer has not
 * opened yet; the panel lists every release with its pull request and changes.
 */
export function VersionButton() {
  const releases = useMemo(() => parseChangelog(changelogSource), []);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const unseen = !seen || compareVersions(seen, APP_VERSION) < 0;

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
    } catch {
      /* the dot simply stays */
    }
    setSeen(APP_VERSION);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target))
        setOpen(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    panel.current?.querySelector<HTMLElement>("input")?.focus();
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
      button.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? releases.filter((release) =>
        `${release.version} ${release.date} #${release.pr ?? ""} ${release.body}`
          .toLowerCase()
          .includes(needle),
      )
    : releases;
  const previousSeen = seen && seen !== APP_VERSION ? seen : "";
  const built = new Date(__LOTION_BUILT_AT__);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="version-button"
        aria-label={`Version ${APP_VERSION} — what's new`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        v{APP_VERSION}
        {unseen && <span className="version-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div
          ref={panel}
          className="version-panel"
          role="dialog"
          aria-label="What's new"
        >
          <header>
            <div>
              <strong>Lotion {APP_VERSION}</strong>
              <small>
                {__LOTION_COMMIT__ && <>build {__LOTION_COMMIT__} · </>}
                {Number.isNaN(built.valueOf())
                  ? ""
                  : built.toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
              </small>
            </div>
            <button
              type="button"
              aria-label="Close what's new"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <input
            type="search"
            aria-label="Search changes"
            placeholder="Search changes, versions or #PR"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="version-list">
            {shown.length === 0 && (
              <p className="version-empty">No release mentions “{query}”.</p>
            )}
            {shown.map((release, index) => {
              const isNew =
                !!previousSeen &&
                compareVersions(release.version, previousSeen) > 0;
              return (
                <details
                  key={release.version}
                  className="version-release"
                  open={index === 0 || isNew || !!needle}
                >
                  <summary>
                    <span className="version-number">{release.version}</span>
                    {release.version === APP_VERSION && (
                      <span className="version-tag">current</span>
                    )}
                    {isNew && <span className="version-tag new">new</span>}
                    <span className="version-date">{release.date}</span>
                    {release.pr && (
                      <a
                        href={`${REPO}/pull/${release.pr}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        #{release.pr}
                      </a>
                    )}
                  </summary>
                  <ReleaseBody release={release} />
                </details>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
