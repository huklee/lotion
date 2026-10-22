import { useEffect, useState } from "react";
import { Plus, SquareKanban } from "lucide-react";
import { api } from "../api";
import type { IssueBoard } from "../../../packages/issues/model";

/** The ⌘K palette's issue section: matching issues and "New issue: …". */
export function IssueSearchResults({
  query,
  onOpen,
  onCreate,
}: {
  query: string;
  onOpen: (number: number) => void;
  onCreate: (title: string) => void;
}) {
  const [board, setBoard] = useState<IssueBoard | null>(null);
  const value = query.trim();
  useEffect(() => {
    if (!value) {
      setBoard(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api<IssueBoard>(`/api/issues?${new URLSearchParams({ q: value })}`, {
        signal: controller.signal,
      })
        .then(setBoard)
        // issues are optional here; page search still works without them
        .catch(() => undefined);
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);
  if (!value) return null;
  const issues = (board?.issues ?? [])
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const status = (key: string) =>
    board?.statuses.find((s) => s.key === key)?.name ?? key;
  return (
    <div className="search-results search-issues" aria-label="Issues">
      {issues.map((issue) => (
        <button key={issue.number} onClick={() => onOpen(issue.number)}>
          <SquareKanban size={17} />
          <span>
            <strong>
              #{issue.number} {issue.title}
            </strong>
            <small>{issue.labels.join(", ") || "Issue"}</small>
          </span>
          <em>{status(issue.status)}</em>
        </button>
      ))}
      <button onClick={() => onCreate(value)}>
        <Plus size={17} />
        <span>
          <strong>New issue: “{value.slice(0, 120)}”</strong>
          <small>Creates it in the first column</small>
        </span>
        <em>Issue</em>
      </button>
    </div>
  );
}
