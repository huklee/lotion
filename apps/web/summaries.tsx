import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Floating } from "./DatabaseMenus";

export type SummaryEngine = "codex" | "claude";
import {
  publishSummaryPresets,
  useSummaryPresets,
  type SummaryPreset,
  type SummaryStyle,
} from "./summary-styles";
export { type SummaryStyle };
export type SummarySettings = {
  engine: SummaryEngine;
  skill: string;
  prompt: string;
  slackChannel: string;
  style: SummaryStyle;
  presets: SummaryPreset[];
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

type SlackChannel = { id: string; name: string; private: boolean };

/** Notification channel: picked from the channels the Slack bot can post to. */
function SlackChannelField({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [channels, setChannels] = useState<SlackChannel[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    void api<SlackChannel[]>("/api/summary/slack-channels")
      .then(setChannels)
      .catch((e) => {
        setChannels(null);
        setError((e as Error).message);
      });
  }, []);
  useEffect(load, [load]);
  return (
    <label>
      Slack channel for “summary ready”
      <span className="summary-channel">
        {channels ? (
          <select
            aria-label="Slack channel"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">No notification</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.private ? "🔒 " : "#"}
                {channel.name}
              </option>
            ))}
            {value && !channels.some((c) => c.id === value) && (
              <option value={value}>{value} (not available)</option>
            )}
          </select>
        ) : (
          <input
            aria-label="Slack channel"
            placeholder="C0123ABCD (empty = no notification)"
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
          />
        )}
        <button
          type="button"
          aria-label="Reload Slack channels"
          title="Reload channels"
          onClick={load}
        >
          ↻
        </button>
      </span>
      {error && (
        <small className="lotion-database-hint">
          Channel list unavailable ({error}); enter a channel id instead.
        </small>
      )}
      {channels && channels.length === 0 && (
        <small className="lotion-database-hint">
          The Slack bot has not joined any channel yet — invite it to one.
        </small>
      )}
    </label>
  );
}

/** Add, edit, duplicate, delete and reset the condensing presets. */
function PresetEditor({
  presets,
  defaultId,
  onChange,
}: {
  presets: SummaryPreset[];
  defaultId: string;
  onChange: (presets: SummaryPreset[], defaultId?: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(presets[0]?.id ?? "");
  const selected = presets.find((p) => p.id === selectedId) ?? presets[0];
  const patch = (change: Partial<SummaryPreset>) =>
    onChange(
      presets.map((p) => (p.id === selected.id ? { ...p, ...change } : p)),
    );
  const add = (base?: SummaryPreset) => {
    const id = `custom-${Math.random().toString(36).slice(2, 8)}`;
    const preset: SummaryPreset = base
      ? { ...base, id, label: `${base.label} 복사본` }
      : {
          id,
          label: "새 회의록 형식",
          hint: "",
          rules: '## 결정 사항\n## 액션 아이템 — "- [ ] 할 일 — 담당자, 기한"',
        };
    onChange([...presets, preset]);
    setSelectedId(id);
  };
  return (
    <fieldset className="preset-editor">
      <legend>Meeting-note formats (presets)</legend>
      <div className="preset-list" role="listbox" aria-label="Presets">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="option"
            aria-selected={preset.id === selected?.id}
            onClick={() => setSelectedId(preset.id)}
          >
            {preset.label || "Untitled"}
            {preset.id === defaultId && <small> · default</small>}
          </button>
        ))}
      </div>
      <div className="lotion-database-menu-row">
        <button
          type="button"
          disabled={presets.length >= 30}
          onClick={() => add()}
        >
          + New
        </button>
        <button
          type="button"
          disabled={!selected || presets.length >= 30}
          onClick={() => add(selected)}
        >
          Duplicate
        </button>
        <button
          type="button"
          disabled={!selected || selected.id === defaultId}
          onClick={() => onChange(presets, selected.id)}
        >
          Set as default
        </button>
        <button
          type="button"
          className="danger"
          disabled={presets.length <= 1}
          onClick={() => {
            const rest = presets.filter((p) => p.id !== selected.id);
            onChange(rest, selected.id === defaultId ? rest[0].id : undefined);
            setSelectedId(rest[0].id);
          }}
        >
          Delete
        </button>
      </div>
      {selected && (
        <>
          <label>
            Name
            <input
              aria-label="Preset name"
              maxLength={60}
              value={selected.label}
              onChange={(e) => patch({ label: e.target.value })}
            />
          </label>
          <label>
            Short description
            <input
              aria-label="Preset description"
              maxLength={200}
              value={selected.hint}
              onChange={(e) => patch({ hint: e.target.value })}
            />
          </label>
          <label>
            Format and length rules
            <textarea
              aria-label="Preset rules"
              rows={8}
              maxLength={8000}
              value={selected.rules}
              onChange={(e) => patch({ rules: e.target.value })}
            />
          </label>
        </>
      )}
    </fieldset>
  );
}

/**
 * Summary settings. `compact` (database toolbar) edits engine, skill, default
 * format and Slack channel; `full` (Control panel) adds the prompt and the format
 * (preset) editor.
 */
export function SummarySettingsForm({
  variant = "compact",
  onSaved,
}: {
  variant?: "compact" | "full";
  onSaved?: () => void;
}) {
  const [settings, setSettings] = useState<SummarySettings | null>(null);
  const [skills, setSkills] = useState<{ name: string; description: string }[]>(
    [],
  );
  const [status, setStatus] = useState("");
  const [defaults, setDefaults] = useState<SummaryPreset[] | null>(null);
  useEffect(() => {
    void api<SummarySettings>("/api/summary/settings")
      .then(setSettings)
      .catch((e) => setStatus((e as Error).message));
    void api<{ name: string; description: string }[]>("/api/summary/skills")
      .then(setSkills)
      .catch(() => setSkills([]));
    if (variant === "full")
      void api<SummaryPreset[]>("/api/summary/default-presets")
        .then(setDefaults)
        .catch(() => setDefaults(null));
  }, [variant]);
  if (!settings)
    return <p className="lotion-database-hint">{status || "Loading…"}</p>;
  const set = (patch: Partial<SummarySettings>) => {
    setSettings({ ...settings, ...patch });
    setStatus("");
  };
  return (
    <form
      className={`summary-settings ${variant}`}
      onSubmit={(event) => {
        event.preventDefault();
        void api<SummarySettings>("/api/summary/settings", {
          method: "PUT",
          body: JSON.stringify(settings),
        })
          .then((saved) => {
            setSettings(saved);
            publishSummaryPresets({
              presets: saved.presets,
              style: saved.style,
            });
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
        Default format
        <select
          aria-label="Summary style"
          value={settings.style}
          onChange={(e) => set({ style: e.target.value })}
        >
          {settings.presets.map((preset) => (
            <option key={preset.id} value={preset.id} title={preset.hint}>
              {preset.label}
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
      <SlackChannelField
        value={settings.slackChannel}
        onChange={(slackChannel) => set({ slackChannel })}
      />
      {variant === "full" ? (
        <>
          <label>
            Prompt
            <textarea
              aria-label="Summary prompt"
              rows={6}
              maxLength={20000}
              value={settings.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
            />
          </label>
          <PresetEditor
            presets={settings.presets}
            defaultId={settings.style}
            onChange={(presets, style) =>
              set(style ? { presets, style } : { presets })
            }
          />
          {defaults && (
            <button
              type="button"
              className="settings-reset"
              onClick={() =>
                set({
                  presets: [
                    ...defaults,
                    ...settings.presets.filter(
                      (p) => !defaults.some((d) => d.id === p.id),
                    ),
                  ],
                })
              }
            >
              Restore built-in formats (keeps your own)
            </button>
          )}
        </>
      ) : (
        <p className="lotion-database-hint">
          Edit the prompt and meeting-note formats in Control panel → Meeting
          summaries.
        </p>
      )}
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
  const { presets, style } = useSummaryPresets();
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
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="summarize-style"
              onClick={() => {
                setAnchor(null);
                onRun(preset.id);
              }}
            >
              <strong>
                {preset.label}
                {preset.id === style ? " · default" : ""}
              </strong>
              {preset.hint && <small>{preset.hint}</small>}
            </button>
          ))}
        </Floating>
      )}
    </span>
  );
}
