import { useEffect, useRef, useState } from "react";

const dateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function DatePicker({
  onInsert,
  onCancel,
}: {
  onInsert: (date: string) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(() => dateValue(new Date()));
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <dialog
      ref={dialog}
      className="date-picker"
      aria-label="Insert date"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2>Insert date</h2>
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
      <div className="calendar-header">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!/^\d{4}-\d{2}-\d{2}$/.test(selected)}
          onClick={() => onInsert(selected)}
        >
          Insert date
        </button>
      </div>
    </dialog>
  );
}
