import { useEffect, useRef, useState } from "react";

const dateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * The calendar dialog behind @date mentions, also used for issue deadlines.
 * With `withTime` it adds a time field (HH:MM) and quick choices, and
 * `onInsert` receives the time as its second argument.
 */
export function DatePicker({
  onInsert,
  onCancel,
  onClear,
  initial,
  initialTime = "23:59",
  withTime = false,
  title = "Insert date",
  confirmLabel = "Insert date",
}: {
  onInsert: (date: string, time?: string) => void;
  onCancel: () => void;
  /** Shows a Clear button (e.g. to remove a deadline). */
  onClear?: () => void;
  /** YYYY-MM-DD to start from (default: today). */
  initial?: string;
  initialTime?: string;
  withTime?: boolean;
  title?: string;
  confirmLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const insertButton = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState(
    () => initial ?? dateValue(new Date()),
  );
  const [time, setTime] = useState(initialTime);
  const [month, setMonth] = useState(() => {
    const [y, m] = (initial ?? dateValue(new Date())).split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const pick = (date: Date) => {
    setSelected(dateValue(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };
  const confirm = () =>
    withTime ? onInsert(selected, time) : onInsert(selected);
  useEffect(() => {
    dialog.current?.showModal();
    const focusTimer = window.setTimeout(
      () => insertButton.current?.focus(),
      50,
    );
    return () => window.clearTimeout(focusTimer);
  }, []);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <dialog
      ref={dialog}
      className="date-picker"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        confirm();
      }}
    >
      <h2>{title}</h2>
      {withTime && (
        <div className="calendar-quick" role="group" aria-label="Quick choices">
          <button type="button" onClick={() => pick(new Date())}>
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              pick(d);
            }}
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 7);
              pick(d);
            }}
          >
            Next week
          </button>
        </div>
      )}
      <div className="calendar-header">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ‹
        </button>
        <strong aria-live="polite">
          {month.getFullYear()}-{String(month.getMonth() + 1).padStart(2, "0")}
        </strong>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
        {Array.from({ length: month.getDay() }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const value = dateValue(
            new Date(month.getFullYear(), month.getMonth(), i + 1),
          );
          return (
            <button
              key={value}
              type="button"
              aria-label={value}
              aria-pressed={selected === value}
              onClick={() => setSelected(value)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <label>
        Date{" "}
        <input
          type="date"
          value={selected}
          required
          onChange={(event) => {
            setSelected(event.target.value);
            if (event.target.value) {
              const [year, monthNumber] = event.target.value
                .split("-")
                .map(Number);
              setMonth(new Date(year, monthNumber - 1, 1));
            }
          }}
        />
      </label>
      {withTime && (
        <label>
          Time{" "}
          <input
            type="time"
            aria-label="Time"
            value={time}
            required
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
      )}
      <div className="calendar-header">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {onClear && (
          <button type="button" onClick={onClear}>
            Clear
          </button>
        )}
        <button
          ref={insertButton}
          type="button"
          disabled={
            !/^\d{4}-\d{2}-\d{2}$/.test(selected) ||
            (withTime && !/^\d{2}:\d{2}$/.test(time))
          }
          onClick={confirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
