import { afterEach, describe, expect, it, vi } from "vitest";

/** A Storage-like map; `refuse` makes every call throw like a blocked store. */
function fakeStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  const state = { refuse: false, full: false };
  const guard = () => {
    if (state.refuse) throw new DOMException("denied", "SecurityError");
  };
  return {
    state,
    values,
    getItem: (key: string) => (guard(), values.get(key) ?? null),
    setItem: (key: string, value: string) => {
      guard();
      if (state.full) throw new DOMException("full", "QuotaExceededError");
      values.set(key, value);
    },
    removeItem: (key: string) => (guard(), values.delete(key)),
  };
}

async function load(
  local: ReturnType<typeof fakeStorage> | "throw",
  session = fakeStorage(),
) {
  vi.resetModules();
  vi.stubGlobal("window", {
    get localStorage() {
      if (local === "throw") throw new DOMException("denied", "SecurityError");
      return local;
    },
    get sessionStorage() {
      return session;
    },
  });
  return import("../../apps/web/browser-prefs");
}

afterEach(() => vi.unstubAllGlobals());

describe("browser prefs", () => {
  it("reads and writes lotion- keys, moving old yestion- values over", async () => {
    const local = fakeStorage({ "yestion-theme": "dark" });
    const { prefs } = await load(local);
    expect(prefs.get("theme")).toBe("dark");
    expect(local.values.get("lotion-theme")).toBe("dark");
    prefs.set("page-width", "wide");
    expect(local.values.get("lotion-page-width")).toBe("wide");
    prefs.remove("page-width");
    expect(local.values.has("lotion-page-width")).toBe(false);
  });

  it("validates choices, booleans and JSON", async () => {
    const local = fakeStorage({
      "lotion-page-width": "huge",
      "lotion-sidebar-on-start": "false",
      "lotion-favorites": '["a","a","b",3]',
      "lotion-broken": "{not json",
    });
    const { prefs } = await load(local);
    expect(
      prefs.choice("page-width", ["comfortable", "wide"], "comfortable"),
    ).toBe("comfortable");
    expect(prefs.bool("sidebar-on-start", true)).toBe(false);
    const ids = (v: unknown) =>
      Array.isArray(v)
        ? [...new Set(v.filter((x): x is string => typeof x === "string"))]
        : null;
    expect(prefs.json("favorites", [], ids)).toEqual(["a", "b"]);
    expect(prefs.json("broken", ["fallback"], ids)).toEqual(["fallback"]);
    expect(prefs.json("missing", ["fallback"], ids)).toEqual(["fallback"]);
    prefs.setJson("favorites", ["c"]);
    expect(local.values.get("lotion-favorites")).toBe('["c"]');
  });

  it("never throws when storage is blocked, and remembers values for the page", async () => {
    const { prefs, safeStorage } = await load("throw");
    expect(prefs.get("theme")).toBeNull();
    expect(prefs.choice("theme", ["light", "dark"], "light")).toBe("light");
    prefs.set("theme", "dark");
    expect(prefs.get("theme")).toBe("dark");
    expect(() => safeStorage().removeItem("lotion-theme")).not.toThrow();
    expect(prefs.get("theme")).toBeNull();
  });

  it("keeps a value in memory when a write is refused (full quota or denied)", async () => {
    const local = fakeStorage();
    local.state.full = true;
    const { prefs } = await load(local);
    expect(() => prefs.set("focus-effect", "pulse")).not.toThrow();
    expect(prefs.get("focus-effect")).toBe("pulse");
    local.state.refuse = true;
    expect(() => prefs.get("focus-effect")).not.toThrow();
    expect(prefs.get("focus-effect")).toBe("pulse");
  });

  it("follows the browser's storage when it works (no stale page copy)", async () => {
    const local = fakeStorage();
    const { prefs } = await load(local);
    prefs.set("seen-version", "1.0.0");
    // another tab clears it
    local.values.delete("lotion-seen-version");
    expect(prefs.get("seen-version")).toBeNull();
  });

  it("keeps session and local values apart", async () => {
    const local = fakeStorage();
    const session = fakeStorage();
    const { prefs } = await load(local, session);
    prefs.set("token", "secret-for-this-tab", "session");
    expect(session.values.get("lotion-token")).toBe("secret-for-this-tab");
    expect(local.values.has("lotion-token")).toBe(false);
    expect(prefs.get("token")).toBeNull();
  });
});
