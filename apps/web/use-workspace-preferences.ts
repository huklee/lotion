import { useState, useEffect } from "react";
import {
  readBoolean,
  readChoice,
  type ThemeMode,
  type PageWidth,
  type EditorTextSize,
} from "./preferences";
import { readFormattingShortcuts } from "./format-shortcuts";

export function useWorkspacePreferences() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(
      readChoice<ThemeMode>(
        localStorage,
        "theme",
        ["system", "light", "dark"],
        "system",
      ),
    ),
    [systemDark, setSystemDark] = useState(
      matchMedia("(prefers-color-scheme: dark)").matches,
    );
  const [sidebarOnStart, setSidebarOnStart] = useState(() =>
    readBoolean(localStorage, "sidebar-on-start", true),
  );
  const [editorTextSize, setEditorTextSize] = useState<EditorTextSize>(() =>
      readChoice(
        localStorage,
        "editor-text-size",
        ["small", "medium", "large"],
        "medium",
      ),
    ),
    [pageWidth, setPageWidth] = useState<PageWidth>(() =>
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
  const theme =
    themeMode === "system"
      ? systemDark
        ? "dark"
        : "light"
      : (themeMode as "dark" | "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lotion-theme", themeMode);
  }, [theme, themeMode]);
  useEffect(() => {
    document.documentElement.dataset.editorTextSize = editorTextSize;
    document.documentElement.dataset.pageWidth = pageWidth;
    localStorage.setItem("lotion-editor-text-size", editorTextSize);
    localStorage.setItem("lotion-page-width", pageWidth);
    localStorage.setItem("lotion-sidebar-on-start", String(sidebarOnStart));
  }, [editorTextSize, pageWidth, sidebarOnStart]);
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
    editorTextSize,
    setEditorTextSize,
    pageWidth,
    setPageWidth,
    formattingShortcuts,
    setFormattingShortcuts,
  };
}
