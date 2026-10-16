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
  expect(defaults.style).toBe("brief");
  expect(defaults.prompt).toContain("Markdown 본문만");
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
  // default style: short, decisions first, and it outranks the skill
  expect(job.style).toBe("brief");
  expect(calls[0].prompt).toMatch(
    /# 축약 방식: 핵심·결정 \(짧게\)[\s\S]*스킬 지침보다 우선[\s\S]*## 결정 사항/,
  );
  expect(JSON.stringify(repo.get(job.summaryId).blocks)).toContain(
    "핵심·결정 (짧게)",
  );
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

it("chooses the style per job and upgrades the legacy default prompt", async () => {
  const { DEFAULT_PRESETS } = await import("../../apps/server/summaries");
  const rules = (id: string) => DEFAULT_PRESETS.find((p) => p.id === id)!.rules;
  await fs.writeFile(
    path.join(dir, "data", "summary-settings.json"),
    JSON.stringify({
      engine: "codex",
      skill: "",
      prompt:
        "다음은 회의 원본 기록(raw notes)입니다. 이를 바탕으로 대기업 Confluence 회의록 형식의 한국어 요약 회의록을 작성하세요.",
      slackChannel: "",
    }),
  );
  const custom = (await app.inject({ url: "/api/summary/settings" })).json();
  expect(custom.style).toBe("brief");
  const parent = await page("P", null, [para("a", "x")]);
  const started = await app.inject({
    method: "POST",
    url: "/api/summary/jobs",
    payload: {
      pages: [{ id: parent.id }],
      parentId: parent.id,
      style: "standard",
    },
  });
  const job = await waitFor(started.json().id);
  expect(job.style).toBe("standard");
  expect(calls[0].prompt).toContain(rules("standard"));
  expect(calls[0].prompt).not.toContain(rules("brief"));
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/summary/jobs",
        payload: {
          pages: [{ id: parent.id }],
          parentId: parent.id,
          style: "huge",
        },
      })
    ).statusCode,
  ).toBe(400);
});

it("upgrades a saved copy of the legacy default prompt", async () => {
  const { DEFAULT_PROMPT, settingsSchema } =
    await import("../../apps/server/summaries");
  const legacy = (await import("node:fs")).readFileSync(
    "apps/server/summaries.ts",
    "utf8",
  );
  const text = /const LEGACY_DEFAULT_PROMPT = `([\s\S]*?)`;/.exec(legacy)![1];
  expect(settingsSchema.parse({ prompt: text }).prompt).toBe(DEFAULT_PROMPT);
  expect(settingsSchema.parse({ prompt: "내 프롬프트" }).prompt).toBe(
    "내 프롬프트",
  );
});

it("edits presets: custom preset used per job, default falls back when deleted", async () => {
  const current = (await app.inject({ url: "/api/summary/settings" })).json();
  expect(current.presets.map((p: any) => p.id)).toEqual([
    "brief",
    "actions",
    "standard",
    "detailed",
  ]);
  const presets = [
    ...current.presets.filter((p: any) => p.id !== "detailed"),
    {
      id: "exec",
      label: "임원 보고",
      hint: "3줄",
      rules: "임원 보고용 3줄 요약만 작성하세요.",
    },
  ];
  const saved = await app.inject({
    method: "PUT",
    url: "/api/summary/settings",
    payload: { ...current, skill: "", presets, style: "exec" },
  });
  expect(saved.statusCode).toBe(200);
  expect(saved.json().style).toBe("exec");
  const parent = await page("P", null, [para("a", "x")]);
  const job = await waitFor(
    (
      await app.inject({
        method: "POST",
        url: "/api/summary/jobs",
        payload: { pages: [{ id: parent.id }], parentId: parent.id },
      })
    ).json().id,
  );
  expect(job).toMatchObject({ style: "exec", styleLabel: "임원 보고" });
  expect(calls.at(-1)!.prompt).toContain("# 축약 방식: 임원 보고");
  expect(calls.at(-1)!.prompt).toContain("임원 보고용 3줄 요약만");
  expect(JSON.stringify(repo.get(job.summaryId).blocks)).toContain(
    "임원 보고 로 생성",
  );
  // deleted preset → 400 per job; default falls back to the first preset
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/summary/jobs",
        payload: {
          pages: [{ id: parent.id }],
          parentId: parent.id,
          style: "detailed",
        },
      })
    ).statusCode,
  ).toBe(400);
  const without = await app.inject({
    method: "PUT",
    url: "/api/summary/settings",
    payload: {
      ...(saved.json() as object),
      presets: presets.filter((p) => p.id !== "exec"),
    },
  });
  expect(without.json().style).toBe("brief");
  // invalid presets are rejected
  for (const bad of [
    [],
    [{ id: "a b", label: "x", rules: "y" }],
    [presets[0], presets[0]],
  ])
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/summary/settings",
          payload: { presets: bad },
        })
      ).statusCode,
    ).toBe(400);
});

it("lists Slack channels through the bridge, or reports it is not connected", async () => {
  expect(
    (await app.inject({ url: "/api/summary/slack-channels" })).statusCode,
  ).toBe(503);
  const withSlack = await createApp(repo, {
    summaries: new SummaryService(repo, {
      dataDir: path.join(dir, "data"),
      channels: async () => [{ id: "C1", name: "general", private: false }],
    }),
  });
  expect(
    (await withSlack.inject({ url: "/api/summary/slack-channels" })).json(),
  ).toEqual([{ id: "C1", name: "general", private: false }]);
  await withSlack.close();
});
