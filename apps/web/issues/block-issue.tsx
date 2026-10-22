import { createContext, useEffect, useState } from "react";
import { X } from "lucide-react";
import { issuesApi } from "./issues-api";
import { goToIssues } from "./issues-route";

/**
 * The page an editor belongs to, so the block menu can make an issue from a
 * block (ADR-026 stage 4). Row pages in a feed provide their own page.
 */
export const BlockIssueContext = createContext<{
  pageId: string;
  pageTitle: string;
} | null>(null);

const CREATED = "lotion:issue-created";

type InlineNode = {
  type?: string;
  text?: string;
  content?: InlineNode[];
  props?: Record<string, unknown>;
};
type BlockLike = { id: string; content?: unknown; children?: BlockLike[] };

/** Plain text of BlockNote inline content (mentions by their label). */
export function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as InlineNode[])
    .map((node) =>
      typeof node.text === "string"
        ? node.text
        : node.content
          ? inlineText(node.content)
          : typeof node.props?.label === "string"
            ? node.props.label
            : "",
    )
    .join("");
}

/** Title from the block's first line; nested blocks become the description. */
export function issueFromBlock(block: BlockLike, pageTitle: string) {
  const text = inlineText(block.content).trim();
  const title = (text.split("\n")[0] || "Untitled block").slice(0, 300);
  const nested: string[] = [];
  const walk = (children: BlockLike[] | undefined, depth: number) => {
    for (const child of children ?? []) {
      const line = inlineText(child.content).trim();
      if (line) nested.push(`${"  ".repeat(depth)}- ${line}`);
      walk(child.children, depth + 1);
    }
  };
  walk(block.children, 0);
  const rest = text.split("\n").slice(1).join("\n").trim();
  const body = [rest, nested.join("\n"), `From “${pageTitle || "Untitled"}”.`]
    .filter(Boolean)
    .join("\n\n");
  return { title, body };
}

export async function createIssueFromBlock(
  block: BlockLike,
  page: { pageId: string; pageTitle: string },
) {
  const { title, body } = issueFromBlock(block, page.pageTitle);
  try {
    const issue = await issuesApi.create({
      title,
      body,
      links: [page.pageId],
      source: { pageId: page.pageId, blockId: block.id },
    });
    window.dispatchEvent(
      new CustomEvent(CREATED, {
        detail: { number: issue.number, title: issue.title },
      }),
    );
    return issue;
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent(CREATED, {
        detail: { error: (error as Error).message || "unknown error" },
      }),
    );
    return null;
  }
}

/** "Created #12 … Open" after an issue was made from a block. */
export function IssueCreatedToast({
  onOpen = goToIssues,
}: {
  onOpen?: (number: number) => void;
}) {
  const [created, setCreated] = useState<{
    number?: number;
    title?: string;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let timer = 0;
    const show = (event: Event) => {
      setCreated((event as CustomEvent).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCreated(null), 8000);
    };
    window.addEventListener(CREATED, show);
    return () => {
      window.removeEventListener(CREATED, show);
      window.clearTimeout(timer);
    };
  }, []);
  if (!created) return null;
  if (created.error)
    return (
      <div className="issue-toast error" role="alert">
        <span>Could not create the issue: {created.error}</span>
        <button aria-label="Dismiss" onClick={() => setCreated(null)}>
          <X size={14} />
        </button>
      </div>
    );
  return (
    <div className="issue-toast" role="status">
      <span>
        Created issue <b>#{created.number}</b> {created.title}
      </span>
      <button
        onClick={() => {
          setCreated(null);
          onOpen(created.number!);
        }}
      >
        Open
      </button>
      <button aria-label="Dismiss" onClick={() => setCreated(null)}>
        <X size={14} />
      </button>
    </div>
  );
}

export const ISSUE_CREATED_EVENT = CREATED;
