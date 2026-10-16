import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../../apps/server/app";
import {
  SummaryService,
  composePrompt,
  pickBlocks,
  type Engine,
} from "../../apps/server/summaries";
import { Repository } from "../../packages/persistence/repository";

let dir: string;
let repo: Repository;
let app: Awaited<ReturnType<typeof createApp>>;
let calls: { engine: Engine; prompt: string }[];
let notes: { channel: string; text: string }[];
let fail: string | null;

const para = (id: string, text: string, children: any[] = []) => ({
  id,
  type: "paragraph",
  content: [{ type: "text", text, styles: {} }],
  children,
});

async function page(title: string, parentId: string | null, blocks: any[]) {
  const doc = await repo.create(title, parentId, randomUUID());
  return repo.save(
    doc.id,
    doc.revision,
    { title, blocks, linkPreviews: {} } as any,
    randomUUID(),
  );
}

async function waitFor(id: string) {
  for (let i = 0; i < 100; i++) {
    const job = (await app.inject({ url: `/api/summary/jobs/${id}` })).json();
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("job did not finish");
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-summary-"));
  await fs.mkdir(path.join(dir, "skills", "minutes"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "skills", "minutes", "SKILL.md"),
    "---\nname: minutes\ndescription: Confluence minutes\n---\nUse the house style.\n",
  );
  calls = [];
  notes = [];
  fail = null;
  repo = await new Repository(path.join(dir, "data")).init();
  const summaries = new SummaryService(repo, {
    dataDir: path.join(dir, "data"),
    skillDirs: [path.join(dir, "skills")],
    runner: async (engine, prompt) => {
      calls.push({ engine, prompt });
      if (fail) throw new Error(fail);
      return "```markdown\n## 핵심 요약\n\n- 결정: 출시\n```";
    },
    notifier: async (channel, text) => {
      notes.push({ channel, text });
    },
    publicUrl: "https://lotion.example/",
  });
  app = await createApp(repo, { summaries });
});
afterEach(async () => {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
});

it("composes prompt from skill, request and sources; picks selected blocks", () => {
  const prompt = composePrompt(
    "요약해줘",
    { name: "minutes", body: "Use the house style." },
    [
      { title: "A", markdown: "a body" },
      { title: "B", markdown: "" },
    ],
  );
  expect(prompt).toMatch(
    /스킬: minutes[\s\S]*house style[\s\S]*# 요청\n\n요약해줘[\s\S]*## A\n\na body[\s\S]*## B\n\n\(내용 없음\)/,
  );
  const blocks = [para("a", "x", [para("b", "y")]), para("c", "z")] as any;
  expect(pickBlocks(blocks, new Set(["b", "c"])).map((b) => b.id)).toEqual([
    "b",
    "c",
  ]);
});

it("stores settings with defaults and lists skills", async () => {
  const defaults = (await app.inject({ url: "/api/summary/settings" })).json();
  expect(defaults.engine).toBe("codex");
  expect(defaults.prompt).toContain("Confluence");
  const saved = await app.inject({
    method: "PUT",
    url: "/api/summary/settings",
    payload: {
      ...defaults,
      engine: "claude",
      skill: "minutes",
      slackChannel: "C0C4B6W56EB",
    },
  });
  expect(saved.statusCode).toBe(200);
  expect(
    (await app.inject({ url: "/api/summary/settings" })).json().engine,
  ).toBe("claude");
  expect(
    (
      await app.inject({
        method: "PUT",
        url: "/api/summary/settings",
        payload: { slackChannel: "#general" },
      })
    ).statusCode,
  ).toBe(400);
  expect((await app.inject({ url: "/api/summary/skills" })).json()).toEqual([
    {
      name: "minutes",
      description: "Confluence minutes",
      source: path.join(dir, "skills"),
    },
  ]);
});

it("summarises meetings into a page under the parent and notifies Slack", async () => {
  await app.inject({
    method: "PUT",
    url: "/api/summary/settings",
    payload: { skill: "minutes", slackChannel: "C0C4B6W56EB" },
  });
  const parent = await page("Weekly", null, [para("w", "db")]);
  const one = await page("10-01 회의", parent.id, [
    para("p1", "first raw"),
    para("p2", "skip me"),
  ]);
  const two = await page("10-08 회의", parent.id, [para("q1", "second raw")]);
  const started = await app.inject({
    method: "POST",
    url: "/api/summary/jobs",
    payload: {
      pages: [{ id: one.id, blockIds: ["p1"] }, { id: two.id }],
      parentId: parent.id,
    },
  });
  expect(started.statusCode).toBe(202);
  const job = await waitFor(started.json().id);
  expect(job).toMatchObject({
    status: "done",
    engine: "codex",
    skill: "minutes",
    notified: true,
  });
  expect(job.title).toBe("요약 · 10-01 회의 외 1건");
  expect(calls[0].prompt).toContain("first raw");
  expect(calls[0].prompt).not.toContain("skip me");
  expect(calls[0].prompt).toContain("second raw");
  expect(calls[0].prompt).toContain("Use the house style.");
  const summary = repo.get(job.summaryId);
  expect(summary.parentId).toBe(parent.id);
  expect(summary.icon).toBe("📝");
  const text = JSON.stringify(summary.blocks);
  expect(text).toContain("핵심 요약");
  expect(text).not.toContain("```");
  expect(text).toContain(`#/page/${one.id}`);
  expect(notes).toEqual([
    {
      channel: "C0C4B6W56EB",
      text: expect.stringContaining(
        `https://lotion.example/#/page/${job.summaryId}`,
      ),
    },
  ]);
  expect((await app.inject({ url: "/api/summary/jobs" })).json()[0].id).toBe(
    job.id,
  );
});

it("reports engine failures, notifies them, and rejects bad input", async () => {
  await app.inject({
    method: "PUT",
    url: "/api/summary/settings",
    payload: { slackChannel: "C0C4B6W56EB", skill: "" },
  });
  const parent = await page("P", null, [para("a", "x")]);
  fail = "codex exited with 1: quota";
  const started = await app.inject({
    method: "POST",
    url: "/api/summary/jobs",
    payload: {
      pages: [{ id: parent.id }],
      parentId: parent.id,
      engine: "claude",
    },
  });
  const job = await waitFor(started.json().id);
  expect(job).toMatchObject({
    status: "failed",
    engine: "claude",
    error: "codex exited with 1: quota",
  });
  expect(notes[0].text).toContain("실패");
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/summary/jobs",
        payload: { pages: [], parentId: parent.id },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/summary/jobs",
        payload: {
          pages: [{ id: parent.id }],
          parentId: parent.id,
          skill: "nope",
        },
      })
    ).statusCode,
  ).toBe(400);
});
