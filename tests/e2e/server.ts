import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Repository } from "../../packages/persistence/repository";
import { createApp } from "../../apps/server/app";

export async function startE2EServer() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-e2e-"));
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    app = await createApp(await new Repository(dir).init(), {
      production: true,
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
