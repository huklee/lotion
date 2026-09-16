import { useState, useEffect } from "react";
import {
  readBoolean,
  readChoice,
  type ThemeMode,
  type EditorFont,
  type PageWidth,
  type EditorTextSize,
  editorFonts,
} from "./preferences";
import { readFormattingShortcuts } from "./format-shortcuts";
import { applyColorPalette, type ColorScheme } from "./color-palette";

export function useWorkspacePreferences() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    readChoice<ThemeMode>(
      localStorage,
      "theme",
      ["system", "light", "dark", "black"],
      "system",
    ),
  );
  const [systemDark, setSystemDark] = useState(
    matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [sidebarOnStart, setSidebarOnStart] = useState(() =>
    readBoolean(localStorage, "sidebar-on-start", true),
  );
  const [editorFont, setEditorFont] = useState<EditorFont>(() =>
    readChoice(localStorage, "editor-font", editorFonts, "dm-sans"),
  );
  const [editorTextSize, setEditorTextSize] = useState<EditorTextSize>(() =>
    readChoice(
      localStorage,
      "editor-text-size",
      ["small", "medium", "large"],
      "medium",
    ),
  );
  const [pageWidth, setPageWidth] = useState<PageWidth>(() =>
    readChoice(
      localStorage,
      "page-width",
      ["comfortable", "wide"],
      "comfortable",
    ),
  );
  const [formattingShortcuts, setFormattingShortcuts] = useState(() =>
    readFormattingShortcuts(localStorage),
  );
  const colorScheme: ColorScheme =
    themeMode === "system" ? (systemDark ? "dark" : "light") : themeMode;
  const theme: "light" | "dark" = colorScheme === "light" ? "light" : "dark";
  useEffect(() => {
    document.documentElement.dataset.theme = colorScheme;
    applyColorPalette(document.documentElement, colorScheme);
    localStorage.setItem("lotion-theme", themeMode);
  }, [colorScheme, themeMode]);
  useEffect(() => {
    document.documentElement.dataset.editorFont = editorFont;
    document.documentElement.dataset.editorTextSize = editorTextSize;
    document.documentElement.dataset.pageWidth = pageWidth;
    localStorage.setItem("lotion-editor-font", editorFont);
    localStorage.setItem("lotion-editor-text-size", editorTextSize);
    localStorage.setItem("lotion-page-width", pageWidth);
    localStorage.setItem("lotion-sidebar-on-start", String(sidebarOnStart));
  }, [editorFont, editorTextSize, pageWidth, sidebarOnStart]);
  useEffect(() => {
    localStorage.setItem(
      "lotion-formatting-shortcuts",
      JSON.stringify(formattingShortcuts),
    );
  }, [formattingShortcuts]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setSystemDark(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  return {
    themeMode,
    setThemeMode,
    theme,
    sidebarOnStart,
    setSidebarOnStart,
    editorFont,
    setEditorFont,
    editorTextSize,
    setEditorTextSize,
    pageWidth,
    setPageWidth,
    formattingShortcuts,
    setFormattingShortcuts,
  };
}
