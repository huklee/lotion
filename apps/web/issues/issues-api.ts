import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { refreshNotifications } from "../NotificationBell";
import type { Issue, IssueBoard } from "../../../packages/issues/model";

const json = (method: string, body?: unknown, headers?: HeadersInit) => ({
  method,
  headers,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const issuesApi = {
  board: () => api<IssueBoard>("/api/issues"),
  seq: () => api<{ seq: number }>("/api/issues/seq"),
  get: (n: number) => api<Issue>(`/api/issues/${n}`),
  create: (input: { title: string; status?: string }) =>
    api<Issue>("/api/issues", json("POST", input)),
  patch: (n: number, version: number, input: Record<string, unknown>) =>
    api<Issue>(
      `/api/issues/${n}`,
      json("PATCH", input, { "If-Match": `"${version}"` }),
    ),
  move: (n: number, status: string, before: number | null) =>
    api<Issue>(`/api/issues/${n}/move`, json("POST", { status, before })),
  note: (n: number, text: string) =>
    api<Issue>(`/api/issues/${n}/notes`, json("POST", { text })),
  remove: (n: number) =>
    api<{ deleted: number }>(`/api/issues/${n}`, json("DELETE")),
};

export const POLL_MS = 5000;

/**
 * The board, refreshed whenever the server's change counter moves (checked
 * every few seconds while the tab is visible), so changes made by the CLI or
 * another device appear without a reload.
 */
export function useIssueBoard(onError: (error: unknown) => void) {
  const [board, setBoard] = useState<IssueBoard | null>(null);
  const seq = useRef(-1);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const reload = useCallback(async () => {
    try {
      const next = await issuesApi.board();
      seq.current = next.seq;
      setBoard(next);
    } catch (error) {
      errorRef.current(error);
    }
  }, []);
  useEffect(() => {
    void reload();
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { seq: current } = await issuesApi.seq();
        if (alive && current !== seq.current) {
          await reload();
          // an outside change (agent, CLI, other device) may also be in the bell
          refreshNotifications();
        }
      } catch {
        // offline for a moment; the next tick tries again
      }
    };
    const timer = window.setInterval(() => void tick(), POLL_MS);
    const visible = () => void tick();
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [reload]);
  return { board, setBoard, reload };
}
