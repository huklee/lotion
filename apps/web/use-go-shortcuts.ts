import { useEffect, useRef } from "react";
import { latinKey } from "./keyboard-layout";

/**
 * Two-key "go to" shortcuts anywhere outside text fields: `g` then a letter
 * (`g h` Home, `g i` Issues). Keys are read by physical position, so they also
 * work with Korean input.
 */
export function useGoShortcuts(targets: Record<string, () => void>) {
  const latest = useRef(targets);
  latest.current = targets;
  useEffect(() => {
    let previous: { key: string; at: number } | null = null;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.isComposing ||
        (target &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)))
      ) {
        previous = null;
        return;
      }
      const key = latinKey(event);
      const now = Date.now();
      const go = latest.current[key];
      if (go && previous?.key === "g" && now - previous.at < 1200) {
        previous = null;
        event.preventDefault();
        go();
        return;
      }
      previous = { key, at: now };
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
