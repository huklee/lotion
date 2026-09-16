import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import type { Content } from "../../packages/document-schema/index";
import {
  searchContent,
  type SearchResponse,
  type SearchResult,
} from "../../packages/search/index";
import { api } from "./api";

type WorkspaceSearchPanelProps = {
  query: string;
  setQuery: (query: string) => void;
  activeId?: string;
  activeContent?: Content;
  openResult: (result: SearchResult) => void;
};

const emptyResponse: SearchResponse = { query: "", total: 0, results: [] };

export function WorkspaceSearchPanel({
  query,
  setQuery,
  activeId,
  activeContent,
  openResult,
}: WorkspaceSearchPanelProps) {
  const [remote, setRemote] = useState<SearchResponse>(emptyResponse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const firstResult = useRef<HTMLButtonElement>(null);
  const local = useMemo(
    () =>
      activeId && activeContent && query.trim()
        ? searchContent(activeId, activeContent, query, 50, true)
        : emptyResponse,
    [activeContent, activeId, query],
  );

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setRemote(emptyResponse);
      setLoading(false);
      setError("");
      return;
    }
    setRemote(emptyResponse);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ q: value, limit: "50" });
      if (activeId) params.set("exclude", activeId);
      void api<SearchResponse>(`/api/search?${params}`, {
        signal: controller.signal,
      })
        .then(setRemote)
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(cause instanceof Error ? cause.message : "Search failed");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeId, query]);

  const results = useMemo(
    () =>
      [...local.results, ...remote.results]
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.title.localeCompare(b.title) ||
            (a.blockId ?? "").localeCompare(b.blockId ?? ""),
        )
        .slice(0, 50),
    [local.results, remote.results],
  );
  const total = local.total + remote.total;

  return (
    <>
      <div className="search-input">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Search workspace"
          placeholder="Search titles and document content…"
          maxLength={200}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              firstResult.current?.focus();
            } else if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              openResult(results[0]);
            }
          }}
        />
      </div>
      <p className="search-summary" role="status" aria-live="polite">
        {!query.trim()
          ? "Search every saved page and the current browser draft."
          : loading
            ? "Searching…"
            : `${total} ${total === 1 ? "result" : "results"}`}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="search-results">
        {results.map((result, index) => (
          <button
            ref={index === 0 ? firstResult : undefined}
            key={`${result.documentId}:${result.blockId ?? "title"}:${result.field}`}
            onClick={() => openResult(result)}
          >
            <FileText size={17} />
            <span>
              <strong>
                <span aria-hidden="true">{result.icon || "📄"}</span>{" "}
                {result.title || "Untitled"}
              </strong>
              <small>{result.excerpt || "Untitled"}</small>
            </span>
            <em>
              {result.draft
                ? "Current draft"
                : result.field === "title"
                  ? "Title"
                  : result.field === "mermaid"
                    ? "Mermaid"
                    : "Content"}
            </em>
          </button>
        ))}
        {!!query.trim() && !loading && !error && !results.length && (
          <p>No matching titles or document content.</p>
        )}
      </div>
    </>
  );
}
