/** Which paste engine this browser uses: the new one unless Classic was chosen. */
export type PasteEngine = "classic" | "v2";
const KEY = "lotion-paste-engine";

export function getPasteEngine(): PasteEngine {
  try {
    return localStorage.getItem(KEY) === "classic" ? "classic" : "v2";
  } catch {
    return "v2";
  }
}

export function setPasteEngine(engine: PasteEngine) {
  try {
    localStorage.setItem(KEY, engine);
  } catch {
    /* per-browser convenience only */
  }
}
