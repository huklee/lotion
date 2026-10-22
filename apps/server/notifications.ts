import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const NOTIFICATION_KINDS = [
  "meeting.created",
  "meetings.imported",
  "summary.done",
  "summary.failed",
  "issue.changed",
  "info",
] as const;

export const notificationInput = z.object({
  kind: z.enum(NOTIFICATION_KINDS),
  title: z.string().trim().min(1).max(300),
  detail: z.string().max(500).optional(),
  pageId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,100}$/)
    .optional(),
  /** An issue number: clicking the notification opens that issue. */
  issue: z.number().int().positive().optional(),
});
export type NotificationInput = z.infer<typeof notificationInput>;
export type Notification = NotificationInput & { id: string; at: string };

type Store = { items: Notification[]; seenAt: string };
const LIMIT = 500;

/**
 * Workspace events shown in the top-right bell (newest first). One small JSON file;
 * writes are serialised and replace the file atomically.
 */
export class NotificationService {
  private file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private cache: Store | null = null;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, "notifications.json");
  }

  private async load(): Promise<Store> {
    if (this.cache) return this.cache;
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8"));
      this.cache = {
        items: Array.isArray(parsed.items) ? parsed.items.slice(0, LIMIT) : [],
        seenAt: typeof parsed.seenAt === "string" ? parsed.seenAt : "",
      };
    } catch {
      this.cache = { items: [], seenAt: "" };
    }
    return this.cache;
  }

  private write(change: (store: Store) => void) {
    const run = this.queue.then(async () => {
      const store = await this.load();
      change(store);
      const temp = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(store));
      await rename(temp, this.file);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async add(raw: unknown): Promise<Notification> {
    const input = notificationInput.parse(raw);
    const item: Notification = {
      ...input,
      id: randomUUID(),
      at: new Date().toISOString(),
    };
    await this.write((store) => {
      store.items = [item, ...store.items].slice(0, LIMIT);
    });
    return item;
  }

  async list(limit = 100) {
    const store = await this.load();
    const items = store.items.slice(0, Math.max(1, Math.min(limit, LIMIT)));
    const unread = store.items.filter((i) => i.at > store.seenAt).length;
    return { items, seenAt: store.seenAt, unread };
  }

  /** Mark everything up to `at` (default: now) as read. */
  async markSeen(at?: string) {
    const when =
      at && !Number.isNaN(Date.parse(at))
        ? new Date(at).toISOString()
        : new Date().toISOString();
    await this.write((store) => {
      if (when > store.seenAt) store.seenAt = when;
    });
    return this.list();
  }
}
