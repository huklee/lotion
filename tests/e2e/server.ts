import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Repository } from "../../packages/persistence/repository";
import { createApp } from "../../apps/server/app";
import { SummaryService } from "../../apps/server/summaries";

export async function startE2EServer() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-e2e-"));
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    const repo = await new Repository(dir).init();
    app = await createApp(repo, {
      production: true,
      // A deterministic stand-in for Codex/Claude: echoes what it was given.
      summaries: new SummaryService(repo, {
        dataDir: dir,
        skillDirs: [],
        runner: async (engine, prompt) => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const source = prompt.split("# 원본 회의록")[1] ?? "";
          return `## 핵심 요약 (${engine})\n\n- 요약 대상: ${[...source.matchAll(/^## (.+)$/gm)].map((m) => m[1]).join(", ")}\n- 원문 길이: ${source.trim().length}자\n`;
        },
      }),
    });
    const baseURL = await app.listen({ host: "127.0.0.1", port: 0 });
    const startedApp = app;
    return {
      baseURL,
      async close() {
        try {
          await startedApp.close();
        } finally {
          await fs.rm(dir, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    await app?.close().catch(() => undefined);
    await fs.rm(dir, { recursive: true, force: true });
    throw error;
  }
}
