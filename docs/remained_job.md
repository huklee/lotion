# Remaining jobs

Historical completed work lives in the [implementation history](implementation-history-log.md), [test results](test-results.md), and [changelog](changelog.md). The active sequence retains its checked items until all six requested pull requests are complete so progress remains visible.

## Active incremental sequence — 2026-09-16

Each item must be implemented, tested, checked off here, committed, pushed, and submitted as its own pull request before moving to the next item.

### P0 — Bug fixes

1. [x] Fix checklist paste so text does not create an unconditional extra line. Multi-line paste at a mid-line caret must keep the first and last fragments attached to checklist items, preserve checklist types, save, and reload correctly.
2. [x] Repair the Mermaid editor so its source field owns keyboard input instead of triggering stale checklist and block-movement shortcuts; verify character-by-character editing, rendering, invalid-source recovery, save, and reload.

### P1 — UI/UX and styling

3. [x] Improve drag-box selection so the visible rectangle and selected block set remain accurate in every drag direction, while scrolling, and across nested blocks. A nested child can now be selected independently because hit testing uses each block's own content row instead of its ancestor's complete subtree.
4. [ ] Synchronize the browser tab favicon with the current page icon, including page changes, icon changes, missing icons, and a stable application fallback.
5. [ ] Consolidate text and background colors into approximately ten pastel choices with readable contrast in light, dark, and black themes.

### P1 — System and architecture

6. [ ] Add an integrated settings area for scheme, font, and related system preferences, with validated persistence, reset behavior, and immediate preview.

## Existing product backlog

### P1 — Product behavior

- [ ] Choose and implement an in-document search approach from the [three-option plan](document-search-plan.md).
- [ ] Support legitimate public link-preview destinations in IPv4/NAT64 environments without weakening SSRF protection; verify the supplied Tistory URL through the live application flow.
- [ ] Refresh external OpenGraph chips with bounded caching, make internal mention icons immediate, and define separate presentation for raw URLs and mention chips.
- [ ] Add file and date reference types to the mention picker, with persistence, keyboard behavior, navigation, and import/export rules.
- [ ] Define Notion-like database scope in an ADR, then implement and test the selected typed-property and row/page behavior.
- [ ] Add a safe diagnostic and reconciliation workflow for missing, malformed, orphaned, cyclic, or externally changed document files.
- [ ] Verify the existing browser-session conflict draft for page `f63edb5a-4d08-4145-8f55-f41a6bc130df` without silently choosing between overlapping versions.

### P2 — Documentation and acceptance

- [ ] Reconcile architecture, roadmap, and ADRs with current editor features, storage paths, APIs, database scope, conflict handling, test counts, and CI status.
- [ ] Publish a Markdown-versus-exact-bundle fidelity matrix covering callouts, toggles, TOC, icons, previews, Mermaid, databases, and mentions.
- [ ] Complete native composed-input, keyboard, screen-reader, accessibility-scan, supported-platform, and emoji qualification.

### P3 — Hardening

- [ ] Add revision, receipt, and asset retention/garbage collection that accounts for active pages, trash, history, and in-progress work.
- [ ] Reduce the initial JavaScript payload; the production build still reports large chunks.
- [ ] Qualify filesystem durability and backup/restore behavior on every declared deployment platform.
