import { FocusEffectSettings } from "./issues/focus-effect";
import type {
  Dispatch,
  SetStateAction,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Settings2 } from "lucide-react";
import { SummarySettingsForm } from "./summaries";
import { endSession } from "./api";
import {
  getPasteEngine,
  setPasteEngine,
  type PasteEngine,
} from "./paste/engine-choice";
import type {
  EditorFont,
  ThemeMode,
  EditorTextSize,
  PageWidth,
} from "./preferences";
import {
  assignFormattingShortcut,
  defaultFormattingShortcuts,
  displayShortcut,
  shortcutFromKeyboardEvent,
  colorPresets,
  type FormattingShortcutTarget,
  type FormattingShortcuts,
} from "./format-shortcuts";

type SettingsPanelProps = {
  themeMode: ThemeMode;
  setThemeMode: Dispatch<SetStateAction<ThemeMode>>;
  editorFont: EditorFont;
  setEditorFont: Dispatch<SetStateAction<EditorFont>>;
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
  editorFont,
  setEditorFont,
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
    colorPresets.map((color) => [
      color,
      color === "default"
        ? "Default colors"
        : `${color[0].toUpperCase()}${color.slice(1)} preset`,
    ]),
  ) as Record<(typeof colorPresets)[number], string>;
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
        Manage this browser&apos;s system appearance, editor layout, and
        formatting controls in one place. These settings do not change shared
        document data.
      </p>
      <h3 className="settings-heading settings-heading-first">
        System appearance
      </h3>
      <div className="settings-list">
        <label className="settings-row">
          <span>
            Scheme
            <small>Follow the operating system or choose a fixed scheme.</small>
          </span>
          <select
            aria-label="Color scheme"
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
            Font
            <small>Preview the workspace and document font immediately.</small>
          </span>
          <select
            aria-label="Workspace font"
            value={editorFont}
            onChange={(event) =>
              setEditorFont(event.target.value as EditorFont)
            }
          >
            <option value="dm-sans">DM Sans</option>
            <option value="manrope">Manrope</option>
            <option value="system">System Sans</option>
            <option value="serif">Serif</option>
            <option value="monospace">Monospace</option>
          </select>
        </label>
      </div>
      <h3 className="settings-heading">Editor and startup</h3>
      <div className="settings-list">
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
        <FocusEffectSettings />
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
          setEditorFont("dm-sans");
          setEditorTextSize("medium");
          setPageWidth("comfortable");
          setSidebarOnStart(true);
        }}
      >
        Reset system and editor settings
      </button>
      <h3 className="settings-heading">Formatting shortcuts</h3>
      <p className="settings-description">
        Focus a field and press a modifier shortcut. Backspace clears it.
        Assigning a shortcut moves it from any previous action.
      </p>
      <div className="shortcut-settings">
        {colorPresets.map((color) => (
          <label className="shortcut-setting" key={color}>
            <span>
              <i
                className="text-color-swatch"
                data-text-color={color}
                data-background-color={color}
              >
                A
              </i>
              {colorLabels[color]}
            </span>
            <input
              aria-label={`${colorLabels[color]} shortcut`}
              placeholder="Unassigned"
              readOnly
              value={displayShortcut(formattingShortcuts.colorPresets[color])}
              onKeyDown={(event) => captureFormattingShortcut(event, color)}
            />
          </label>
        ))}
        <label className="shortcut-setting shortcut-repeat">
          <span>
            Repeat last color
            <small>Reapply the last combined color preset.</small>
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
      <h3 className="settings-heading">Paste</h3>
      <label className="settings-row">
        <span>
          Paste engine
          <small>
            New (default): keeps formatting from Notion, Google Docs, Word,
            Slack, web pages and AI chats, and turns indented text into nested
            lines. Classic: the previous behaviour.
          </small>
        </span>
        <select
          aria-label="Paste engine"
          defaultValue={getPasteEngine()}
          onChange={(event) =>
            setPasteEngine(event.target.value as PasteEngine)
          }
        >
          <option value="v2">New (default)</option>
          <option value="classic">Classic</option>
        </select>
      </label>
      <h3 className="settings-heading">This browser</h3>
      <p>
        After the workspace token is entered once, this browser stays signed in
        (90 days after its last use).
      </p>
      <button
        className="settings-reset"
        onClick={() => void endSession().then(() => location.reload())}
      >
        Sign out of this browser
      </button>
      <h3 className="settings-heading">Meeting summaries</h3>
      <p>
        Shared by every summary button in this workspace: engine, skill, Slack
        notification channel, prompt and the meeting-note formats you can pick
        per summary.
      </p>
      <SummarySettingsForm variant="full" />
    </>
  );
}
