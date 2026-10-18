import { Repository } from "../../packages/persistence/repository";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app";
import { SummaryService, bridgeChannels, bridgeNotifier } from "./summaries";
import { NotificationService } from "./notifications";
import { SessionStore } from "./sessions";
import { FavoritesStore } from "./favorites";
const host = process.env.HOST ?? "127.0.0.1";
// Legacy environment aliases keep existing deployments pointed at their workspace.
const token = process.env.LOTION_TOKEN ?? process.env.YESTION_TOKEN;
const dataDir =
  process.env.LOTION_DATA_DIR ?? process.env.YESTION_DATA_DIR ?? "data";
if (!["127.0.0.1", "localhost", "::1"].includes(host) && !token)
  throw new Error(
    "Remote binding requires LOTION_TOKEN; terminate TLS at your reverse proxy.",
  );
const repo = await new Repository(dataDir).init();
const notifyUrl =
  process.env.LOTION_SLACK_NOTIFY_URL ?? "http://127.0.0.1:47833/notify";
const notifications = new NotificationService(dataDir);
const summaries = new SummaryService(repo, {
  events: (event) => notifications.add(event),
  dataDir,
  skillDirs: [
    path.join(os.homedir(), ".claude", "skills"),
    path.join(os.homedir(), ".codex", "skills"),
  ],
  notifier: bridgeNotifier(notifyUrl),
  channels: bridgeChannels(notifyUrl),
  publicUrl: process.env.LOTION_PUBLIC_URL,
  allowTestEngine: process.env.LOTION_SUMMARY_ENGINE === "test",
});
const app = await createApp(repo, {
  token,
  production: true,
  summaries,
  notifications,
  sessions: new SessionStore(dataDir),
  favorites: new FavoritesStore(dataDir),
});
await app.listen({ host, port: Number(process.env.PORT ?? 3001) });
console.log(`Lotion is running at http://${host}:${process.env.PORT ?? 3001}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
