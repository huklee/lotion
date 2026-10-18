import { createHash, randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const SESSION_COOKIE = "lotion_session";
export const SESSION_DAYS = 90;
const DAY = 86_400_000;

type Entry = { createdAt: number; lastSeenAt: number };

const hash = (id: string) => createHash("sha256").update(id).digest("hex");

/**
 * Browser sessions created after one successful token check. Only hashes of the
 * session ids are stored (sessions.json, mode 600); a session expires after
 * SESSION_DAYS without use.
 */
export class SessionStore {
  private file: string;
  private sessions = new Map<string, Entry>();
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    dataDir: string,
    private now: () => number = Date.now,
  ) {
    this.file = path.join(dataDir, "sessions.json");
  }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const data = JSON.parse(await readFile(this.file, "utf8"));
      for (const [key, value] of Object.entries(data ?? {}))
        if (value && typeof value === "object")
          this.sessions.set(key, value as Entry);
    } catch {
      /* no sessions yet */
    }
  }

  private persist() {
    const run = this.queue.then(async () => {
      const temp = `${this.file}.${randomBytes(6).toString("hex")}.tmp`;
      await writeFile(temp, JSON.stringify(Object.fromEntries(this.sessions)), {
        mode: 0o600,
      });
      await rename(temp, this.file);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private expired(entry: Entry) {
    return this.now() - entry.lastSeenAt > SESSION_DAYS * DAY;
  }

  async create(): Promise<string> {
    await this.load();
    const id = randomBytes(32).toString("base64url");
    const at = this.now();
    for (const [key, entry] of this.sessions)
      if (this.expired(entry)) this.sessions.delete(key);
    this.sessions.set(hash(id), { createdAt: at, lastSeenAt: at });
    await this.persist();
    return id;
  }

  async verify(id: string | undefined): Promise<boolean> {
    if (!id || id.length > 200) return false;
    await this.load();
    const key = hash(id);
    const entry = this.sessions.get(key);
    if (!entry) return false;
    if (this.expired(entry)) {
      this.sessions.delete(key);
      await this.persist();
      return false;
    }
    // sliding expiry, written at most hourly
    if (this.now() - entry.lastSeenAt > 3_600_000) {
      entry.lastSeenAt = this.now();
      await this.persist();
    }
    return true;
  }

  async revoke(id: string | undefined) {
    if (!id) return;
    await this.load();
    if (this.sessions.delete(hash(id))) await this.persist();
  }
}

export function readCookie(header: string | undefined, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function sessionCookie(
  value: string,
  secure: boolean,
  maxAgeDays: number,
) {
  return [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.round(maxAgeDays * 86400)}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
