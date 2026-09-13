/** Recognize a single complete fenced Mermaid block, leaving ordinary paste alone. */
export function mermaidFromClipboard(text: string): string | null {
  const match = text
    .trim()
    .replace(/\r\n?/g, "\n")
    .match(/^(`{3,}|~{3,})mermaid[^\S\n]*\n([\s\S]*?)\n\1$/i);
  if (
    !match ||
    match[2].length > 20000 ||
    !match[2].trim() ||
    /^[ \t]*(?:`{3,}|~{3,})/m.test(match[2])
  )
    return null;
  return match[2];
}
