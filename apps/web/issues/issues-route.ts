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
