import { Repository } from "../../packages/persistence/repository";
import { createApp } from "./app";
const host = process.env.HOST ?? "127.0.0.1";
// Legacy environment aliases keep existing deployments pointed at their workspace.
const token = process.env.LOTION_TOKEN ?? process.env.YESTION_TOKEN;
const dataDir = process.env.LOTION_DATA_DIR ?? process.env.YESTION_DATA_DIR ?? "data";
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  !token
)
  throw new Error(
    "Remote binding requires LOTION_TOKEN; terminate TLS at your reverse proxy.",
  );
const repo = await new Repository(
  dataDir,
).init();
const app = await createApp(repo, {
  token,
  production: true,
});
await app.listen({ host, port: Number(process.env.PORT ?? 3001) });
console.log(`Lotion is running at http://${host}:${process.env.PORT ?? 3001}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
