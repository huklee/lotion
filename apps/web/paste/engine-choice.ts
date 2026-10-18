/** Which paste engine this browser uses while v2 is being evaluated. */
export type PasteEngine = "classic" | "v2";
const KEY = "lotion-paste-engine";

export function getPasteEngine(): PasteEngine {
  try {
    return localStorage.getItem(KEY) === "v2" ? "v2" : "classic";
  } catch {
    return "classic";
  }
}

export function setPasteEngine(engine: PasteEngine) {
  try {
    localStorage.setItem(KEY, engine);
  } catch {
    /* per-browser convenience only */
  }
}
