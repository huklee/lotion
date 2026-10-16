import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { Block, Document } from "../../packages/document-schema/index";
import { fromMarkdown, toMarkdown } from "../../packages/markdown/convert";
import type { Repository } from "../../packages/persistence/repository";

export const ENGINES = ["codex", "claude"] as const;
export type Engine = (typeof ENGINES)[number] | "test";

export const DEFAULT_PROMPT = `다음은 회의 원본 기록(raw notes)입니다. 이를 바탕으로 대기업 Confluence 회의록 형식의 한국어 요약 회의록을 작성하세요.

구성:
1. 회의 개요 — 일시, 참석자, 회의 목적
2. 핵심 요약 — 3~5줄
3. 주요 논의 사항 — 주제별 소제목과 요점
4. 결정 사항
5. 액션 아이템 — 표(항목 | 담당자 | 기한 | 상태)
6. 이슈·리스크 및 후속 논의

규칙: 원문에 없는 사실을 지어내지 말고, 불확실한 내용은 "(확인 필요)"로 표시하세요. 여러 회의가 주어지면 날짜순으로 묶어 흐름을 정리하세요. 결과는 Markdown 본문만 출력하세요(앞뒤 설명 없이).`;

export const settingsSchema = z.object({
  engine: z.enum(ENGINES).default("codex"),
  skill: z.string().max(200).default("create-enterprise-confluence-report"),
  prompt: z.string().min(1).max(20_000).default(DEFAULT_PROMPT),
  slackChannel: z
    .string()
    .max(40)
    .regex(/^([CDG][A-Z0-9]{4,})?$/, "Slack channel id like C0123ABCD")
    .default(""),
});
export type SummarySettings = z.infer<typeof settingsSchema>;

export const jobInputSchema = z.object({
  pages: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        blockIds: z.array(z.string().max(100)).max(2000).optional(),
      }),
    )
    .min(1)
    .max(100),
  parentId: z.string().min(1).max(100),
  title: z.string().max(300).optional(),
  engine: z.enum(ENGINES).optional(),
  skill: z.string().max(200).optional(),
  prompt: z.string().max(20_000).optional(),
});
export type JobInput = z.infer<typeof jobInputSchema>;

export type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  engine: Engine;
  skill: string;
  title: string;
  sources: { id: string; title: string }[];
  parentId: string;
  summaryId?: string;
  error?: string;
  notified?: boolean;
  createdAt: string;
  finishedAt?: string;
};

export type Skill = { name: string; description: string; source: string };

/** Runs one engine on `prompt` and resolves with Markdown. */
export type Runner = (engine: Engine, prompt: string) => Promise<string>;
export type Notifier = (channel: string, text: string) => Promise<void>;

function frontmatter(text: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line);
    if (pair) meta[pair[1]] = pair[2].replace(/^["']|["']$/g, "");
  }
  return { meta, body: text.slice(match[0].length) };
}

/** Blocks with the given ids (and their children), in document order. */
export function pickBlocks(blocks: Block[], ids: Set<string>): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    if (ids.has(block.id)) out.push(block);
    else out.push(...pickBlocks((block.children ?? []) as Block[], ids));
  }
  return out;
}

export function composePrompt(
  settingsPrompt: string,
  skill: { name: string; body: string } | null,
  sources: { title: string; markdown: string }[],
): string {
  const parts: string[] = [];
  if (skill)
    parts.push(
      `# 사용할 스킬: ${skill.name}\n\n아래 스킬 지침을 따르되, 파일을 만들거나 명령을 실행하지 말고 결과 Markdown만 답변으로 출력하세요.\n\n${skill.body.trim()}`,
    );
  parts.push(`# 요청\n\n${settingsPrompt.trim()}`);
  parts.push(
    `# 원본 회의록\n\n${sources
      .map(
        (s) =>
          `## ${s.title || "Untitled"}\n\n${s.markdown.trim() || "(내용 없음)"}`,
      )
      .join("\n\n---\n\n")}`,
  );
  return parts.join("\n\n");
}

function run(
  command: string,
  args: string[],
  input: string,
  cwd: string,
  timeoutMs: number,
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `${command} timed out after ${Math.round(timeoutMs / 60000)} min`,
        ),
      );
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`${command} could not start: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else
        reject(
          new Error(
            `${command} exited with ${code}: ${err.trim().split("\n").slice(-3).join(" ")}`,
          ),
        );
    });
    child.stdin.end(input);
  });
}

/** Headless, read-only engines in an empty temporary directory. */
export const defaultRunner: Runner = async (engine, prompt) => {
  if (engine === "test")
    return `# 요약 (test engine)\n\n- 입력 ${prompt.length}자\n- ${/## (.+)/.exec(prompt.split("# 원본 회의록")[1] ?? "")?.[1] ?? ""}\n`;
  const dir = await mkdtemp(path.join(os.tmpdir(), "lotion-summary-"));
  try {
    if (engine === "codex") {
      const out = path.join(dir, "summary.md");
      await run(
        "codex",
        [
          "exec",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "-C",
          dir,
          "-o",
          out,
          "-",
        ],
        prompt,
        dir,
        15 * 60_000,
      );
      return await readFile(out, "utf8");
    }
    return await run(
      "claude",
      [
        "-p",
        "--output-format",
        "text",
        "--disallowedTools",
        "Bash",
        "Edit",
        "Write",
        "NotebookEdit",
        "WebFetch",
        "WebSearch",
      ],
      prompt,
      dir,
      15 * 60_000,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/** Posts through the local Slack bridge, which holds the Slack credentials. */
export function bridgeNotifier(url: string): Notifier {
  return async (channel, text) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`Slack bridge answered ${response.status}`);
  };
}

export class SummaryService {
  private jobs = new Map<string, Job>();
  private queue: Promise<void> = Promise.resolve();
  private settingsFile: string;

  constructor(
    private repo: Repository,
    private options: {
      dataDir: string;
      skillDirs?: string[];
      runner?: Runner;
      notifier?: Notifier;
      publicUrl?: string;
      allowTestEngine?: boolean;
    },
  ) {
    this.settingsFile = path.join(options.dataDir, "summary-settings.json");
  }

  async settings(): Promise<SummarySettings> {
    try {
      return settingsSchema.parse(
        JSON.parse(await readFile(this.settingsFile, "utf8")),
      );
    } catch {
      return settingsSchema.parse({});
    }
  }

  async saveSettings(input: unknown): Promise<SummarySettings> {
    const next = settingsSchema.parse(input);
    await writeFile(this.settingsFile, JSON.stringify(next, null, 2));
    return next;
  }

  async skills(): Promise<Skill[]> {
    const found: Skill[] = [];
    for (const dir of this.options.skillDirs ?? []) {
      if (!existsSync(dir)) continue;
      for (const name of (await readdir(dir)).sort()) {
        const file = path.join(dir, name, "SKILL.md");
        if (!existsSync(file)) continue;
        const { meta } = frontmatter(await readFile(file, "utf8"));
        if (found.some((s) => s.name === (meta.name || name))) continue;
        found.push({
          name: meta.name || name,
          description: (meta.description ?? "").slice(0, 300),
          source: dir,
        });
      }
    }
    return found;
  }

  private async skillBody(name: string) {
    if (!name) return null;
    for (const dir of this.options.skillDirs ?? []) {
      for (const candidate of existsSync(dir) ? await readdir(dir) : []) {
        const file = path.join(dir, candidate, "SKILL.md");
        if (!existsSync(file)) continue;
        const { meta, body } = frontmatter(await readFile(file, "utf8"));
        if ((meta.name || candidate) === name)
          return { name, body: body.slice(0, 40_000) };
      }
    }
    throw Object.assign(new Error(`Skill "${name}" was not found`), {
      statusCode: 400,
    });
  }

  list(): Job[] {
    return [...this.jobs.values()].reverse().slice(0, 20);
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  async start(raw: unknown): Promise<Job> {
    const input = jobInputSchema.parse(raw);
    const settings = await this.settings();
    const engine: Engine =
      this.options.allowTestEngine &&
      process.env.LOTION_SUMMARY_ENGINE === "test"
        ? "test"
        : (input.engine ?? settings.engine);
    const skill = input.skill ?? settings.skill;
    const docs: Document[] = input.pages.map((p) => this.repo.get(p.id));
    this.repo.get(input.parentId); // the parent must exist
    const skillBody = await this.skillBody(skill);
    const sources = docs.map((doc, i) => {
      const ids = input.pages[i].blockIds;
      const blocks = ids?.length
        ? pickBlocks(doc.blocks, new Set(ids))
        : doc.blocks;
      return { title: doc.title, markdown: toMarkdown(blocks).markdown };
    });
    const prompt = composePrompt(
      input.prompt || settings.prompt,
      skillBody,
      sources,
    );
    const day = new Date().toISOString().slice(0, 10);
    const job: Job = {
      id: randomUUID(),
      status: "queued",
      engine,
      skill,
      title:
        input.title ??
        `요약 · ${docs.length === 1 ? docs[0].title || "Untitled" : `${docs[0].title} 외 ${docs.length - 1}건`}`,
      sources: docs.map((d) => ({ id: d.id, title: d.title })),
      parentId: input.parentId,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    // One engine run at a time: summaries are rare and engines are heavy.
    this.queue = this.queue.then(() =>
      this.execute(job, prompt, settings, day),
    );
    return job;
  }

  private async execute(
    job: Job,
    prompt: string,
    settings: SummarySettings,
    day: string,
  ) {
    job.status = "running";
    try {
      const markdown = await (this.options.runner ?? defaultRunner)(
        job.engine,
        prompt,
      );
      if (!markdown.trim())
        throw new Error("The engine returned an empty summary");
      const { blocks } = fromMarkdown(
        markdown.replace(/^```(?:markdown|md)?\n([\s\S]*)\n```\s*$/, "$1"),
      );
      const header = fromMarkdown(
        `> ${day} · ${job.engine === "claude" ? "Claude Code" : job.engine === "codex" ? "Codex" : job.engine}${job.skill ? ` · ${job.skill}` : ""} 로 생성 · 원본: ${job.sources
          .map(
            (s) =>
              `[${(s.title || "Untitled").replace(/[[\]]/g, "")}](#/page/${s.id})`,
          )
          .join(", ")}`,
      ).blocks;
      const created = await this.repo.create(
        job.title,
        job.parentId,
        randomUUID(),
        false,
      );
      const saved = await this.repo.save(
        created.id,
        created.revision,
        {
          title: job.title,
          icon: "📝",
          blocks: [...header, ...blocks],
          linkPreviews: {},
        },
        randomUUID(),
      );
      job.summaryId = saved.id;
      job.status = "done";
    } catch (error) {
      job.status = "failed";
      job.error = (error as Error).message.slice(0, 500);
    }
    job.finishedAt = new Date().toISOString();
    await this.notify(job, settings);
  }

  private async notify(job: Job, settings: SummarySettings) {
    if (!settings.slackChannel || !this.options.notifier) return;
    const base = (this.options.publicUrl ?? "").replace(/\/$/, "");
    const text =
      job.status === "done"
        ? `📝 요약 회의록이 작성되었습니다: *${job.title}*\n${base}/#/page/${job.summaryId}\n원본 ${job.sources.length}건 · ${job.engine}${job.skill ? ` · ${job.skill}` : ""}`
        : `⚠️ 요약 회의록 작성 실패: *${job.title}*\n${job.error}`;
    try {
      await this.options.notifier(settings.slackChannel, text);
      job.notified = true;
    } catch (error) {
      job.notified = false;
      job.error = `${job.error ? `${job.error}; ` : ""}Slack: ${(error as Error).message}`;
    }
  }
}
