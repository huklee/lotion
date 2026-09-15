# ADR-017: Configurable color shortcuts

- **Status:** Validated
- **Date:** 2026-09-15

## Context

Applying the same text colors repeatedly requires reopening the floating formatting menu. Lotion also needs a Notion-style shortcut for repeating the most recently selected color, while user-defined key choices must work on both macOS and Windows/Linux and must not corrupt document content.

## Decision

Represent shortcuts as validated portable chords such as `Mod+Alt+R`, where `Mod` maps to Command or Control. Require Mod or Alt plus a letter, digit or Enter so ordinary typing is never captured. Store one optional chord per text color plus one repeat-last chord in browser local storage; a new assignment clears the same chord from its old action.

Replace only the default color button in BlockNote's formatting toolbar. Preserve the other default controls, show configured text-color chords on hover/focus, and remember color choices made through either a direct shortcut or the menu. The repeat action reapplies that last text or background color. Applied inline colors continue using BlockNote's existing document style schema.

## Alternatives

- Hard-code a shortcut for every color: rejected because dense defaults create conflicts and do not satisfy customization.
- Patch BlockNote's dependency source: rejected because upgrades would overwrite the behavior.
- Store the last color in document data: rejected because it is transient editor state, not content.

## Consequences

Shortcut preferences are local to each browser. The last chosen color is remembered for the current editor instance, while the configured repeat chord persists. Browser/OS-reserved combinations may still be unavailable outside the focused editor; users can record another chord in the control panel.

## Revisit when

Lotion adds a general command/keybinding registry, server-synced preferences, or needs the repeat action to cover non-color formatting.
