import { useEffect, useState } from "react";
import { prefs } from "../browser-prefs";

/**
 * How issues in focus (Focus now, or a deadline within 24 h) are drawn. A
 * browser preference, applied as `data-focus-effect` and a duration variable
 * on the root element, so every board and page follows it at once.
 */
export const FOCUS_EFFECTS = ["orbit", "pulse", "off"] as const;
export type FocusEffect = (typeof FOCUS_EFFECTS)[number];
export const FOCUS_SPEEDS = ["slow", "normal", "fast"] as const;
export type FocusSpeed = (typeof FOCUS_SPEEDS)[number];

const EFFECT_PREF = "focus-effect";
const SPEED_PREF = "focus-speed";
const SECONDS: Record<FocusSpeed, number> = { slow: 9, normal: 6, fast: 3 };
const CHANGED = "lotion:focus-effect";

export function focusPreference() {
  return {
    effect: prefs.choice(EFFECT_PREF, FOCUS_EFFECTS, "orbit"),
    speed: prefs.choice(SPEED_PREF, FOCUS_SPEEDS, "normal"),
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
  prefs.set(EFFECT_PREF, next.effect);
  prefs.set(SPEED_PREF, next.speed);
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
