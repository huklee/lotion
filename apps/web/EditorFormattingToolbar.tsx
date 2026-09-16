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
  textColors,
  type FormattingShortcuts,
  type TextColor,
} from "./format-shortcuts";

export type AppliedColorStyle = {
  kind: "textColor" | "backgroundColor";
  color: string;
};

const colorLabels = Object.fromEntries(
  textColors.map((color) => [
    color,
    color === "default"
      ? "Default"
      : `${color[0].toUpperCase()}${color.slice(1)}`,
  ]),
) as Record<TextColor, string>;

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
  onApplied: (style: AppliedColorStyle) => void;
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
  const apply = (kind: AppliedColorStyle["kind"], color: string) => {
    if (color === "default") editor.removeStyles({ [kind]: color });
    else editor.addStyles({ [kind]: color });
    onApplied({ kind, color });
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
          Text color
        </Components.Generic.Menu.Label>
        {textColors.map((color) => (
          <Components.Generic.Menu.Item
            className="lotion-color-option"
            icon={<ColorLetter textColor={color} />}
            checked={active.textColor === color}
            key={`text-${color}`}
            onClick={() => apply("textColor", color)}
          >
            <span>{colorLabels[color]}</span>
            {!!shortcuts.textColors[color] && (
              <kbd className="color-shortcut-hint">
                {displayShortcut(shortcuts.textColors[color])}
              </kbd>
            )}
          </Components.Generic.Menu.Item>
        ))}
        <Components.Generic.Menu.Label>
          Background color
        </Components.Generic.Menu.Label>
        {textColors.map((color) => (
          <Components.Generic.Menu.Item
            className="lotion-background-option"
            icon={<ColorLetter backgroundColor={color} />}
            checked={active.backgroundColor === color}
            key={`background-${color}`}
            onClick={() => apply("backgroundColor", color)}
          >
            {colorLabels[color]}
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
  onApplied: (style: AppliedColorStyle) => void;
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
