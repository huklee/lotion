import {
  AlignLeft,
  Calendar,
  CircleChevronDown,
  Hash,
  SquareCheck,
  Type,
} from "lucide-react";
import type { DatabasePropertyType } from "../../packages/database/model";

const PILL_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

/** Stable color for a select option: its position in the option list. */
export function optionColor(options: string[] | undefined, value: string) {
  const index = (options ?? []).indexOf(value);
  return PILL_COLORS[(index < 0 ? 0 : index) % PILL_COLORS.length];
}

export function pillStyle(color: string) {
  return {
    background: `var(--lotion-${color}-background)`,
    color: `var(--lotion-${color}-text, inherit)`,
  };
}

export function TypeIcon({
  type,
  size = 14,
}: {
  type: DatabasePropertyType | "title";
  size?: number;
}) {
  const props = { size, "aria-hidden": true, className: "ldb-type-icon" };
  switch (type) {
    case "title":
      return <Type {...props} />;
    case "number":
      return <Hash {...props} />;
    case "select":
      return <CircleChevronDown {...props} />;
    case "checkbox":
      return <SquareCheck {...props} />;
    case "date":
      return <Calendar {...props} />;
    default:
      return <AlignLeft {...props} />;
  }
}

export const TYPE_NAMES: Record<DatabasePropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  checkbox: "Checkbox",
  date: "Date",
};

/** "2026-10-16" → "Oct 16, 2026" in the reader's locale (no timezone shift). */
export function formatDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
