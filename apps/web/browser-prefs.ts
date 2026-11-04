import { readSetting } from "./storage-compat";
import { readBoolean, readChoice } from "./preferences";

/**
 * This browser's own settings and conveniences (theme, sidebar, last view…),
 * in one place.
 *
 * - Storage can be missing or refuse access (a private window, blocked site
 *   data, a full quota): `safeStorage` never throws and then keeps the values
 *   in memory for this page, so the app keeps working.
 * - Names are given without the `lotion-` prefix; values saved by the old
 *   name (`yestion-…`) are read once and moved over (see storage-compat.ts).
 * - Shared or durable data belongs on the server, not here.
 */

export type StorageArea = "local" | "session";
export type SafeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const memory: Record<StorageArea, Map<string, string>> = {
  local: new Map(),
  session: new Map(),
};

function browserStorage(area: StorageArea): Storage | null {
  try {
    return area === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * A Storage that never throws. The browser's storage is used when it allows
 * it; only when it is missing or refuses (private window, blocked site data,
 * full quota) do values live in this page's memory instead.
 */
export function safeStorage(area: StorageArea = "local"): SafeStorage {
  const fallback = memory[area];
  return {
    getItem(key) {
      try {
        const value = browserStorage(area)?.getItem(key);
        if (value !== null && value !== undefined) return value;
      } catch {
        // refused: use this page's memory
      }
      // only values the browser refused to store are kept here (a later
      // successful write or a removal clears them), so this is never stale
      return fallback.get(key) ?? null;
    },
    setItem(key, value) {
      try {
        const storage = browserStorage(area);
        if (storage) {
          storage.setItem(key, value);
          fallback.delete(key);
          return;
        }
      } catch {
        // refused or full: keep it for this page
      }
      fallback.set(key, value);
    },
    removeItem(key) {
      fallback.delete(key);
      try {
        browserStorage(area)?.removeItem(key);
      } catch {
        // nothing to clean up
      }
    },
  };
}

const key = (name: string) => `lotion-${name}`;

export const prefs = {
  /** The raw value of `lotion-<name>` (migrating `yestion-<name>`), or null. */
  get(name: string, area: StorageArea = "local"): string | null {
    return readSetting(safeStorage(area), name);
  },
  set(name: string, value: string, area: StorageArea = "local"): void {
    safeStorage(area).setItem(key(name), value);
  },
  remove(name: string, area: StorageArea = "local"): void {
    safeStorage(area).removeItem(key(name));
  },
  /** One of `choices`, or `fallback` for missing and stale values. */
  choice<T extends string>(
    name: string,
    choices: readonly T[],
    fallback: T,
    area: StorageArea = "local",
  ): T {
    return readChoice(safeStorage(area), name, choices, fallback);
  },
  bool(name: string, fallback: boolean, area: StorageArea = "local"): boolean {
    return readBoolean(safeStorage(area), name, fallback);
  },
  /**
   * Parsed JSON checked by `accept` (return null to reject), or `fallback`
   * when the value is missing, malformed or rejected.
   */
  json<T>(
    name: string,
    fallback: T,
    accept: (value: unknown) => T | null,
    area: StorageArea = "local",
  ): T {
    const raw = prefs.get(name, area);
    if (raw === null) return fallback;
    try {
      return accept(JSON.parse(raw)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  setJson(name: string, value: unknown, area: StorageArea = "local"): void {
    prefs.set(name, JSON.stringify(value), area);
  },
};
