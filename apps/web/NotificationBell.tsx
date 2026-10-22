import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Bell,
  CalendarPlus,
  FileText,
  FolderInput,
  Info,
  SquareKanban,
} from "lucide-react";
import { api } from "./api";

export type AppNotification = {
  id: string;
  kind:
    | "meeting.created"
    | "meetings.imported"
    | "summary.done"
    | "summary.failed"
    | "issue.changed"
    | "info";
  title: string;
  detail?: string;
  pageId?: string;
  issue?: number;
  at: string;
};
type List = { items: AppNotification[]; seenAt: string; unread: number };

const REFRESH = "lotion:notifications";

/** Ask open bells to reload now (after something that records an event). */
export function refreshNotifications() {
  window.dispatchEvent(new Event(REFRESH));
}

/** Record a workspace event; failures never interrupt the action that caused it. */
export function recordNotification(event: Omit<AppNotification, "id" | "at">) {
  void api("/api/notifications", {
    method: "POST",
    body: JSON.stringify(event),
  })
    .then(refreshNotifications)
    .catch(() => undefined);
}

const KIND: Record<
  AppNotification["kind"],
  { label: string; icon: typeof Bell }
> = {
  "meeting.created": { label: "New meeting", icon: CalendarPlus },
  "meetings.imported": { label: "Meeting logs created", icon: FolderInput },
  "summary.done": { label: "Summary written", icon: FileText },
  "summary.failed": { label: "Summary failed", icon: AlertTriangle },
  "issue.changed": { label: "Issue", icon: SquareKanban },
  info: { label: "Notice", icon: Info },
};

function relative(at: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}일 전`;
  return new Date(at).toLocaleDateString();
}

function dayLabel(at: string) {
  const d = new Date(at);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/**
 * Top-right bell: unread count, and a panel of workspace events (newest first,
 * grouped by day). Clicking an event opens its page; opening the panel marks all read.
 */
export function NotificationBell({
  openPage,
  openIssue,
}: {
  openPage: (id: string) => void;
  openIssue?: (number: number) => void;
}) {
  const [list, setList] = useState<List>({ items: [], seenAt: "", unread: 0 });
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const load = useCallback(() => {
    void api<List>("/api/notifications?limit=100")
      .then(setList)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    const visible = () => document.visibilityState === "visible" && load();
    window.addEventListener(REFRESH, load);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener(REFRESH, load);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target))
        setOpen(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // keep the "new" marks for this opening, then mark everything read
    setLastSeen(list.seenAt);
    setOpen(true);
    if (list.unread)
      void api<List>("/api/notifications/seen", {
        method: "POST",
        body: JSON.stringify({ at: list.items[0]?.at }),
      })
        .then(setList)
        .catch(() => undefined);
  };

  const now = Date.now();
  let currentDay = "";
  const rect = button.current?.getBoundingClientRect();

  return (
    <>
      <button
        ref={button}
        className="icon-button notification-bell"
        aria-label={`Notifications${list.unread ? ` (${list.unread} unread)` : ""}`}
        aria-expanded={open}
        title="Notifications"
        onClick={toggle}
      >
        <Bell size={16} />
        {list.unread > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {list.unread > 99 ? "99+" : list.unread}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            className="notification-panel"
            role="dialog"
            aria-label="Notifications"
            style={{
              top: (rect?.bottom ?? 48) + 6,
              right: Math.max(12, window.innerWidth - (rect?.right ?? 0) - 8),
            }}
          >
            <header>
              <strong>Notifications</strong>
              <small>{list.items.length ? `${list.items.length}건` : ""}</small>
            </header>
            {list.items.length === 0 ? (
              <p className="notification-empty">
                아직 알림이 없습니다. 새 회의, 요약 회의록 같은 이벤트가 여기에
                시간순으로 쌓입니다.
              </p>
            ) : (
              <ul>
                {list.items.map((item) => {
                  const day = dayLabel(item.at);
                  const heading = day !== currentDay;
                  currentDay = day;
                  const meta = KIND[item.kind] ?? KIND.info;
                  const Icon = meta.icon;
                  const fresh = item.at > lastSeen;
                  return (
                    <li key={item.id}>
                      {heading && <h4>{day}</h4>}
                      <button
                        type="button"
                        className={`notification-item ${item.kind.replace(".", "-")}${fresh ? " fresh" : ""}`}
                        disabled={!item.pageId && !item.issue}
                        onClick={() => {
                          if (item.issue && openIssue) {
                            setOpen(false);
                            openIssue(item.issue);
                            return;
                          }
                          if (!item.pageId) return;
                          setOpen(false);
                          openPage(item.pageId);
                        }}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span className="notification-text">
                          <small>{meta.label}</small>
                          <strong>{item.title}</strong>
                          {item.detail && <span>{item.detail}</span>}
                        </span>
                        <time
                          dateTime={item.at}
                          title={new Date(item.at).toLocaleString()}
                        >
                          {relative(item.at, now)}
                        </time>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
