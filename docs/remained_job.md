# Remaining jobs

Historical completed work lives in the [implementation history](implementation-history-log.md), [test results](test-results.md), and [changelog](changelog.md). The completed sequence remains visible below for review across its six incremental pull requests.

## Completed incremental sequence — 2026-09-16

Each item must be implemented, tested, checked off here, committed, pushed, and submitted as its own pull request before moving to the next item.

### P0 — Bug fixes

1. [x] Fix checklist paste so text does not create an unconditional extra line. Multi-line paste at a mid-line caret must keep the first and last fragments attached to checklist items, preserve checklist types, save, and reload correctly.
2. [x] Repair the Mermaid editor so its source field owns keyboard input instead of triggering stale checklist and block-movement shortcuts; verify character-by-character editing, rendering, invalid-source recovery, save, and reload.

### P1 — UI/UX and styling

3. [x] Improve drag-box selection so the visible rectangle and selected block set remain accurate in every drag direction, while scrolling, and across nested blocks. A nested child can now be selected independently because hit testing uses each block's own content row instead of its ancestor's complete subtree.
4. [x] Synchronize the browser tab favicon with the current page icon, including immediate icon edits and page changes. Pages without an explicit icon use the visible `📄` default; non-page views and initial loading use a stable Lotion fallback.
5. [x] Consolidate text and background colors into ten portable choices (default plus nine pastel hues), with centrally validated 4.5:1 contrast in light, dark, and black schemes. Add the persistent black scheme without changing stored document color keys.

### P1 — System and architecture

6. [x] Add an integrated settings area for scheme, font, and related system preferences, with validated persistence, reset behavior, and immediate preview. System appearance, editor/startup preferences, and formatting shortcuts now share one control panel; five validated font choices apply to the workspace and document immediately, persist locally, and reset with the other display settings.

## Incremental editor improvements — 2026-09-19

Each item is implemented from current `main`, tested, submitted as a pull request whose base is `main`, merged after CI passes, and ancestry-verified before the next item begins.

1. [x] Convert `<-` and `->` dynamically to `←` and `→` during ordinary editor typing without changing paste, code, Mermaid, or IME composition input. An undoable Tiptap input rule owns the conversion; its composition/code guards and Lotion's explicit paste boundary preserve literal input elsewhere.
2. [x] Preserve the most recently applied font-color style as one shared value for the browser session, including navigation between pages. The validated session value covers both text and background choices, survives editor remount/reload, and degrades safely when storage is unavailable.
3. [x] Replace independent font-color/background choices with ten combined Notion-style presets whose contrast remains readable in every supported scheme. Each preset now applies both portable style keys, shortcut/session state migrates compatibly, and dark/black fills use tested low-chroma pastel values.
4. [x] Fix the remaining checklist-area paste path that unconditionally creates an unwanted newline. Checklist paste now drops one conventional terminal delimiter while preserving internal blanks, mid-line prefix/suffix behavior, checklist types, checked-state rules, save, and reload.
5. [x] Extend drag-box block selection so the left movement handle supports dragging, copying, and cutting the selected block group. The grip now starts a group move, while explicit copy/cut controls serialize the selected top-level subtrees to structured Markdown in document order; cut removes content only after a successful clipboard write.
6. [x] Clear a custom block selection whenever the user selects another editor or application area, without breaking selection-owned controls. Ordinary editor clicks/text selection and other application controls now clear the block selection; the selected-block toolbar is an explicit ownership boundary so its drag, copy, cut, move, and clear actions remain usable.
7. [x] Reconstruct enhanced blocks such as bullets, checklists, and headings when structured raw text is copied and pasted as blocks. An empty paragraph recognizes outlines composed entirely of heading, bullet, numbered-list, or checklist lines, including nested lists and selected-block copy output; mixed prose, HTML, links, and inline Markdown continue through the literal plain-text path.

## Existing product backlog

### P1 — Product behavior

- [x] Choose and implement a search approach from the [three-option plan](document-search-plan.md). The unified search uses a derived backend workspace index, merges the active unsaved draft, searches titles and block content (including tables and Mermaid source), reports bounded results, and navigates to stable block links. [ADR-020](adr/020-backend-workspace-search.md) records why OpenSearch remains a replaceable future adapter instead of a required service.
- [x] Support legitimate public link-preview destinations in IPv4/NAT64 environments without weakening SSRF protection. Validated public DNS candidates now participate in IPv4/IPv6 family selection; standard and local-use NAT64 addresses are accepted only when their embedded IPv4 destination is public. The supplied Tistory URL completed the live API, metadata, remote-image, and local-asset flow.
- [x] Refresh external OpenGraph chips with bounded caching, make internal mention icons immediate, and define separate presentation for raw URLs and mention chips. Typed page/external mentions now migrate from legacy links, raw URLs remain underlined links, stale metadata refreshes after 15 minutes, and the server cache is bounded to 256 LRU entries. See [ADR-021](adr/021-reference-chips-and-preview-cache.md).
- [x] Add file and date reference types to the mention picker, with persistence, keyboard behavior, navigation, and import/export rules. `@file` uploads an authenticated downloadable asset reference; `@date` stores a validated ISO date atom. Exact bundles retain both types, while portable Markdown uses a standard asset link and readable date text. See [ADR-022](adr/022-file-and-date-references.md).
- [x] Define Notion-like database scope in an ADR, then implement and test the selected typed-property and row/page behavior. A database is one embedded table view with real child-page rows and bounded text, number, select, checkbox, and date properties. Exact bundles preserve behavior; portable Markdown emits a static linked table. See [ADR-023](adr/023-typed-database-rows.md).
- [x] Add a safe diagnostic and reconciliation workflow for missing, malformed, orphaned, cyclic, or externally changed document files. The offline workspace doctor reports exact issue codes and recovery candidates without modifying data; reviewed, token-bound plans create a recovery record and new immutable revisions without deleting old snapshots. See [ADR-024](adr/024-storage-diagnostics-and-reconciliation.md).
- [ ] Verify the existing browser-session conflict draft for page `f63edb5a-4d08-4145-8f55-f41a6bc130df` without silently choosing between overlapping versions.

### P2 — Documentation and acceptance

- [x] Reconcile architecture, roadmap, and ADRs with current editor features, storage paths, APIs, database scope, conflict handling, test counts, and CI status. The current-state audit removed proposed paths and API behavior that were never implemented, restored missing ADR links, and distinguishes automated Ubuntu CI from unqualified platform durability.
- [ ] Publish a Markdown-versus-exact-bundle fidelity matrix covering callouts, toggles, TOC, icons, previews, Mermaid, databases, and mentions.
- [ ] Complete native composed-input, keyboard, screen-reader, accessibility-scan, supported-platform, and emoji qualification.

### P3 — Hardening

- [ ] Add revision, receipt, and asset retention/garbage collection that accounts for active pages, trash, history, and in-progress work.
- [ ] Reduce the initial JavaScript payload; the production build still reports large chunks.
- [ ] Qualify filesystem durability and backup/restore behavior on every declared deployment platform.
