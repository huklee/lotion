import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { refreshNotifications } from "../NotificationBell";
import type {
  Issue,
  IssueBoard,
  IssueStatus,
} from "../../../packages/issues/model";

const json = (method: string, body?: unknown, headers?: HeadersInit) => ({
  method,
  headers,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const issuesApi = {
  board: (archived = false) =>
    api<IssueBoard>(`/api/issues${archived ? "?archived=include" : ""}`),
  forPage: (pageId: string) =>
    api<IssueBoard>(
      `/api/issues?${new URLSearchParams({ page: pageId, archived: "include" })}`,
    ),
  seq: () => api<{ seq: number }>("/api/issues/seq"),
  get: (n: number) => api<Issue>(`/api/issues/${n}`),
  create: (input: {
    title: string;
    status?: string;
    body?: string;
    links?: string[];
    source?: { pageId: string; blockId: string };
  }) => api<Issue>("/api/issues", json("POST", input)),
  patch: (n: number, version: number, input: Record<string, unknown>) =>
    api<Issue>(
      `/api/issues/${n}`,
      json("PATCH", input, { "If-Match": `"${version}"` }),
    ),
  /** A change without a version check (status/priority from the keyboard). */
  set: (n: number, input: Record<string, unknown>) =>
    api<Issue>(`/api/issues/${n}`, json("PATCH", input)),
  move: (n: number, status: string, before: number | null) =>
    api<Issue>(`/api/issues/${n}/move`, json("POST", { status, before })),
  note: (n: number, text: string) =>
    api<Issue>(`/api/issues/${n}/notes`, json("POST", { text })),
  setStatuses: (statuses: IssueStatus[]) =>
    api<{ statuses: IssueStatus[] }>(
      "/api/issues/config",
      json("PUT", { statuses }),
    ),
  renameLabel: (from: string, to: string | null) =>
    api<{ changed: number }>("/api/issues/labels", json("POST", { from, to })),
  archiveColumn: (status: string) =>
    api<{ archived: number }>("/api/issues/archive", json("POST", { status })),
  bulk: (input: {
    numbers: number[];
    status?: string;
    priority?: string;
    addLabels?: string[];
    removeLabels?: string[];
    archived?: boolean;
    delete?: true;
  }) =>
    api<{ changed: number[]; deleted: number[] }>(
      "/api/issues/bulk",
      json("POST", input),
    ),
  editNote: (n: number, id: string, text: string) =>
    api<Issue>(`/api/issues/${n}/notes/${id}`, json("PATCH", { text })),
  deleteNote: (n: number, id: string) =>
    api<Issue>(`/api/issues/${n}/notes/${id}`, json("DELETE")),
  remove: (n: number) =>
    api<{ deleted: number }>(`/api/issues/${n}`, json("DELETE")),
};

export const POLL_MS = 5000;

/**
 * The board, refreshed whenever the server's change counter moves (checked
 * every few seconds while the tab is visible), so changes made by the CLI or
 * another device appear without a reload.
 */
export function useIssueBoard(
  onError: (error: unknown) => void,
  archived = false,
) {
  const [board, setBoard] = useState<IssueBoard | null>(null);
  const seq = useRef(-1);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const reload = useCallback(async () => {
    try {
      const next = await issuesApi.board(archived);
      // a slower, older answer (an overlapping poll) must not undo a newer board
      if (next.seq < seq.current) return;
      seq.current = next.seq;
      setBoard(next);
    } catch (error) {
      errorRef.current(error);
    }
  }, [archived]);
  useEffect(() => {
    // a different board (archived shown or not) starts from its own counter
    seq.current = -1;
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
