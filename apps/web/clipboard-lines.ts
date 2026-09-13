import {
  contentSchema,
  type Block,
} from "../../packages/document-schema/index";

export function clipboardLines(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
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
