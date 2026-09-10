import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fork } from "node:child_process";
import { Repository } from "../../packages/persistence/repository";
it.concurrent.each(["beforeManifest", "afterCommit"])(
  "recovers after a real SIGKILL at %s",
  async (stage) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-crash-"));
    let repo = await new Repository(dir).init();
    const doc = await repo.create("Original", null, crypto.randomUUID());
    await repo.close();
    try {
      const child = fork(
        path.resolve("tests/fixtures/crash-writer.ts"),
        [dir, stage],
        {
          execArgv: ["--import", "tsx"],
          stdio: ["ignore", "ignore", "pipe", "ipc"],
        },
      );
      let stderr = "";
      child.stderr?.on("data", (chunk) => (stderr += chunk));
      child.on("message", () => child.kill("SIGKILL"));
      const exit = await new Promise<string | null>((resolve, reject) => {
        child.on("error", reject);
        child.on("exit", (_code, signal) => resolve(signal));
      });
      expect(exit, stderr).toBe("SIGKILL");
      await new Promise((resolve) => setTimeout(resolve, 11000));
      repo = await new Repository(dir).init();
      expect(repo.get(doc.id).title).toBe(
        stage === "afterCommit" ? "Committed by child" : "Original",
      );
      await repo.close();
    } finally {
      await repo.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
  20000,
);
