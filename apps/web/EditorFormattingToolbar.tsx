import {
  ColorStyleButton,
  FormattingToolbar,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  useEditorState,
} from "@blocknote/react";
import {
  displayShortcut,
  colorPresets,
  type FormattingShortcuts,
  type ColorPreset,
} from "./format-shortcuts";
import type { AppliedColorPreset } from "./last-color-style";

const colorLabels = Object.fromEntries(
  colorPresets.map((color) => [
    color,
    color === "default"
      ? "Default"
      : `${color[0].toUpperCase()}${color.slice(1)}`,
  ]),
) as Record<ColorPreset, string>;

function ColorLetter({
  textColor,
  backgroundColor,
}: Partial<{ textColor: string; backgroundColor: string }>) {
  return (
    <span
      className="bn-color-icon lotion-color-letter"
      data-text-color={textColor ?? "default"}
      data-background-color={backgroundColor ?? "default"}
    >
      A
    </span>
  );
}

function ShortcutColorStyleButton({
  shortcuts,
  onApplied,
}: {
  shortcuts: FormattingShortcuts;
  onApplied: (style: AppliedColorPreset) => void;
}) {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext()!;
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      textColor: String(editor.getActiveStyles().textColor ?? "default"),
      backgroundColor: String(
        editor.getActiveStyles().backgroundColor ?? "default",
      ),
    }),
  });
  const apply = (color: ColorPreset) => {
    if (color === "default")
      editor.removeStyles({ textColor: color, backgroundColor: color });
    else editor.addStyles({ textColor: color, backgroundColor: color });
    onApplied({ color });
    setTimeout(() => editor.focus());
  };
  return (
    <Components.Generic.Menu.Root>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          className="bn-button"
          label="Colors"
          mainTooltip="Colors"
          icon={
            <ColorLetter
              textColor={active.textColor}
              backgroundColor={active.backgroundColor}
            />
          }
        />
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-color-picker-dropdown">
        <Components.Generic.Menu.Label>
          Color presets
        </Components.Generic.Menu.Label>
        {colorPresets.map((color) => (
          <Components.Generic.Menu.Item
            className="lotion-color-option"
            icon={<ColorLetter textColor={color} backgroundColor={color} />}
            checked={
              active.textColor === color && active.backgroundColor === color
            }
            key={color}
            onClick={() => apply(color)}
          >
            <span>{colorLabels[color]}</span>
            {!!shortcuts.colorPresets[color] && (
              <kbd className="color-shortcut-hint">
                {displayShortcut(shortcuts.colorPresets[color])}
              </kbd>
            )}
          </Components.Generic.Menu.Item>
        ))}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

export function EditorFormattingToolbar({
  shortcuts,
  onApplied,
}: {
  shortcuts: FormattingShortcuts;
  onApplied: (style: AppliedColorPreset) => void;
}) {
  return (
    <FormattingToolbar>
      {getFormattingToolbarItems().map((item) =>
        item.type === ColorStyleButton ? (
          <ShortcutColorStyleButton
            key="colorStyleButton"
            shortcuts={shortcuts}
            onApplied={onApplied}
          />
        ) : (
          item
        ),
      )}
    </FormattingToolbar>
  );
}
