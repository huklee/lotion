import { readableCodeColor } from "./code-colors";

/**
 * The editor's code-block highlighter (Shiki, loaded on first use): GitHub
 * light high-contrast, with colours darkened for Lotion's warmer surface, and
 * GitHub dark.
 */
export async function createCodeHighlighter() {
  const { createHighlighter } = await import("shiki");
  const { default: lightTheme } =
    await import("@shikijs/themes/github-light-high-contrast");
  return createHighlighter({
    themes: [
      {
        ...lightTheme,
        // The stock palette targets white, not our warmer beige surface.
        tokenColors: lightTheme.tokenColors?.map((token) => ({
          ...token,
          settings: {
            ...token.settings,
            ...(token.settings.foreground
              ? { foreground: readableCodeColor(token.settings.foreground) }
              : {}),
          },
        })),
      },
      "github-dark",
    ],
    langs: ["json", "html", "python", "go", "cpp"],
  });
}
