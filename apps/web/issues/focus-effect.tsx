import { useEffect, useState } from "react";

/**
 * How issues in focus (Focus now, or a deadline within 24 h) are drawn. A
 * browser preference, applied as `data-focus-effect` and a duration variable
 * on the root element, so every board and page follows it at once.
 */
export const FOCUS_EFFECTS = ["orbit", "pulse", "off"] as const;
export type FocusEffect = (typeof FOCUS_EFFECTS)[number];
export const FOCUS_SPEEDS = ["slow", "normal", "fast"] as const;
export type FocusSpeed = (typeof FOCUS_SPEEDS)[number];

const EFFECT_KEY = "lotion-focus-effect";
const SPEED_KEY = "lotion-focus-speed";
const SECONDS: Record<FocusSpeed, number> = { slow: 9, normal: 6, fast: 3 };
const CHANGED = "lotion:focus-effect";

function read<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): T {
  try {
    const value = localStorage.getItem(key);
    return choices.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function focusPreference() {
  return {
    effect: read(EFFECT_KEY, FOCUS_EFFECTS, "orbit"),
    speed: read(SPEED_KEY, FOCUS_SPEEDS, "normal"),
  };
}

let current: { effect: FocusEffect; speed: FocusSpeed } | null = null;

export function applyFocusEffect(next = current ?? focusPreference()) {
  current = next;
  const root = document.documentElement;
  root.dataset.focusEffect = next.effect;
  root.style.setProperty("--focus-cycle", `${SECONDS[next.speed]}s`);
}

export function setFocusPreference(change: {
  effect?: FocusEffect;
  speed?: FocusSpeed;
}) {
  const next = { ...(current ?? focusPreference()), ...change };
  try {
    localStorage.setItem(EFFECT_KEY, next.effect);
    localStorage.setItem(SPEED_KEY, next.speed);
  } catch {
    // private window: the choice lasts for this page only
  }
  applyFocusEffect(next);
  window.dispatchEvent(new Event(CHANGED));
}

const EFFECT_NAMES: Record<FocusEffect, string> = {
  orbit: "Red dot circling the border",
  pulse: "Pulsing red glow",
  off: "Red border only (no motion)",
};

/** Control panel rows: the effect and its speed, with a live sample card. */
export function FocusEffectSettings() {
  const [pref, setPref] = useState(() => current ?? focusPreference());
  useEffect(() => {
    const sync = () => setPref(current ?? focusPreference());
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);
  return (
    <>
      <label className="settings-row">
        <span>
          Focus now effect
          <small>
            How issues in focus (Focus now, or due within 24 h) stand out on the
            board.
          </small>
        </span>
        <select
          aria-label="Focus now effect"
          value={pref.effect}
          onChange={(event) =>
            setFocusPreference({ effect: event.target.value as FocusEffect })
          }
        >
          {FOCUS_EFFECTS.map((effect) => (
            <option key={effect} value={effect}>
              {EFFECT_NAMES[effect]}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-row">
        <span>
          Focus effect speed
          <small>One lap of the dot, or one pulse.</small>
        </span>
        <select
          aria-label="Focus effect speed"
          value={pref.speed}
          disabled={pref.effect === "off"}
          onChange={(event) =>
            setFocusPreference({ speed: event.target.value as FocusSpeed })
          }
        >
          <option value="slow">Slow ({SECONDS.slow} s)</option>
          <option value="normal">Normal ({SECONDS.normal} s)</option>
          <option value="fast">Fast ({SECONDS.fast} s)</option>
        </select>
      </label>
      <div
        className="settings-row focus-sample-row focus-clock"
        aria-hidden="true"
      >
        <span className="issue-card focus-now focus-sample" data-focus="manual">
          <span className="issue-card-title">Focus now (blue)</span>
        </span>
        <span className="issue-card focus-now focus-sample" data-focus="due">
          <span className="issue-card-title">Due within 24 h (red)</span>
        </span>
      </div>
    </>
  );
}
