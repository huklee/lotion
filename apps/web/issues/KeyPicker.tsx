import { useEffect, useState } from "react";
import { pillStyle } from "../database-ui";
import { latinKey } from "../keyboard-layout";

export type PickerOption = { value: string; label: string; color?: string };

/**
 * A small keyboard menu (status or priority of one issue): the number keys
 * choose directly, j/k or the arrows move, Enter chooses, Esc closes.
 * It listens in the capture phase, so the board's own keys wait while it is open.
 */
export function KeyPicker({
  title,
  options,
  current,
  firstNumber = 1,
  anchor,
  onChoose,
  onClose,
}: {
  title: string;
  options: PickerOption[];
  current: string;
  /** The number key of the first option (0 for priorities, 1 for statuses). */
  firstNumber?: number;
  anchor: { left: number; top: number } | null;
  onChoose: (value: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === current),
    ),
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = latinKey(event);
      let handled = true;
      if (key === "Escape") onClose();
      else if (key === "Enter") onChoose(options[index].value);
      else if (key === "j" || key === "ArrowDown")
        setIndex((i) => Math.min(options.length - 1, i + 1));
      else if (key === "k" || key === "ArrowUp")
        setIndex((i) => Math.max(0, i - 1));
      else if (/^[0-9]$/.test(key)) {
        const chosen = options[Number(key) - firstNumber];
        if (chosen) onChoose(chosen.value);
      } else handled = false;
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [index, options, firstNumber, onChoose, onClose]);
  return (
    <div
      className="key-picker"
      role="dialog"
      aria-label={title}
      style={
        anchor
          ? {
              left: Math.min(anchor.left, window.innerWidth - 240),
              top: Math.min(
                anchor.top,
                window.innerHeight - 40 * (options.length + 1),
              ),
            }
          : undefined
      }
    >
      <div className="key-picker-title">{title}</div>
      <ul role="listbox" aria-label={title}>
        {options.map((option, i) => (
          <li
            key={option.value}
            role="option"
            aria-selected={i === index}
            className={i === index ? "active" : undefined}
            onMouseEnter={() => setIndex(i)}
            onMouseDown={(event) => {
              event.preventDefault();
              onChoose(option.value);
            }}
          >
            <kbd>{i + firstNumber}</kbd>
            <span
              className="key-picker-label"
              style={option.color ? pillStyle(option.color) : undefined}
            >
              {option.label}
            </span>
            {option.value === current && (
              <span className="key-picker-current">current</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
