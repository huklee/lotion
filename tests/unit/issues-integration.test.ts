import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATUSES,
  archiveColumn,
  createIssue,
  issuesToMarkdown,
  matches,
  normalizeIssue,
  patchIssue,
  renameLabel,
  setStatuses,
  type Issue,
} from "../../packages/issues/model";
import { inlineText, issueFromBlock } from "../../apps/web/issues/block-issue";
import { statusKey } from "../../apps/web/issues/IssueSettings";

const clock = { now: "2026-10-22T09:00:00.000Z", id: () => "n" };
function seed(): Issue[] {
  const issues: Issue[] = [];
  const add = (input: Parameters<typeof createIssue>[3]) =>
    issues.push(
      createIssue(
        issues,
        DEFAULT_STATUSES,
        issues.length + 1,
        input,
        "me",
        clock,
      ),
    );
  add({ title: "One", labels: ["Bug", "ui"], links: ["page-a"] });
  add({
    title: "Two",
    status: "done",
    labels: ["bug"],
    source: { pageId: "page-b", blockId: "blk" },
  });
  add({ title: "Three", status: "done" });
  return issues;
}

describe("links, source and archive", () => {
  it("stores links and the source block and filters by page", () => {
    const issues = seed();
    expect(issues[0].links).toEqual(["page-a"]);
    expect(issues[1].source).toEqual({ pageId: "page-b", blockId: "blk" });
    expect(matches(issues[0], { page: "page-a" })).toBe(true);
    expect(matches(issues[1], { page: "page-b" })).toBe(true);
    expect(matches(issues[2], { page: "page-a" })).toBe(false);
    expect(() =>
      createIssue(
        [],
        DEFAULT_STATUSES,
        9,
        { title: "x", links: ["bad id!"] },
        "me",
        clock,
      ),
    ).toThrow(/Invalid page id/);
  });

  it("archives a column, hides archived by default and unarchives", () => {
    const issues = seed();
    const archived = archiveColumn(issues, "done", "me", clock);
    expect(archived.map((i) => i.number)).toEqual([2, 3]);
    expect(archived[0].archivedAt).toBe(clock.now);
    expect(matches(archived[0], {})).toBe(false);
    expect(matches(archived[0], { archived: "include" })).toBe(true);
    expect(matches(issues[0], { archived: "only" })).toBe(false);
    const [back] = patchIssue(
      archived,
      DEFAULT_STATUSES,
      2,
      { archived: false },
      "me",
      clock,
    );
    expect(back.archivedAt).toBeNull();
    // an old file without the new fields
    const { links: _l, archivedAt: _a, ...old } = issues[0];
    expect(normalizeIssue(old as Issue)).toMatchObject({
      links: [],
      archivedAt: null,
    });
  });
});

describe("board settings", () => {
  it("renames, recolours, reorders and adds statuses; refuses removing a used one", () => {
    const issues = seed();
    const next = setStatuses(issues, [
      { key: "backlog", name: "Inbox", color: "gray" },
      { key: "waiting", name: "Waiting", color: "purple" },
      { key: "todo", name: "Todo", color: "yellow" },
      { key: "doing", name: "Doing", color: "blue" },
      { key: "done", name: "Done", color: "green" },
    ]);
    expect(next.map((s) => s.name)).toEqual([
      "Inbox",
      "Waiting",
      "Todo",
      "Doing",
      "Done",
    ]);
    expect(() =>
      setStatuses(issues, [
        { key: "backlog", name: "Backlog", color: "gray" },
        { key: "todo", name: "Todo", color: "yellow" },
      ]),
    ).toThrow(/Move the issues out of done/);
    expect(() =>
      setStatuses(issues, [
        { key: "a", name: "A", color: "gray" },
        { key: "a", name: "B", color: "gray" },
      ]),
    ).toThrow(/unique/);
    expect(() =>
      setStatuses(issues, [{ key: "a", name: "A", color: "gray" }]),
    ).toThrow(/at least two/);
    expect(statusKey("Waiting on 고객", ["waiting-on"])).toBe("waiting-on-2");
  });

  it("renames and deletes labels everywhere", () => {
    const issues = seed();
    const renamed = renameLabel(issues, "BUG", "defect", "me", clock);
    expect(renamed.map((i) => [i.number, i.labels])).toEqual([
      [1, ["defect", "ui"]],
      [2, ["defect"]],
    ]);
    expect(renamed[0].version).toBe(2);
    const removed = renameLabel(issues, "ui", null, "me", clock);
    expect(removed.map((i) => i.labels)).toEqual([["Bug"]]);
  });

  it("exports Markdown with sections, tags and notes", () => {
    const md = issuesToMarkdown(seed(), DEFAULT_STATUSES, clock.now);
    expect(md).toContain("## Backlog (1)");
    expect(md).toContain("### #1 One");
    expect(md).toContain("_labels: Bug, ui_");
    expect(md).toContain("## Done (2)");
    expect(md).toContain("**me** (created): Created");
  });
});

describe("issues from blocks", () => {
  it("uses the first line as title and nested blocks as the description", () => {
    const block = {
      id: "b1",
      content: [
        { type: "text", text: "Fix " },
        { type: "mention", props: { label: "Paste" } },
        { type: "text", text: " engine\nsecond line" },
      ],
      children: [
        { id: "c1", content: [{ type: "text", text: "repro steps" }] },
        {
          id: "c2",
          content: [{ type: "text", text: "logs" }],
          children: [{ id: "c3", content: [{ type: "text", text: "trace" }] }],
        },
      ],
    };
    expect(inlineText(block.content)).toBe("Fix Paste engine\nsecond line");
    expect(issueFromBlock(block, "Monday sync")).toEqual({
      title: "Fix Paste engine",
      body: "second line\n\n- repro steps\n- logs\n  - trace\n\nFrom “Monday sync”.",
    });
    expect(issueFromBlock({ id: "e", content: [] }, "").title).toBe(
      "Untitled block",
    );
  });
});
