/**
 * Keyboard-only use of the issue board (ADR-026 stage 2), Vimium style.
 * Pure: the board's columns and the focused card go in, an action comes out.
 */

export type BoardColumns = { status: string; numbers: number[] }[];

export type KeyInput = {
  key: string;
  shift?: boolean;
  meta?: boolean;
  ctrl?: boolean;
  alt?: boolean;
};

export type BoardAction =
  | { type: "focus"; number: number }
  | { type: "move"; number: number; status: string; before: number | null }
  | { type: "open"; number: number }
  | { type: "edit"; number: number }
  | { type: "note"; number: number }
  | { type: "description"; number: number }
  | { type: "status"; number: number }
  | { type: "priority"; number: number }
  | { type: "labels"; number: number }
  | { type: "archive"; number: number }
  | { type: "delete"; number: number }
  | { type: "select"; number: number }
  | { type: "selectAll" }
  | { type: "new"; status: string }
  | { type: "filter" }
  | { type: "hints" }
  | { type: "help" };

export const BOARD_SHORTCUTS: [keys: string, what: string][] = [
  ["f", "Hints on every card, button and field; type one to use it"],
  ["j / k", "Next / previous card"],
  ["h / l", "Card in the column to the left / right"],
  ["⇧J / ⇧K", "Move the card down / up"],
  ["⇧H / ⇧L", "Move the card to the left / right column"],
  ["s", "Set the status (1, 2, … or j/k and Enter)"],
  ["p", "Set the priority (0 none … 4 urgent)"],
  ["t", "Edit the labels"],
  ["x", "Mark done (again: back to the first column)"],
  ["o / Enter", "Open the card"],
  ["e", "Edit the title"],
  ["d", "Edit the description (⌘/Ctrl+Enter saves)"],
  ["m", "Add a status note (Enter adds it)"],
  ["c", "New issue in this column"],
  ["v / ⇧V", "Select the card / every card shown (⌘-click, ⇧-click)"],
  ["a", "Archive (the selection, or this card)"],
  ["Delete", "Delete (asks first)"],
  ["/", "Filter the board"],
  ["Esc", "Clear the selection, or close the panel, hints or filter"],
  ["g i / g h", "Go to Issues / Home from anywhere"],
  ["?", "These shortcuts"],
];

function locate(columns: BoardColumns, number: number | null) {
  if (number === null) return null;
  for (let c = 0; c < columns.length; c++) {
    const r = columns[c].numbers.indexOf(number);
    if (r >= 0) return { c, r };
  }
  return null;
}

const firstCard = (columns: BoardColumns) =>
  columns.find((col) => col.numbers.length)?.numbers[0] ?? null;

/** The nearest non-empty column in a direction, keeping the row if possible. */
function sideways(
  columns: BoardColumns,
  c: number,
  r: number,
  step: 1 | -1,
): number | null {
  for (let i = c + step; i >= 0 && i < columns.length; i += step) {
    const numbers = columns[i].numbers;
    if (numbers.length) return numbers[Math.min(r, numbers.length - 1)];
  }
  return null;
}

export function boardKey(
  input: KeyInput,
  columns: BoardColumns,
  focused: number | null,
): BoardAction | null {
  if (input.meta || input.ctrl || input.alt) return null;
  const key = input.key;
  const at = locate(columns, focused);
  switch (key) {
    case "?":
      return { type: "help" };
    case "/":
      return { type: "filter" };
    case "f":
      return { type: "hints" };
    case "V":
      return { type: "selectAll" };
    case "c":
      return {
        type: "new",
        status: at ? columns[at.c].status : columns[0]?.status,
      };
  }
  if (!at) {
    // nothing focused yet: any movement key starts at the first card
    if (["j", "k", "h", "l", "ArrowDown", "ArrowUp"].includes(key)) {
      const first = firstCard(columns);
      return first === null ? null : { type: "focus", number: first };
    }
    return null;
  }
  const { c, r } = at;
  const numbers = columns[c].numbers;
  const number = numbers[r];
  switch (key) {
    case "j":
    case "ArrowDown":
      return r + 1 < numbers.length
        ? { type: "focus", number: numbers[r + 1] }
        : null;
    case "k":
    case "ArrowUp":
      return r > 0 ? { type: "focus", number: numbers[r - 1] } : null;
    case "h":
    case "l": {
      const next = sideways(columns, c, r, key === "h" ? -1 : 1);
      return next === null ? null : { type: "focus", number: next };
    }
    case "J":
      return r + 1 < numbers.length
        ? {
            type: "move",
            number,
            status: columns[c].status,
            before: numbers[r + 2] ?? null,
          }
        : null;
    case "K":
      return r > 0
        ? {
            type: "move",
            number,
            status: columns[c].status,
            before: numbers[r - 1],
          }
        : null;
    case "H":
    case "L": {
      const target = columns[c + (key === "H" ? -1 : 1)];
      if (!target) return null;
      return {
        type: "move",
        number,
        status: target.status,
        before: target.numbers[r] ?? null,
      };
    }
    case "x": {
      const last = columns.at(-1)!;
      const status =
        columns[c].status === last.status ? columns[0].status : last.status;
      return { type: "move", number, status, before: null };
    }
    case "o":
    case "Enter":
      return { type: "open", number };
    case "e":
      return { type: "edit", number };
    case "m":
      return { type: "note", number };
    case "d":
      return { type: "description", number };
    case "s":
      return { type: "status", number };
    case "p":
      return { type: "priority", number };
    case "t":
      return { type: "labels", number };
    case "a":
      return { type: "archive", number };
    case "Delete":
    case "Backspace":
      return { type: "delete", number };
    case "v":
      return { type: "select", number };
  }
  return null;
}

const HINT_CHARS = "asdfghjklqwertyuiopzxcvbnm";

/**
 * Vimium-style hint labels: single letters while they suffice, otherwise two
 * letters for every target (so no label is a prefix of another).
 */
export function hintLabels(count: number): string[] {
  if (count <= HINT_CHARS.length) return [...HINT_CHARS.slice(0, count)];
  const labels: string[] = [];
  for (const a of HINT_CHARS)
    for (const b of HINT_CHARS) {
      if (labels.length === count) return labels;
      labels.push(a + b);
    }
  return labels;
}

/** Typed hint letters: the chosen index, still-possible labels, or no match. */
export function matchHint(
  labels: string[],
  typed: string,
): { chosen: number } | { remaining: number } | null {
  const exact = labels.indexOf(typed);
  if (exact >= 0) return { chosen: exact };
  const remaining = labels.filter((l) => l.startsWith(typed)).length;
  return remaining ? { remaining } : null;
}
