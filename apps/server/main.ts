import { Repository } from "../../packages/persistence/repository";
import { createApp } from "./app";
const host = process.env.HOST ?? "127.0.0.1";
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  !process.env.YESTION_TOKEN
)
  throw new Error(
    "Remote binding requires YESTION_TOKEN; terminate TLS at your reverse proxy.",
  );
const repo = await new Repository(
  process.env.YESTION_DATA_DIR ?? "data",
).init();
const app = await createApp(repo, {
  token: process.env.YESTION_TOKEN,
  production: true,
});
await app.listen({ host, port: Number(process.env.PORT ?? 3001) });
console.log(`Yestion is running at http://${host}:${process.env.PORT ?? 3001}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
