import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Floating } from "./DatabaseMenus";

export type SummaryEngine = "codex" | "claude";
import { STYLE_OPTIONS, type SummaryStyle } from "./summary-styles";
export { STYLE_OPTIONS, type SummaryStyle };
export type SummarySettings = {
  engine: SummaryEngine;
  skill: string;
  prompt: string;
  slackChannel: string;
  style: SummaryStyle;
};
export type SummaryJob = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  engine: string;
  skill: string;
  title: string;
  sources: { id: string; title: string }[];
  parentId: string;
  summaryId?: string;
  error?: string;
  notified?: boolean;
};
export type SummaryRequest = {
  pages: { id: string; blockIds?: string[] }[];
  parentId: string;
  title?: string;
  style?: SummaryStyle;
};

export const ENGINE_LABEL: Record<string, string> = {
  codex: "Codex",
  claude: "Claude Code",
  test: "Test engine",
};

/** Starts summary jobs and polls them until they finish. */
export function useSummaryJobs(onFinished: (job: SummaryJob) => void) {
  const [jobs, setJobs] = useState<SummaryJob[]>([]);
  const finished = useRef(onFinished);
  finished.current = onFinished;
  const active = jobs.some(
    (j) => j.status === "queued" || j.status === "running",
  );
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setJobs((current) => {
        for (const job of current) {
          if (job.status !== "queued" && job.status !== "running") continue;
          void api<SummaryJob>(`/api/summary/jobs/${job.id}`)
            .then((next) => {
              if (next.status === "done" || next.status === "failed")
                finished.current(next);
              setJobs((list) => list.map((j) => (j.id === next.id ? next : j)));
            })
            .catch(() => undefined);
        }
        return current;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [active]);
  const start = useCallback(async (request: SummaryRequest) => {
    const job = await api<SummaryJob>("/api/summary/jobs", {
      method: "POST",
      body: JSON.stringify(request),
    });
    setJobs((list) => [job, ...list].slice(0, 6));
    return job;
  }, []);
  const dismiss = useCallback(
    (id: string) => setJobs((list) => list.filter((j) => j.id !== id)),
    [],
  );
  return { jobs, start, dismiss };
}

export function SummaryToasts({
  jobs,
  dismiss,
  openPage,
}: {
  jobs: SummaryJob[];
  dismiss: (id: string) => void;
  openPage: (id: string) => void;
}) {
  if (!jobs.length) return null;
  return (
    <div className="summary-toasts" role="status" aria-live="polite">
      {jobs.map((job) => (
        <div key={job.id} className={`summary-toast ${job.status}`}>
          <span className="summary-toast-text">
            {job.status === "done" ? (
              <>📝 요약 완료 · {job.title}</>
            ) : job.status === "failed" ? (
              <>⚠️ 요약 실패 · {job.error}</>
            ) : (
              <>
                <span className="summary-spinner" aria-hidden="true" />{" "}
                {ENGINE_LABEL[job.engine] ?? job.engine}로 요약 중… ·{" "}
                {job.title}
              </>
            )}
            {job.status === "done" && job.notified && (
              <small> · Slack 알림 전송</small>
            )}
          </span>
          {job.status === "done" && job.summaryId && (
            <button
              type="button"
              onClick={() => {
                openPage(job.summaryId!);
                dismiss(job.id);
              }}
            >
              열기
            </button>
          )}
          {(job.status === "done" || job.status === "failed") && (
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(job.id)}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Engine, skill, prompt and Slack channel used by every summary button. */
export function SummarySettingsForm({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<SummarySettings | null>(null);
  const [skills, setSkills] = useState<{ name: string; description: string }[]>(
    [],
  );
  const [status, setStatus] = useState("");
  useEffect(() => {
    void api<SummarySettings>("/api/summary/settings")
      .then(setSettings)
      .catch((e) => setStatus((e as Error).message));
    void api<{ name: string; description: string }[]>("/api/summary/skills")
      .then(setSkills)
      .catch(() => setSkills([]));
  }, []);
  if (!settings)
    return <p className="lotion-database-hint">{status || "Loading…"}</p>;
  const set = (patch: Partial<SummarySettings>) => {
    setSettings({ ...settings, ...patch });
    setStatus("");
  };
  return (
    <form
      className="summary-settings"
      onSubmit={(event) => {
        event.preventDefault();
        void api<SummarySettings>("/api/summary/settings", {
          method: "PUT",
          body: JSON.stringify(settings),
        })
          .then((saved) => {
            setSettings(saved);
            setStatus("Saved");
            onSaved?.();
          })
          .catch((e) => setStatus((e as Error).message));
      }}
    >
      <label>
        Engine
        <select
          aria-label="Summary engine"
          value={settings.engine}
          onChange={(e) => set({ engine: e.target.value as SummaryEngine })}
        >
          <option value="codex">Codex (default)</option>
          <option value="claude">Claude Code</option>
        </select>
      </label>
      <label>
        Default condensing
        <select
          aria-label="Summary style"
          value={settings.style}
          onChange={(e) => set({ style: e.target.value as SummaryStyle })}
        >
          {STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} title={option.hint}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Skill
        <select
          aria-label="Summary skill"
          value={settings.skill}
          onChange={(e) => set({ skill: e.target.value })}
        >
          <option value="">No skill — prompt only</option>
          {skills.map((skill) => (
            <option
              key={skill.name}
              value={skill.name}
              title={skill.description}
            >
              {skill.name}
            </option>
          ))}
          {settings.skill && !skills.some((s) => s.name === settings.skill) && (
            <option value={settings.skill}>{settings.skill} (not found)</option>
          )}
        </select>
      </label>
      <label>
        Prompt
        <textarea
          aria-label="Summary prompt"
          rows={9}
          maxLength={20000}
          value={settings.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
        />
      </label>
      <label>
        Slack channel for “summary ready”
        <input
          aria-label="Slack channel"
          placeholder="C0123ABCD (empty = no notification)"
          value={settings.slackChannel}
          onChange={(e) => set({ slackChannel: e.target.value.trim() })}
        />
      </label>
      <p className="lotion-database-hint">
        The selected meeting text is sent to {ENGINE_LABEL[settings.engine]} to
        write the summary.
      </p>
      <div className="lotion-database-menu-row">
        <button type="submit">Save</button>
        {status && <small role="status">{status}</small>}
      </div>
    </form>
  );
}

/**
 * A summary button: the main part runs with the default condensing style, the ▾
 * part opens a menu to pick the style for this run.
 */
export function SummarizeButton({
  label,
  busy,
  className,
  title,
  onRun,
}: {
  label: string;
  busy?: boolean;
  className?: string;
  title?: string;
  onRun: (style?: SummaryStyle) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <span className={`summarize-split ${className ?? ""}`}>
      <button
        type="button"
        disabled={busy}
        title={title}
        onClick={() => onRun()}
      >
        {busy ? "Starting…" : label}
      </button>
      <button
        type="button"
        className="summarize-more"
        aria-label={`${label}: choose condensing`}
        aria-expanded={!!anchor}
        disabled={busy}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        ▾
      </button>
      {anchor && (
        <Floating
          anchor={anchor}
          label="Condensing"
          onClose={() => setAnchor(null)}
        >
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="summarize-style"
              onClick={() => {
                setAnchor(null);
                onRun(option.value);
              }}
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </Floating>
      )}
    </span>
  );
}
