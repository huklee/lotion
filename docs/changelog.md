# Changelog

Versions are recorded in `package.json` and `package-lock.json`. Each release records additions, fixes and verification here; exact implementation timestamps and detailed test evidence remain in the linked logs. Use a minor increment for backward-compatible features and a patch increment for fixes. Major versions are reserved for major product changes or incompatible changes.

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
