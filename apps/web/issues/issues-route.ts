import { useEffect, useState } from "react";

/** `#/issues` (board) or `#/issues/12` (board with issue 12 open). */
export type IssueRoute = { number: number | null };

export function parseIssueHash(hash: string): IssueRoute | null {
  const match = /^#\/issues(?:\/(\d+))?\/?$/.exec(hash);
  if (!match) return null;
  return { number: match[1] ? Number(match[1]) : null };
}

export const issueHash = (number?: number | null) =>
  number ? `#/issues/${number}` : "#/issues";

export function useIssueRoute(): IssueRoute | null {
  const [route, setRoute] = useState(() => parseIssueHash(location.hash));
  useEffect(() => {
    const update = () => setRoute(parseIssueHash(location.hash));
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener("lotion:issues-route", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("lotion:issues-route", update);
    };
  }, []);
  return route;
}

/** pushState does not fire hashchange, so tell useIssueRoute directly. */
export function goToIssues(number?: number | null, replace = false) {
  const hash = issueHash(number);
  if (location.hash !== hash)
    history[replace ? "replaceState" : "pushState"](null, "", hash);
  window.dispatchEvent(new Event("lotion:issues-route"));
}

/** `g i` anywhere (outside text fields) opens the issue board. */
export function useGoToIssuesShortcut(onGo: () => void) {
  useEffect(() => {
    let previous: { key: string; at: number } | null = null;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (target &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)))
      ) {
        previous = null;
        return;
      }
      const now = Date.now();
      if (
        event.key === "i" &&
        previous?.key === "g" &&
        now - previous.at < 1200
      ) {
        previous = null;
        event.preventDefault();
        onGo();
        return;
      }
      previous = { key: event.key, at: now };
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onGo]);
}
