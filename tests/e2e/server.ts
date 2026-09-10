import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Repository } from "../../packages/persistence/repository";
import { createApp } from "../../apps/server/app";
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-e2e-"));
const app = await createApp(await new Repository(dir).init(), {
  production: true,
});
await app.listen({ host: "127.0.0.1", port: 3101 });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
    process.exit(0);
  });
