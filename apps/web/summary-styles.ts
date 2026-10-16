import { useEffect, useState } from "react";
import { api } from "./api";

/** A condensing preset (stored on the server with the summary settings). */
export type SummaryPreset = {
  id: string;
  label: string;
  hint: string;
  rules: string;
};
/** A preset id. */
export type SummaryStyle = string;

type PresetState = { presets: SummaryPreset[]; style: string };
let cache: PresetState | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(state: PresetState) => void>();

/** Publish presets after a save so every summary menu shows the current list. */
export function publishSummaryPresets(state: PresetState) {
  cache = state;
  for (const listener of listeners) listener(state);
}

function load() {
  loading ??= api<PresetState>("/api/summary/settings")
    .then((s) => publishSummaryPresets({ presets: s.presets, style: s.style }))
    .catch(() => undefined)
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** The saved condensing presets and the default one (loaded once, kept in sync). */
export function useSummaryPresets(): PresetState {
  const [state, setState] = useState<PresetState>(
    () => cache ?? { presets: [], style: "" },
  );
  useEffect(() => {
    listeners.add(setState);
    if (!cache) void load();
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}
