import { prefs } from "../browser-prefs";

/** Which paste engine this browser uses: the new one unless Classic was chosen. */
export type PasteEngine = "classic" | "v2";

export function getPasteEngine(): PasteEngine {
  return prefs.get("paste-engine") === "classic" ? "classic" : "v2";
}

export function setPasteEngine(engine: PasteEngine) {
  prefs.set("paste-engine", engine);
}
