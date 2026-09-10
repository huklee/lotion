import { get, set, del } from "idb-keyval";
import type { Checkpoint } from "./save-coordinator";

// Read-only compatibility names preserve settings and unsaved work from pre-rename builds.
export function readSetting(storage: Pick<Storage, "getItem" | "setItem">, name: string) {
  const current = storage.getItem(`lotion-${name}`);
  if (current !== null) return current;
  const legacy = storage.getItem(`yestion-${name}`);
  if (legacy !== null) storage.setItem(`lotion-${name}`, legacy);
  return legacy;
}

const legacyDraftKey = (key: string) => key.replace(/^lotion-draft:/, "yestion-draft:");
export async function readDraft(key: string) {
  return (await get<Checkpoint>(key)) ?? (await get<Checkpoint>(legacyDraftKey(key)));
}
export async function writeDraft(key: string, draft: Checkpoint | null) {
  if (draft) await set(key, draft);
  // Remove the legacy checkpoint before clearing the new one so it cannot reappear.
  await del(legacyDraftKey(key));
  if (!draft) await del(key);
}
