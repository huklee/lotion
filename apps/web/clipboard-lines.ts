import {
  contentSchema,
  type Block,
} from "../../packages/document-schema/index";

type ClipboardLineOptions = { omitTerminalDelimiter?: boolean };

export function clipboardTextLines(
  text: string,
  { omitTerminalDelimiter = false }: ClipboardLineOptions = {},
): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (omitTerminalDelimiter && lines.length > 1 && lines.at(-1) === "")
    lines.pop();
  return lines;
}

export function clipboardLines(
  text: string,
  options?: ClipboardLineOptions,
): Block[] {
  const lines = clipboardTextLines(text, options);
  if (lines.length > 10000)
    throw new Error(
      "Paste supports at most 10,000 lines. Paste smaller sections.",
    );
  return lines.map((line, index) => {
    const block: Block = {
      id: crypto.randomUUID(),
      type: "paragraph",
      content: [{ type: "text", text: line, styles: {} }],
    };
    if (!contentSchema.safeParse({ title: "", blocks: [block] }).success)
      throw new Error(
        `Line ${index + 1} cannot be saved. The paste was not inserted.`,
      );
    return block;
  });
}
