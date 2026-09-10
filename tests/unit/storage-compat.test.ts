import { beforeEach, expect, it, vi } from "vitest";
const records = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb-keyval", () => ({
  get: async (key: string) => records.get(key),
  set: async (key: string, value: unknown) => { records.set(key, value); },
  del: async (key: string) => { records.delete(key); },
}));
import { readSetting, readDraft, writeDraft } from "../../apps/web/storage-compat";
beforeEach(() => records.clear());
it("migrates legacy settings while preferring an existing Lotion setting", () => {
  const values = new Map([["yestion-session", "original-tab"], ["yestion-theme", "dark"], ["lotion-theme", "light"]]);
  const storage = {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {values.set(key, value);}};
  expect(readSetting(storage, "session")).toBe("original-tab");
  expect(values.get("lotion-session")).toBe("original-tab");
  expect(readSetting(storage, "theme")).toBe("light");
});
it("recovers old drafts and never resurrects them after successful save", async () => {
  const draft = {content: {title:"Recovered", blocks:[]},revision:1,generation:1};
  records.set("yestion-draft:tab:page", draft);
  expect(await readDraft("lotion-draft:tab:page")).toEqual(draft);
  await writeDraft("lotion-draft:tab:page", draft);
  expect(records.has("yestion-draft:tab:page")).toBe(false);
  await writeDraft("lotion-draft:tab:page", null);
  expect(await readDraft("lotion-draft:tab:page")).toBeUndefined();
});
