import { useCallback, useEffect, useState } from "react";
import { SquareKanban } from "lucide-react";
import { pillStyle } from "../database-ui";
import type { IssueBoard } from "../../../packages/issues/model";
import { issuesApi } from "./issues-api";
import { ISSUE_CREATED_EVENT } from "./block-issue";

const STATUS_COLOR: Record<string, string> = {
  gray: "gray",
  yellow: "yellow",
  blue: "blue",
  green: "green",
};

/** Issues linked to (or made from) a page, shown under its title. */
export function PageIssues({
  pageId,
  onOpen,
}: {
  pageId: string;
  onOpen: (number: number) => void;
}) {
  const [board, setBoard] = useState<IssueBoard | null>(null);
  const load = useCallback(() => {
    issuesApi
      .forPage(pageId)
      .then(setBoard)
      // issues are an extra here; the page works without them
      .catch(() => setBoard(null));
  }, [pageId]);
  useEffect(() => {
    load();
    const visible = () => document.visibilityState === "visible" && load();
    window.addEventListener(ISSUE_CREATED_EVENT, load);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener(ISSUE_CREATED_EVENT, load);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  if (!board?.issues.length) return null;
  const status = (key: string) => board.statuses.find((s) => s.key === key);
  return (
    <nav className="page-issues" aria-label="Linked issues">
      <SquareKanban size={14} aria-hidden="true" />
      {board.issues
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((issue) => {
          const s = status(issue.status);
          return (
            <button
              key={issue.number}
              className={`page-issue${issue.archivedAt ? " archived" : ""}`}
              onClick={() => onOpen(issue.number)}
            >
              <span className="issue-number">#{issue.number}</span>
              <span className="page-issue-title">{issue.title}</span>
              {s && (
                <span
                  className="issue-label"
                  style={pillStyle(STATUS_COLOR[s.color] ?? s.color ?? "gray")}
                >
                  {s.name}
                </span>
              )}
            </button>
          );
        })}
    </nav>
  );
}
