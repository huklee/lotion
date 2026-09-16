import type {
  Dispatch,
  SetStateAction,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Settings2 } from "lucide-react";
import type { ThemeMode, EditorTextSize, PageWidth } from "./preferences";
import {
  assignFormattingShortcut,
  defaultFormattingShortcuts,
  displayShortcut,
  shortcutFromKeyboardEvent,
  textColors,
  type FormattingShortcutTarget,
  type FormattingShortcuts,
} from "./format-shortcuts";

type SettingsPanelProps = {
  themeMode: ThemeMode;
  setThemeMode: Dispatch<SetStateAction<ThemeMode>>;
  editorTextSize: EditorTextSize;
  setEditorTextSize: Dispatch<SetStateAction<EditorTextSize>>;
  pageWidth: PageWidth;
  setPageWidth: Dispatch<SetStateAction<PageWidth>>;
  sidebarOnStart: boolean;
  setSidebarOnStart: Dispatch<SetStateAction<boolean>>;
  formattingShortcuts: FormattingShortcuts;
  setFormattingShortcuts: Dispatch<SetStateAction<FormattingShortcuts>>;
};

export function SettingsPanel({
  themeMode,
  setThemeMode,
  editorTextSize,
  setEditorTextSize,
  pageWidth,
  setPageWidth,
  sidebarOnStart,
  setSidebarOnStart,
  formattingShortcuts,
  setFormattingShortcuts,
}: SettingsPanelProps) {
  const colorLabels = Object.fromEntries(
    textColors.map((color) => [
      color,
      color === "default"
        ? "Default text"
        : `${color[0].toUpperCase()}${color.slice(1)} text`,
    ]),
  ) as Record<(typeof textColors)[number], string>;
  function captureFormattingShortcut(
    event: ReactKeyboardEvent<HTMLInputElement>,
    target: FormattingShortcutTarget,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      setFormattingShortcuts((current) =>
        assignFormattingShortcut(current, target, ""),
      );
      return;
    }
    const shortcut = shortcutFromKeyboardEvent(event.nativeEvent);
    if (shortcut)
      setFormattingShortcuts((current) =>
        assignFormattingShortcut(current, target, shortcut),
      );
  }

  return (
    <>
      <div className="modal-symbol">
        <Settings2 size={24} />
      </div>
      <h2>Control panel</h2>
      <p>
        Adjust this browser&apos;s workspace display. These settings do not
        change shared document data.
      </p>
      <div className="settings-list">
        <label className="settings-row">
          <span>
            Appearance
            <small>Follow the system or choose a fixed theme.</small>
          </span>
          <select
            aria-label="Appearance theme"
            value={themeMode}
            onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="black">Black</option>
          </select>
        </label>
        <label className="settings-row">
          <span>
            Editor text
            <small>Change document text without changing content.</small>
          </span>
          <select
            aria-label="Editor text size"
            value={editorTextSize}
            onChange={(event) =>
              setEditorTextSize(event.target.value as EditorTextSize)
            }
          >
            <option value="small">Small</option>
            <option value="medium">Default</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label className="settings-row">
          <span>
            Page width
            <small>Use a focused or expanded writing canvas.</small>
          </span>
          <select
            aria-label="Page width"
            value={pageWidth}
            onChange={(event) => setPageWidth(event.target.value as PageWidth)}
          >
            <option value="comfortable">Comfortable</option>
            <option value="wide">Wide</option>
          </select>
        </label>
        <label className="settings-row settings-toggle">
          <span>
            Open sidebar on startup
            <small>The top-bar button can still show or hide it.</small>
          </span>
          <input
            aria-label="Open sidebar on startup"
            type="checkbox"
            checked={sidebarOnStart}
            onChange={(event) => setSidebarOnStart(event.target.checked)}
          />
        </label>
      </div>
      <button
        className="settings-reset"
        onClick={() => {
          setThemeMode("system");
          setEditorTextSize("medium");
          setPageWidth("comfortable");
          setSidebarOnStart(true);
        }}
      >
        Reset display settings
      </button>
      <h3 className="settings-heading">Formatting shortcuts</h3>
      <p className="settings-description">
        Focus a field and press a modifier shortcut. Backspace clears it.
        Assigning a shortcut moves it from any previous action.
      </p>
      <div className="shortcut-settings">
        {textColors.map((color) => (
          <label className="shortcut-setting" key={color}>
            <span>
              <i className="text-color-swatch" data-text-color={color}>
                A
              </i>
              {colorLabels[color]}
            </span>
            <input
              aria-label={`${colorLabels[color]} shortcut`}
              placeholder="Unassigned"
              readOnly
              value={displayShortcut(formattingShortcuts.textColors[color])}
              onKeyDown={(event) => captureFormattingShortcut(event, color)}
            />
          </label>
        ))}
        <label className="shortcut-setting shortcut-repeat">
          <span>
            Repeat last color
            <small>Reapply the last text or background color.</small>
          </span>
          <input
            aria-label="Repeat last color shortcut"
            placeholder="Unassigned"
            readOnly
            value={displayShortcut(formattingShortcuts.repeatLast)}
            onKeyDown={(event) =>
              captureFormattingShortcut(event, "repeatLast")
            }
          />
        </label>
      </div>
      <button
        className="settings-reset"
        onClick={() =>
          setFormattingShortcuts(structuredClone(defaultFormattingShortcuts))
        }
      >
        Reset formatting shortcuts
      </button>
    </>
  );
}
