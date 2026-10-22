/**
 * Single-key shortcuts by physical key, so they work whatever the keyboard
 * layout or input mode: with Korean (두벌식) input the J key reports "ㅓ" and
 * IMEs may report "Process", but `code` is still "KeyJ".
 */

const PUNCTUATION: Record<string, [string, string]> = {
  Slash: ["/", "?"],
  Period: [".", ">"],
  Comma: [",", "<"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  Backquote: ["`", "~"],
  Backslash: ["\\", "|"],
};

export type KeyLike = { key: string; code?: string; shiftKey?: boolean };

/** The key as it would read on a US layout; named keys (Enter, Escape…) stay. */
export function latinKey(event: KeyLike): string {
  const { key, code = "", shiftKey = false } = event;
  // plain ASCII characters and named keys are already what shortcuts expect
  if (key.length > 1 && key !== "Process" && key !== "Unidentified") return key;
  if (key.length === 1 && key.charCodeAt(0) < 128) return key;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return shiftKey ? letter[1] : letter[1].toLowerCase();
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit && !shiftKey) return digit[1];
  const mark = PUNCTUATION[code];
  if (mark) return mark[shiftKey ? 1 : 0];
  return key;
}
