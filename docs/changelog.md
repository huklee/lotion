# Changelog

Versions are recorded in `package.json` and `package-lock.json`. Each release records additions, fixes and verification here; exact implementation timestamps and detailed test evidence remain in the linked logs. Use a minor increment for backward-compatible features and a patch increment for fixes. Major versions are reserved for major product changes or incompatible changes.

## 0.35.0 — 2026-10-16 · [#53](https://github.com/huklee/lotion/pull/53)

### Added

- **Control panel → Meeting summaries:** engine, default format, skill, Slack channel and prompt in one place, plus a **meeting-note format editor**: add, duplicate, rename, describe and rewrite the format/length rules of each preset, delete presets, choose the default, and restore the built-in formats while keeping your own. Every summary button's ▾ menu and the row ⋯ menu list the saved formats, so a new format can be used right away.
- **Pick the Slack channel from a list:** the channels the Slack bot has joined (🔒 for private ones) are offered in Control panel and in the database 📝 ⚙ popover; when the Slack bridge is unreachable, a channel id can still be typed.

### Changed

- The database 📝 ⚙ popover is now compact (engine, default format, skill, Slack channel); the prompt and formats are edited in Control panel.

Settings saved by 0.33/0.34 keep working: the four built-in formats become editable presets. Verification is recorded in [test results](test-results.md).

## 0.34.0 — 2026-10-16 · [#52](https://github.com/huklee/lotion/pull/52)

### Changed

- **Summaries are short and decision-first by default.** The new default condensing, **핵심·결정 (짧게)**, writes 1–3 key lines, the decisions, and action items (task — owner, due), at most about 15 lines, with no discussion narrative or attendee lists. Its length and structure take precedence over the skill's own format.

### Added

- **Choose the condensing per summary:** every summary button has a ▾ menu — 핵심·결정 (짧게), 결정·액션만 (decisions and action items only), 표준 회의록 (the Confluence-style six sections), 상세 회의록 (standard plus each topic's opinions, reasons and how the conclusion was reached). The row ⋯ menu lists the same four. The default is set in 📝 ⚙ ("Default condensing"); the summary page header names the condensing used.

### Fixed

- Database menus (property, row, filter, condensing…) follow their button when the page scrolls or shifts instead of closing, open upwards near the bottom of the screen, and stay open while their own content scrolls.

A saved copy of the previous built-in prompt is upgraded to the new, structure-free default; custom prompts are kept. Verification is recorded in [test results](test-results.md).

## 0.33.0 — 2026-10-16 · [#51](https://github.com/huklee/lotion/pull/51)

### Added

- **On-demand meeting summaries.** One button writes a summary page in a Korean enterprise (Confluence-style) minutes format:
  - **One meeting:** "요약" on a feed entry, or "📝 Summarize this meeting" in a row's ⋯ menu. The summary page (📝) is created under that meeting and appears as a "📝 요약" link on the feed entry.
  - **Several meetings:** select rows (checkboxes in the table and the feed) and press "📝 Summarize N" in the selection bar; the summary goes under the database page.
  - **Part of a page:** select blocks in any page and press 📝 in the selection toolbar.
  - The summary starts with its engine, skill, date and links back to every source meeting. A status toast shows progress and opens the result.
- **Summary settings** (📝 ⚙ in a database toolbar): engine (Codex by default, or Claude Code), skill (any installed Claude/Codex skill, default `create-enterprise-confluence-report`, or none), the editable prompt, and the Slack channel for the "summary ready" notification. The selected meeting text is sent to the chosen engine; the engines run headless and read-only in an empty temporary folder.
- **Slack notification** when a summary is written or fails, posted through the local Slack bridge (Lotion holds no Slack credentials).
- **Row selection** in tables and feeds with "select all shown", clear, and bulk delete (pages go to the trash).
- **Period presets** in the database toolbar: today, this week, last 7 / 30 days, this month (an ordinary, editable filter on the first date property).

Settings are stored in the workspace folder (`summary-settings.json`); documents are unchanged. Verification is recorded in [test results](test-results.md).

## 0.32.0 — 2026-10-16 · [#50](https://github.com/huklee/lotion/pull/50)

### Added

- **Version button and "What's new" panel:** the bottom bar shows the running version (`v0.32.0`) at the right. Clicking it opens a panel with the build (commit and build time) and every release from this changelog — newest first, each with its date, the pull request that shipped it and its added/fixed notes. A dot marks a version you have not opened yet; releases newer than the one you last saw are tagged "new". Search filters by text, version or `#PR`.
- Every changelog heading now links its pull request (backfilled from the merge history for 0.7.0 onwards).

No stored-content change. Verification is recorded in [test results](test-results.md).

## 0.31.0 — 2026-10-16 · [#49](https://github.com/huklee/lotion/pull/49)

### Added

- **Feed view for databases** (`+` next to the view tabs → Feed): row pages are read one after another in the view's order — a new feed sorts by the first date property, newest first — with their properties shown as chips. Bodies load as they scroll near and the feed shows 10 entries at a time ("Show more").
- **Edit in place:** the first entry opens as a full editor inside the feed and saves to its own page through the same save pipeline as the page editor (drafts, retries, conflicts — a conflicted entry links to its page to resolve it). Any other entry switches to editing with "Edit here" (or a double-click) and back with "Done"; the title opens the page.
- **New meeting:** a feed's "+ New meeting" creates a row page titled `YYYY-MM-DD 회의` at the top, with today's date in the first date property (plus any values the view's filters imply) and a body copied from the template row, or a meeting skeleton (참석자 / 안건 / 논의 내용 / 결정 사항 / 액션 아이템) when there is none. Choose the template with "Use as template for new entries" in a row's ⋯ menu.

### Fixed

- Clicking a database's own controls (tabs, menus, feed entries) no longer selects the whole database block, and working inside it no longer shows the whole-block selection overlay.

Existing databases are unchanged (the new `template` block property defaults to empty). Verification is recorded in [test results](test-results.md).

## 0.30.0 — 2026-10-16 · [#48](https://github.com/huklee/lotion/pull/48)

### Added

- **Saved database views:** a tab bar above every database. Each view has its own name, filters, sort and visible properties; add, rename, duplicate and delete views from the tab bar. Views are stored in the database block, so every reader sees them; which tab you last opened is remembered per browser.
- **Filter:** rules on the page title or any property, all of which must match — text contains / is / is empty, select is / is not, checkbox checked / unchecked, number comparisons, and dates (is, before, after, on or before/after, today, this week, last 7 / 30 days, this month, empty). An incomplete rule never hides every row; a "N of M" counter shows how many rows the view keeps.
- **Sort:** up to five rules (page title or any property, ascending or descending); empty values always last; without sorts rows keep their manual order.
- **Visible properties:** hide or show properties per view.
- A new row created in a filtered view gets values that satisfy its equality filters (e.g. "Type is Weekly", "Date is this week" → today).

Existing databases get one default "Table" view; no stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.29.0 — 2026-10-16 · [#47](https://github.com/huklee/lotion/pull/47)

### Added

- **Database property menu (⋯ on each property):** change the type with value conversion (text → select turns existing values into options; numbers are parsed; checkboxes become Yes/No as text), edit select options (renaming carries values along, removing clears them), move a property left or right, and delete it after an in-page confirmation.
- **Database row menu (⋯ next to each row):** duplicate the row (its page is copied and the new row keeps the same values, right below), move it up or down, and delete it — the row disappears at once and its page goes to the trash (restorable); if trashing fails the row is put back.
- Menus float above the page so the table's scroll area can no longer clip them; Esc, an outside click or scrolling closes them and focus returns to the button.

### Fixed

- Trashing or restoring a page no longer waits for its parent page's unsaved draft: only a move rewrites parent page links, so e.g. deleting a database row right after editing the table works.

No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.28.0 — 2026-10-15 · [#46](https://github.com/huklee/lotion/pull/46)

### Added

- **Recent changes open the page at the edit**: clicking an entry scrolls to the block that was added or changed (for a sitting, the newest one) and flashes it once — a short double pulse, or a static highlight with reduced motion. If that block no longer exists, the page opens normally.

No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.27.0 — 2026-10-15 · [#45](https://github.com/huklee/lotion/pull/45)

### Added

- **Recent changes** (sidebar, `#/changes`): a workspace-wide feed of what changed, newest first and grouped by day. Each entry names the page, what happened — created, edited, renamed (with the old title), moved, moved to trash, restored — how many blocks were added, removed and changed, an excerpt of the first changed text, and the time.
- Autosaved revisions of one page in one sitting (each within 30 minutes of the next) are one entry ("N edits"). Clicking an entry opens the page; pages now in the trash open the Trash. "Show older changes" pages back through the whole history.
- `GET /api/changes?limit=&before=` serves the feed. It is computed from the immutable revision snapshots already in the workspace, reading only what a page of results needs, and caches per revision; a missing snapshot is skipped rather than ending a page's history. Measured on a 181 MB workspace with 6,288 snapshots: first page 0.56 s, repeated 4 ms, the entire history 2.9 s.

No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.26.1 — 2026-10-08 · [#44](https://github.com/huklee/lotion/pull/44)

### Fixed

- Clicking a heading in the page outline or in an inline `/toc` block now scrolls with a bounded animation: the page accelerates, then decelerates, and arrives in at most 0.65 s however far the heading is. The browser's native smooth scroll took longer the farther it went (up to ~1.5 s measured in Chromium on long pages) and kept chasing headings that moved while blocks rendered.
- The target is re-measured every frame, so content that changes height mid-scroll cannot extend the jump; scrolling with the wheel, touch, a click or a key stops the animation; reduced-motion preferences jump instantly.

No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.26.0 — 2026-10-06 · [#43](https://github.com/huklee/lotion/pull/43)

### Added

- **Ctrl+Enter / ⌘Enter on a selection** now applies to every checklist item in it. Select text across several blocks (drag, Shift+click, Shift+arrows) or select whole blocks (gutter drag, **Select section**) and press the shortcut: all checklist items inside — nested child items included — are checked. If every one of them is already checked, the same shortcut unchecks them all.
- With a collapsed cursor the shortcut still toggles only the current checklist item. A selection that merely touches the edge of the next block does not include it. The bulk change is one undo step.

No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.25.0 — 2026-09-30 · [#42](https://github.com/huklee/lotion/pull/42)

### Added

- Every page with headings now renders an automatic **page outline** (table of contents) in a right-hand panel. It lists all headings in document order with indentation relative to the shallowest heading level.
- The outline follows live edits without saving or reloading, highlights the section currently in view while scrolling, and scrolls to a heading when its entry is clicked. At the end of a page, the last visible heading becomes current even if its short section cannot reach the reading line.
- The panel is omitted on pages without headings, hidden in windows narrower than 1,200 px, and excluded from printing. The inline `/toc` block is unchanged and now shares the same heading extraction.

No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.24.1 — 2026-09-20 · [#41](https://github.com/huklee/lotion/pull/41)

### Fixed

- `Ctrl/Cmd`-clicking a page link in the sidebar now explicitly opens that page in a new tab instead of depending on intermittent native modified-click handling inside a draggable page row.
- The original tab remains on its current page. Middle-click and other browser-native link gestures retain their default behavior.
- Sidebar **Duplicate** and **Add child** actions now run on the initial primary pointer press, avoiding dropped releases when the surrounding row is draggable.

No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.24.0 — 2026-09-20 · [#40](https://github.com/huklee/lotion/pull/40)

### Added

- The upper-right page-move dialog now presents the workspace hierarchy as a nested document tree with accessible expand and collapse controls.
- The workspace root remains an explicit destination, while every page destination retains its icon and full hierarchy depth.

### Safety and compatibility

- The current page and all of its descendants are omitted from the destination tree, preventing users from requesting a circular hierarchy through the move UI.
- Orphaned or cyclic nodes caused by externally malformed workspace data are rendered through bounded traversal instead of causing recursion failure or disappearing from the recovery surface.
- No document schema or stored-content migration is required.

Verification is recorded in [test results](test-results.md).

## 0.23.0 — 2026-09-19 · [#39](https://github.com/huklee/lotion/pull/39)

### Added

- The upper-right page toolbar now includes **Duplicate page**, using the same content-preserving and parent-link-aware operation as the sidebar action.

### Fixed

- Duplicating the active page immediately after editing now flushes its draft before reading the revision used by the copy request. This prevents a stale `If-Match` failure and ensures the copy contains the latest title and blocks.

No document schema migration is required. Verification is recorded in [test results](test-results.md).

## 0.22.0 — 2026-09-19 · [#38](https://github.com/huklee/lotion/pull/38)

### Added

- Sidebar child creation now appends a navigable child-page link to the parent document.
- Dragging a page into another parent atomically removes its managed link from the former parent and adds it to the destination. Moving it to the workspace root removes the former parent link.
- Each sidebar page row has a **Duplicate** action. It copies the page content beside the original and adds a link for the copy to their parent.

Managed hierarchy links use stable identities, so retries and same-parent reordering do not create duplicates. User-authored links are never removed. The existing `/page` command continues to insert its own single link without a backend duplicate. Parent-link and hierarchy changes share the repository's atomic manifest boundary; no stored-document schema migration is required. Verification is recorded in [test results](test-results.md).

## 0.21.2 — 2026-09-19 · [#37](https://github.com/huklee/lotion/pull/37)

### Fixed

- `⌘C / Ctrl+C` and `⌘X / Ctrl+X` now invoke selected-block copy and cut while the custom block selection is active. Previously only the toolbar buttons populated Lotion's structured session record, so the normal keyboard workflow pasted degraded plain text.
- Keyboard copy/paste now restores mixed headings, paragraphs, lists, nested checklists, checked state, and inline color/font styling into empty or existing content. Keyboard cut still removes content only after the clipboard write succeeds.

The browser-session record remains schema-validated, regenerates all block IDs, survives an in-tab reload, and falls back safely when session storage is unavailable. The system clipboard remains portable Markdown. No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.21.1 — 2026-09-19 · [#36](https://github.com/huklee/lotion/pull/36)

### Fixed

- Pasting a block selection copied through Lotion's selection toolbar now restores the exact original block types, nesting, checklist state, and inline styles instead of degrading mixed selections to plain paragraphs.
- Restored copies receive fresh block IDs and are schema-validated before insertion. The validated session record works across page navigation and an in-tab reload, while the system clipboard remains portable Markdown.

Arbitrary external Markdown retains the existing literal-paste policy; only an exact match for Lotion's latest selected-block copy uses exact reconstruction. No document schema or stored-content migration is required. Verification is recorded in [test results](test-results.md).

## 0.21.0 — 2026-09-19 · [#35](https://github.com/huklee/lotion/pull/35)

### Added

- Pasting a raw-text outline into an empty paragraph reconstructs headings, bullet/numbered lists, checklist state, and nested list hierarchy. The recognized form is compatible with selected-block Markdown copy output.

### Compatibility and safety

- Reconstruction requires every non-empty line to be structural and accepts only plain inline text. Mixed prose, HTML, links, emphasis, code, and other rich Markdown remain on the existing literal plain-text path.
- Pasting into a non-empty paragraph, checklist, callout, code block, or custom input retains its existing behavior. No document schema or stored-content migration is required.

Verification is recorded in [test results](test-results.md).

## 0.20.1 — 2026-09-19 · [#34](https://github.com/huklee/lotion/pull/34)

### Fixed

- A custom block selection now clears when the user clicks or selects ordinary editor content, the page title, or another application control.
- The selected-block toolbar is an explicit interaction boundary, so its drag, copy, cut, move, and clear controls retain the selection long enough to complete their action. Modifier-assisted lasso extension remains unchanged.

No document data, schema, or migration changes are required. Verification is recorded in [test results](test-results.md).

## 0.20.0 — 2026-09-19 · [#33](https://github.com/huklee/lotion/pull/33)

### Added

- A rectangle-selected block group now has explicit Markdown copy and cut controls, and the toolbar's left grip is the accessible drag handle for moving the group.
- Selected blocks are copied in document order with their structured Markdown forms, including headings, checklist state, and complete nested subtrees. Selecting both an ancestor and its descendant does not duplicate the descendant.

Cut waits for a successful clipboard write before deleting content, so a denied or failed clipboard operation leaves the document intact. Existing document data and schema version 1 are unchanged. Verification is recorded in [test results](test-results.md).

## 0.19.1 — 2026-09-19 · [#32](https://github.com/huklee/lotion/pull/32)

### Fixed

- Pasting clipboard text that ends with a conventional newline into the middle of a checklist item no longer creates an extra empty checklist item or moves the existing suffix to that item.
- Single-line and multi-line checklist paste now discard exactly one terminal clipboard delimiter while preserving intentional internal blank lines, checklist types, checked-state rules, and mid-line prefix/suffix placement.

Ordinary paragraph paste continues preserving terminal blank lines under the existing line-by-line plain-text rules. No document schema or stored content migration is required. Verification is recorded in [test results](test-results.md).

## 0.19.0 — 2026-09-19 · [#31](https://github.com/huklee/lotion/pull/31)

### Improved

- The formatting toolbar and control panel now expose exactly ten coordinated color presets—default plus nine portable hues—instead of separate text and background menus. Choosing a preset or invoking its shortcut applies both values together.
- Dark and black schemes use quieter, low-chroma pastel fills while every preset keeps at least 4.5:1 text-to-background contrast.
- Repeat-last-color now reapplies the complete preset across page navigation and reload. Existing session values and the former `textColors` shortcut settings migrate to the corresponding combined preset.

Stored document color keys and schema version 1 remain unchanged, so existing documents continue to render and export without migration. This backward-compatible interaction improvement is a minor release. Verification is recorded in [test results](test-results.md).

## 0.18.0 — 2026-09-19 · [#30](https://github.com/huklee/lotion/pull/30)

### Improved

- The most recently applied text or background color style is now shared by every page editor in the current browser tab session. The repeat-last-style shortcut continues working after page navigation and reload.
- Session values are schema-validated before use. Missing, malformed, unknown, blocked, or full browser storage falls back safely without preventing immediate formatting.

This browser-local state is not document content, is not included in exports, and ends when the tab session ends. No document-schema migration is required. Verification is recorded in [test results](test-results.md).

## 0.17.0 — 2026-09-19 · [#29](https://github.com/huklee/lotion/pull/29)

### Added

- Typing `<-` or `->` in ordinary rich-text blocks dynamically replaces the two ASCII characters with `←` or `→`.

### Compatibility

- The conversion uses an undoable editor input rule and does not rewrite clipboard paste, code blocks, Mermaid source fields, native form controls, or active IME composition. Existing saved content and document schema version 1 are unchanged.
- Tiptap Core is now an explicit application dependency because Lotion owns this inline input rule instead of relying on BlockNote's block-type shortcut rules.

This backward-compatible editor feature is a minor release. Verification is recorded in [test results](test-results.md).

## 0.16.0 — 2026-09-18 · [#27](https://github.com/huklee/lotion/pull/27)

### Added

- `npm run doctor` performs an offline, read-only inventory of committed and unreferenced document revisions and reports missing, unsafe, malformed, externally changed, orphaned, missing-parent, and cyclic storage states without printing document content.
- Reviewed JSON reconciliation plans can promote an exact valid source revision, explicitly detach a page, or drop an irrecoverable manifest reference. Application is bound to the diagnostic state, records recovery metadata, creates only new immutable revisions, and never deletes old snapshots.

### Improved

- Version-1 manifests now carry semantic hashes for committed document snapshots. Existing valid workspaces establish their baseline compatibly; later external content changes refuse startup and point to the doctor workflow.
- Recovery validates the complete resulting hierarchy before one atomic manifest publication and rejects stale plans or a concurrently running backend.

No document/content schema migration is required. Direct external editing remains unsupported, malformed manifests still require a known-good backup, and orphan retention is deliberately separate. See [ADR-024](adr/024-storage-diagnostics-and-reconciliation.md) and the [recovery runbook](running.md#workspace-diagnosis-and-reconciliation).

## 0.15.0 — 2026-09-17 · [#26](https://github.com/huklee/lotion/pull/26)

### Added

- `/database` now creates a bounded typed database block instead of an ordinary table. It supports text, number, select, checkbox, and date properties, property addition/renaming, and up to 500 rows.
- Each database row is a real child page created through the normal document API. The title cell opens that page and follows current page title/icon metadata.

### Improved

- Database property names, typed values, row links, counts, and serialized size are validated on save and import. Property names and row values participate in workspace search.
- Exact bundles preserve database behavior and remap row-page IDs on import. Portable Markdown explicitly degrades a database to a static linked GFM table.

No schema-version migration is required. Existing ordinary tables remain ordinary tables; they are not guessed into databases. [ADR-023](adr/023-typed-database-rows.md) records the selected scope and excluded advanced features. Verification is recorded in [test results](test-results.md).

## 0.14.0 — 2026-09-17 · [#25](https://github.com/huklee/lotion/pull/25)

### Added

- The `@` picker can upload a file up to 20 MB and insert a typed, downloadable file reference backed by the immutable workspace asset store.
- Calendar insertion now creates a validated ISO date reference rendered as semantic time content instead of emoji-prefixed plain text.

### Improved

- File activation downloads through an authenticated fetch, including in token-protected workspaces. Picker cancellation aborts an active upload without inserting a reference.
- Exact bundles preserve file and date reference types. Portable Markdown emits files as standard links with bundled asset bytes and dates as readable `📅 YYYY-MM-DD` text; importing portable Markdown intentionally produces ordinary links/text.

No schema-version migration is required. Existing page/external mentions and legacy plain-text dates remain valid; they are not guessed into new types. [ADR-022](adr/022-file-and-date-references.md) records validation, navigation, keyboard, and portability rules. Verification is recorded in [test results](test-results.md).

## 0.13.0 — 2026-09-17 · [#24](https://github.com/huklee/lotion/pull/24)

### Added

- Page and external references now use a validated mention inline type with distinct chip presentation. Raw pasted URLs remain ordinary underlined links.
- External OpenGraph metadata records its fetch time and refreshes after 15 minutes on hover while retaining saved metadata during lookup or failure.
- The backend keeps successful preview results in a process-local 15-minute, 256-entry least-recently-used cache, reducing repeated remote fetches and asset writes.

### Improved

- Internal mention titles and icons follow current page metadata immediately in the active editor.
- Successful external refreshes update both the preview card and matching chip labels. Mention labels are searchable and contribute to table-of-contents text.
- Legacy internal links and external preview links migrate to typed mentions on open. Exact bundles preserve the type; portable Markdown emits ordinary visible links.

No schema-version migration is required. Existing links remain readable, and the new preview timestamp is optional. [ADR-021](adr/021-reference-chips-and-preview-cache.md) records the compatibility and cache boundaries. Verification is recorded in [test results](test-results.md).

## 0.12.1 — 2026-09-17 · [#23](https://github.com/huklee/lotion/pull/23)

### Fixed

- Link previews now retain every validated public DNS candidate so Node can select a reachable IPv4 or IPv6 connection instead of pinning only the first answer.
- Standard and local-use NAT64 destinations are accepted only when their embedded IPv4 destination is public. Private, loopback, link-local, documentation, carrier-grade NAT, and other non-public targets remain blocked.
- A mixed DNS response no longer rejects an otherwise usable public address, while private candidates are removed before the connection lookup and every redirect is independently resolved and validated.

No document schema migration is needed. Link-preview limits, redirect validation, DNS pinning, accepted MIME types, and locally cached image behavior remain unchanged. Verification is recorded in [test results](test-results.md).

## 0.12.0 — 2026-09-17 · [#22](https://github.com/huklee/lotion/pull/22)

### Added

- Workspace search now covers saved page titles and block content through a backend-derived index, including nested blocks, tables, attachment labels, code, and Mermaid source.
- The active unsaved browser draft is searched locally and merged with backend results. Results report their source and open stable links to exact matching blocks.
- Search requests are debounced, obsolete requests are canceled, query/result limits are validated, trash is excluded, and startup reconstructs the disposable index from canonical revisions.

### Architecture

- A `WorkspaceSearchIndex` boundary permits a future OpenSearch adapter. [ADR-020](adr/020-backend-workspace-search.md) records why the measured local implementation remains the default without requiring another production service.

No document schema migration is needed. The index is derived data and is not included in backups or exports. Verification is recorded in [test results](test-results.md).

## 0.11.0 — 2026-09-16 · [#21](https://github.com/huklee/lotion/pull/21)

### Added

- The control panel now presents system appearance, editor/startup preferences, and formatting shortcuts as one integrated settings area.
- Workspace font choices include DM Sans, Manrope, system sans, serif, and monospace. Font changes preview immediately in both application chrome and document content, persist in this browser, and reject unsupported stored values.

### Improved

- The combined reset restores the scheme, font, editor text size, page width, and startup sidebar preference together.

No document schema migration is needed. These preferences remain browser-local and do not enter shared document data or exports. Verification is recorded in [test results](test-results.md).

## 0.10.0 — 2026-09-16 · [#20](https://github.com/huklee/lotion/pull/20)

### Added

- Appearance settings now include a persistent black scheme in addition to system, light, and dark.

### Improved

- Text and background formatting use one centralized palette of default plus nine pastel hues across light, dark, and black schemes.
- Every text hue meets at least 4.5:1 contrast against its scheme canvas, and default text meets the same threshold on every pastel background.
- Existing stored color names, formatting shortcuts, and document content remain compatible.

No document schema migration is needed. This minor release changes presentation values and adds a browser-local appearance choice without changing portable color keys. Verification is recorded in [test results](test-results.md).

## 0.9.0 — 2026-09-16 · [#19](https://github.com/huklee/lotion/pull/19)

### Added

- The browser tab favicon now follows the active page icon immediately when a page opens or its icon changes.
- Pages without a custom icon use the same `📄` fallback shown in the document UI. Home, trash, and initial loading use a stable Lotion `L` favicon.
- Stored icon text is XML-escaped before it enters the generated SVG favicon.

No document schema migration is needed. This minor release derives browser presentation from existing page metadata and adds no stored fields. Verification is recorded in [test results](test-results.md).

## 0.8.0 — 2026-09-16 · [#18](https://github.com/huklee/lotion/pull/18)

### Improved

- Drag-box selection now hit-tests each block's own visible content row rather than the bounding box of its complete nested subtree. A nested child can therefore be selected independently without falsely selecting its parent.
- Parent blocks still select their complete subtree when the drag actually crosses the parent's own row, preserving group movement and deletion behavior.

No document schema migration is needed. This minor release changes transient selection hit testing only; existing documents remain compatible. Verification is recorded in [test results](test-results.md).

## 0.7.2 — 2026-09-16 · [#17](https://github.com/huklee/lotion/pull/17)

### Fixed

- Keyboard input in Mermaid source fields no longer triggers editor-level formatting, checklist-toggle, or block-movement shortcuts based on a stale document cursor. The textarea keeps ownership of editing keys while global save behavior remains available.
- Mermaid regression coverage now uses character-by-character typing and verifies rendering, invalid-source recovery, save/reload, checklist isolation, and block-order stability.

No document schema migration is needed. This patch changes input routing only; existing diagrams remain compatible. Verification is recorded in [test results](test-results.md).

## 0.7.1 — 2026-09-16 · [#16](https://github.com/huklee/lotion/pull/16)

### Fixed

- Multi-line plain-text paste at any position in a checklist now follows the checklist's normal Enter behavior. The first pasted line joins the text before the caret, the final pasted line joins the suffix, every resulting block remains a checklist item, and no empty paragraph is inserted.

No document schema migration is needed. This patch changes checklist paste interaction only; existing documents remain compatible. Verification is recorded in [test results](test-results.md).

## 0.7.0 — 2026-09-15 · [#1](https://github.com/huklee/lotion/pull/1)

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
