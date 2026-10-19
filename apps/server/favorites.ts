import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../packages/document-schema/index";

const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const LIMIT = 500;

/**
 * Favorite pages for the whole workspace (every browser and device), in the order
 * they were added. Stored in favorites.json; one add/remove at a time, so two
 * devices changing favorites do not overwrite each other.
 */
export class FavoritesStore {
  private file: string;
  private ids: string[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dataDir: string) {
    this.file = path.join(dataDir, "favorites.json");
  }

  private async load(): Promise<string[]> {
    if (this.ids) return this.ids;
    try {
      const data = JSON.parse(await readFile(this.file, "utf8"));
      this.ids = Array.isArray(data?.ids)
        ? [
            ...new Set<string>(
              data.ids.filter(
                (id: unknown) => typeof id === "string" && ID.test(id),
              ),
            ),
          ]
        : [];
    } catch {
      this.ids = [];
    }
    return this.ids;
  }

  private change(edit: (ids: string[]) => string[]) {
    const run = this.queue.then(async () => {
      const next = edit(await this.load());
      const temp = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify({ ids: next }));
      await rename(temp, this.file);
      this.ids = next;
      return next;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async list() {
    await this.queue;
    return [...(await this.load())];
  }

  add(id: string) {
    if (!ID.test(id)) throw new AppError(400, "Invalid page id");
    return this.change((ids) => {
      if (ids.includes(id)) return ids;
      if (ids.length >= LIMIT)
        throw new AppError(400, `At most ${LIMIT} favorites`);
      return [...ids, id];
    });
  }

  remove(id: string) {
    return this.change((ids) => ids.filter((item) => item !== id));
  }
}
