import { useEffect, type RefObject } from "react";
import type { Draft } from "./page-drafts";

/**
 * Save every open draft when the tab is hidden, and ask before the page is
 * closed or reloaded while a draft is unsaved.
 */
export function useSaveOnLeave(drafts: RefObject<ReadonlyMap<string, Draft>>) {
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden")
        for (const c of drafts.current.values()) void c.flush();
    };
    document.addEventListener("visibilitychange", flush);
    const unload = (event: BeforeUnloadEvent) => {
      if ([...drafts.current.values()].some((c) => c.status !== "Saved")) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", unload);
    };
  }, [drafts]);
}
