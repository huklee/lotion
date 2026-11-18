import { useEffect, useState } from "react";
import { prefs } from "./browser-prefs";

/**
 * Optional features whose entry point can be switched off in the Control
 * panel. A browser preference: every open view follows a change at once.
 */
export const FEATURES = {
  "confluence-view": {
    label: "Confluence wiki view",
    hint: "A Confluence button in the page's top bar: the whole page as a Confluence wiki page, with Expand and info panels.",
    default: true,
  },
} as const;
export type Feature = keyof typeof FEATURES;

const CHANGED = "lotion:features";
const pref = (feature: Feature) => `feature-${feature}`;

export function featureEnabled(feature: Feature): boolean {
  return prefs.bool(pref(feature), FEATURES[feature].default);
}

export function setFeatureEnabled(feature: Feature, on: boolean) {
  prefs.set(pref(feature), String(on));
  window.dispatchEvent(new Event(CHANGED));
}

/** Whether a feature's entry point is shown; follows Control panel changes. */
export function useFeature(feature: Feature): boolean {
  const [on, setOn] = useState(() => featureEnabled(feature));
  useEffect(() => {
    const sync = () => setOn(featureEnabled(feature));
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, [feature]);
  return on;
}

function FeatureToggle({ feature }: { feature: Feature }) {
  const on = useFeature(feature);
  const { label, hint } = FEATURES[feature];
  return (
    <label className="settings-row settings-toggle">
      <span>
        {label}
        <small>{hint}</small>
      </span>
      <input
        aria-label={label}
        type="checkbox"
        checked={on}
        onChange={(event) => setFeatureEnabled(feature, event.target.checked)}
      />
    </label>
  );
}

/** Control panel rows: one switch per optional feature. */
export function FeatureSettings() {
  return (
    <>
      {(Object.keys(FEATURES) as Feature[]).map((feature) => (
        <FeatureToggle key={feature} feature={feature} />
      ))}
    </>
  );
}
