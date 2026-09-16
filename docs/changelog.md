# Changelog

Versions are recorded in `package.json` and `package-lock.json`. Each release records additions, fixes and verification here; exact implementation timestamps and detailed test evidence remain in the linked logs. Use a minor increment for backward-compatible features and a patch increment for fixes. Major versions are reserved for major product changes or incompatible changes.

## 0.8.0 — 2026-09-16

### Improved

- Drag-box selection now hit-tests each block's own visible content row rather than the bounding box of its complete nested subtree. A nested child can therefore be selected independently without falsely selecting its parent.
- Parent blocks still select their complete subtree when the drag actually crosses the parent's own row, preserving group movement and deletion behavior.

No document schema migration is needed. This minor release changes transient selection hit testing only; existing documents remain compatible. Verification is recorded in [test results](test-results.md).

## 0.7.2 — 2026-09-16

### Fixed

- Keyboard input in Mermaid source fields no longer triggers editor-level formatting, checklist-toggle, or block-movement shortcuts based on a stale document cursor. The textarea keeps ownership of editing keys while global save behavior remains available.
- Mermaid regression coverage now uses character-by-character typing and verifies rendering, invalid-source recovery, save/reload, checklist isolation, and block-order stability.

No document schema migration is needed. This patch changes input routing only; existing diagrams remain compatible. Verification is recorded in [test results](test-results.md).

## 0.7.1 — 2026-09-16

### Fixed

- Multi-line plain-text paste at any position in a checklist now follows the checklist's normal Enter behavior. The first pasted line joins the text before the caret, the final pasted line joins the suffix, every resulting block remains a checklist item, and no empty paragraph is inserted.

No document schema migration is needed. This patch changes checklist paste interaction only; existing documents remain compatible. Verification is recorded in [test results](test-results.md).

## 0.7.0 — 2026-09-15

### Added

- **Copy block link** copies an absolute URL for the block containing the current cursor. The deep link uses stable page and block IDs rather than titles or positions.
- Opening a block URL preserves the deep fragment while loading, centers the referenced block, and renders a pointer-transparent highlight that remains aligned during scrolling and resizing.
- Deep links pasted as internal links retain same-application routing. Deleted or unknown block targets still open their page without redirecting to an unrelated block, and clipboard failures remain visible for retry.

No document schema migration is needed. Direct links reuse existing stable block IDs and store no extra document metadata. Verification is recorded in [test results](test-results.md).

## 0.6.1 — 2026-09-15

### Fixed

- Deleting selected blocks now removes selected subtrees through an explicit hierarchy-preserving document transform. Unselected parents, following siblings, nested children and their indentation remain unchanged through save/reload.

No document schema migration is needed. This patch changes selected-block deletion behavior only. Verification is recorded in [test results](test-results.md).

## 0.6.0 — 2026-09-15

### Added

- Block lasso selection now works in every drag direction, supports Shift/Command/Control additive selection, keeps already hit off-screen blocks selected while auto-scrolling near editor edges, and avoids selecting a nested child separately when its ancestor is selected.
- Selected blocks use viewport overlays that stay aligned while scrolling and remain available for existing group drag and Backspace actions.

### Fixed

- Dragging inside a single editable block retains native text selection; crossing into another block intentionally transitions to block lasso selection.

No document schema migration is needed. This release changes editor interaction and transient selection rendering only. Verification is recorded in [test results](test-results.md).

## 0.5.0 — 2026-09-15

### Added

- Every text color can have a browser-local modifier-key shortcut configured in the control panel. Duplicate assignments move to the new action, invalid saved combinations are ignored, and individual assignments can be cleared or reset.
- The editor color menu shows an assigned shortcut when its text-color row is hovered or keyboard-focused.
- A configurable **Repeat last color** shortcut reapplies the last text or background color; it defaults to the Notion-style ⌘ShiftH / Ctrl+Shift+H combination.

No document schema migration is needed. Shortcut preferences remain in browser local storage; the colors they apply use the existing portable inline style schema. Verification is recorded in [test results](test-results.md).

## 0.4.0 — 2026-09-15

### Added

- A sidebar **Control panel** centralizes browser-local display settings: system/light/dark appearance, small/default/large editor text, comfortable/wide page width, and whether the sidebar opens on startup.
- Settings apply immediately, persist across reloads, validate stale stored values, and can be reset together to defaults.

No document schema migration is needed. Preferences remain in browser local storage and are not included in document data or exports. Verification is recorded in [test results](test-results.md).

## 0.3.1 — 2026-09-15

### Fixed

- Pasting one plain-text line at a cursor inside a checklist now inserts inline without replacing, splitting or adding another checklist block. The same inline behavior applies to callout content.
- Clicking a checkbox now derives the intended state at pointer-down and commits it once after the browser click sequence, avoiding browser-specific double toggles and preserving the document scroll position.

No document schema migration is needed. This patch changes editor interaction behavior only; existing documents remain compatible. Verification is recorded in [test results](test-results.md).

## 0.3.0 — 2026-09-15

### Added

- Favorite/unfavorite the current page with a star. The sidebar lists favorites using their current titles/icons; changes persist in this browser and synchronize across its tabs. Hidden/trashed pages are omitted without deleting the preference, so restoring a page makes its favorite visible again.
- Sidebar page and favorite entries are native links: ⌘click/Ctrl+click opens another tab and browser link context menus remain available.
- Checklist items support click completion and Ctrl+Enter/⌘Enter toggling.

### Fixed

- Page and Home navigation add history entries instead of replacing the current entry. Back/Forward restores the matching view without adding another entry; reopening the same route adds no duplicate. Home cancels pending page loads and survives reload.
- Plain-text paste within a checklist keeps checklist block types instead of converting them to paragraphs.
- Markdown clipboard export writes whitespace-only editor blocks as blank lines instead of `&#x20;` entities.
- The calendar's next Enter inserts today's preselected date instead of activating previous-month navigation.
- Browser spellcheck is disabled for document content, removing misleading dictionary underlines from code, names, and mixed-language text.
- Newly imported folders remain visible immediately when a workspace already has more than 100 root pages.

### Tooling

- Browser tests now run fully in parallel with an isolated temporary repository and dynamic localhost server per worker. Four workers completed the 105-case local suite in 90.79 seconds versus the previous single-worker 174 seconds; the GitHub CI check step fell from 278 to 151 seconds. Test-only infrastructure does not change application behavior or the 0.3.0 version.

No document schema migration is needed. Favorites are a browser preference, not shared server metadata or an exported document field. Verification is recorded in [test results](test-results.md).

## 0.2.0 — 2026-09-13

### Added

- Calendar module opened from `@` → **Date** / `@date`, with month navigation, date selection and portable date-text insertion.
- Line-by-line validation and plain-text storage for ordinary clipboard text, including literal markup; oversized input is rejected without partial insertion.
- A [document-search plan](document-search-plan.md) comparing three options. Search itself is planned, not implemented in this release.

- Paste a complete fenced `mermaid` block into the editor to create a rendered diagram. Pasting the same block into an existing Mermaid source field removes the fences and updates the diagram.
- **Export → Copy page as Markdown** copies the current page's title and complete draft, including unsaved edits and Mermaid source. Clipboard failures remain visible and can be retried.
- **Backspace** deletes selected blocks or sections, including their children, in one undoable action. Rectangle selection supports immediate keyboard deletion, and deleting every block leaves an editable document.

### Fixed

- Table of contents labels align left, retaining indentation for nested headings.

- Slash-menu closure avoids the WebKit resize-observer notification during failed subpage creation.
- The main editor panel can shrink within the viewport; paste-menu scrolling tests verify actual scroll and matching block/menu movement.
- Returning to text or input editing clears custom block selection so ordinary Backspace behavior is preserved. Selected-block dragging remains supported.

### Compatibility and verification

This is a minor release from 0.1.0. No stored-document migration is required. Markdown clipboard copying includes the current page only; ZIP export includes subpages and image files. Existing Mermaid slash insertion and earlier Lotion compatibility readers remain available.

See [test results](test-results.md) for executed checks and [implementation history](implementation-history-log.md) for publication evidence.

Release verification: `npm run check` passed lint/type/build, 100 unit/integration tests and 90 browser cases locally and in [GitHub CI for cd018bc](https://github.com/huklee/lotion/actions/runs/34763348532) on 2026-09-13.

## 0.1.0 — baseline

Initial Lotion application: block editing, filesystem document revisions, automatic saving and draft recovery, hierarchy and page mentions, Markdown/ZIP import/export, custom blocks including Mermaid, and compatibility with the earlier Yestion naming. This entry summarizes the existing package version; it does not assert a historical tagged release.
