import { useState, useEffect } from "react";
import {
  type ThemeMode,
  type EditorFont,
  type PageWidth,
  type EditorTextSize,
  editorFonts,
} from "./preferences";
import { readFormattingShortcuts } from "./format-shortcuts";
import { applyColorPalette, type ColorScheme } from "./color-palette";
import { prefs, safeStorage } from "./browser-prefs";

export function useWorkspacePreferences() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    prefs.choice<ThemeMode>(
      "theme",
      ["system", "light", "dark", "black"],
      "system",
    ),
  );
  const [systemDark, setSystemDark] = useState(
    matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [sidebarOnStart, setSidebarOnStart] = useState(() =>
    prefs.bool("sidebar-on-start", true),
  );
  const [editorFont, setEditorFont] = useState<EditorFont>(() =>
    prefs.choice("editor-font", editorFonts, "dm-sans"),
  );
  const [editorTextSize, setEditorTextSize] = useState<EditorTextSize>(() =>
    prefs.choice("editor-text-size", ["small", "medium", "large"], "medium"),
  );
  const [pageWidth, setPageWidth] = useState<PageWidth>(() =>
    prefs.choice("page-width", ["comfortable", "wide"], "comfortable"),
  );
  const [formattingShortcuts, setFormattingShortcuts] = useState(() =>
    readFormattingShortcuts(safeStorage()),
  );
  const colorScheme: ColorScheme =
    themeMode === "system" ? (systemDark ? "dark" : "light") : themeMode;
  const theme: "light" | "dark" = colorScheme === "light" ? "light" : "dark";
  useEffect(() => {
    document.documentElement.dataset.theme = colorScheme;
    applyColorPalette(document.documentElement, colorScheme);
    prefs.set("theme", themeMode);
  }, [colorScheme, themeMode]);
  useEffect(() => {
    document.documentElement.dataset.editorFont = editorFont;
    document.documentElement.dataset.editorTextSize = editorTextSize;
    document.documentElement.dataset.pageWidth = pageWidth;
    prefs.set("editor-font", editorFont);
    prefs.set("editor-text-size", editorTextSize);
    prefs.set("page-width", pageWidth);
    prefs.set("sidebar-on-start", String(sidebarOnStart));
  }, [editorFont, editorTextSize, pageWidth, sidebarOnStart]);
  useEffect(() => {
    prefs.setJson("formatting-shortcuts", formattingShortcuts);
  }, [formattingShortcuts]);
  // shortcuts changed in another tab apply here too, without a reload
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === "lotion-formatting-shortcuts")
        setFormattingShortcuts(readFormattingShortcuts(safeStorage()));
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
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
