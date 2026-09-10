# Implementation history log

## 2026-09-09T22:09:19Z — Editor follow-ups, previews, Mermaid and contrast

Exact UTC checkpoint recording time (2026-09-10 07:09:19 KST), not reconstructed individual edit times.

Implemented `/page` child creation with failure recovery; removed link-DOM observer feedback loops; same-tab mention navigation; refreshed page titles/icons and tree on opening; searchable native emoji and dismissal; ancestor breadcrumbs; callouts, live TOC and editable table insertion. Added persisted OpenGraph title/image previews with bounded public-network-only fetches, local assets and exact-bundle metadata. Fixed paste chooser caret positioning, scroll tracking and cancellation, retained preceding text, and prevented repeated child creation requests.

Added `/mermaid` with local lazy loading, editable source, debounced non-interactive SVG-image preview, inline syntax errors and fenced Markdown import/export. Fixed unreadable code by overriding BlockNote's default dark token palette on the beige surface; all configured light-palette foregrounds are contrast-adjusted to at least 4.5:1. Kept the five-language selector, red fallback and vertical spacing; legacy language labels no longer crash pages.

Rationale and limitations: [ADR-011](adr/011-editor-previews-and-diagrams.md). Initial three-browser contrast tests caught faint HTML comments (4.09:1); added palette adjustment and regression coverage instead of accepting that failure. Full verification is running at this checkpoint; final counts will be recorded separately. User document files were not deleted.

Append major work entries using exact clock readings and explicit time zones. A recording timestamp is not retroactively asserted to be a completion timestamp. This is the single implementation record, covering history, current progress, and outstanding work. [Test results](test-results.md) records verification.

Preserved baseline design notes: sortable string ranks avoid ordinary numeric rebalancing; backups use separate destinations; mutation digests distinguish safe save retries from creation/bulk receipts. No application features existed at the documentation baseline.

## 2026-09-09T03:27:05+09:00 — Documentation baseline recorded

Timestamp type: recording time, from 2026-09-08 18:27:05 UTC. Exact completion timestamps for preceding file creation were not captured.

Task: user-requested architecture, plans, test coverage, and Markdown tracking. Milestone: pre-M0.

Completed before this recording: inspected the empty workspace; created architecture, roadmap, test plan, workflow, decisions, implementation log, test-results placeholder, and documentation index. No application code was present or implemented.

Rationale/evidence: [architecture](architecture.md), [baseline decisions](decisions.md), [test plan](test-plan.md).

Application verification remains pending; see [test results](test-results.md).

## 2026-09-09T03:29:27.226+09:00 — Requirements and documentation verification checkpoint

Timestamp type: exact validation checkpoint emitted by the executing process; the preceding edits completed before this checkpoint.

Task: incorporate user follow-ups and verify the documentation baseline. Milestone: pre-M0.

Completed work:

- Added image file drop, rectangular multi-block selection, whole-section movement, and related save/undo/browser test cases.
- Made recursive whole-folder import and hierarchical export explicit, including ZIP fallback, relative assets, empty directories, and collision handling.
- Added dedicated technical decisions for interactions, folder portability, and delegated engineering decisions, with reasons and alternatives.
- Added this separate timestamped history and workflow requirements for future major work.
- Ran documentation validation: 12 Markdown files, 36 local links, one JSON example, 65 unique planned test scenarios; exit 0, zero errors.

References: [interaction decision](adr/007-editor-interactions.md), [folder decision](adr/008-folder-portability.md), [ownership decision](adr/009-decision-ownership.md), [executed results](test-results.md).

Limitations: documentation-only checkpoint; no product functionality or application tests executed. Next step remains M0 implementation and test harness.

## 2026-09-08T18:52:54.560Z — First application and test harness checkpoint

Timestamp type: exact recording time from the local runtime. Tasks: M0–M5 implementation baseline; verification in progress.

Implemented React/BlockNote editing, a sidebar/tree, title synchronization, save coordination with draft checkpoints and conflicts, image upload/drop, block selection/section movement, trash/restore, themes, search, filesystem revision storage, API validation, and recursive folder/ZIP Markdown portability.

Added strict TypeScript, ESLint, Vitest, and Playwright harnesses. The initial production build and lint passed after correcting TypeScript header/mock types. The first unit/integration run passed 53 of 56 cases and exposed a JSZip stream compatibility bug in three import tests; replaced unsupported async iteration with bounded event-stream consumption and started a rerun. Browser engines were installed for actual browser validation. These are intermediate results, not milestone completion claims.

Consolidated the two previous implementation records into this file at the user's request. Preserved historical timestamps and design notes, removed the redundant summary, and updated references. The consolidated notes are recoverable here.

Rationale: [ADR-010](adr/010-implementation-foundations.md). Next: resolve test failures, execute browser workflows, verify deployment/restore, and document actual coverage and limitations.

## 2026-09-09T19:58:16+09:00 — Self-hosted MVP implementation verified

Timestamp type: exact recording time from the local clock. Tasks: M0–M6 MVP scope and regression verification.

Completed the browser application and filesystem service: BlockNote editing, slash commands, title/sidebar synchronization, per-document auto-save with IndexedDB drafts and revision conflicts, page hierarchy with nesting and sibling reordering, trash/restore, themes/search, image upload/drop/cancel, block rectangle selection, section movement, recursive folder/ZIP Markdown import/export, exact bundles, stable assets, loopback defaults, optional token authentication, local fonts, and operator documentation.

Storage uses immutable document revisions and an atomic manifest visibility boundary. Added deterministic validation, retry receipts, writer locking, safe path/URL checks, fault injection, startup corruption refusal, and backup restoration tests. Added GitHub Actions for Node 24 and the three-browser suite.

Verification: `npm run check` passed ESLint, strict type/build, 63 unit/integration tests, and 42 browser workflows across Chromium, Firefox, and WebKit. `npm run test:performance` passed the documented budgets on Apple M1. Exact commands, metrics, fixes, and limits are in [test results](test-results.md).

Outstanding hardening: Linux/power-loss qualification, native IME and assistive-technology manual reviews, retention-aware garbage collection, and initial-bundle reduction. These are tracked in [roadmap](roadmap.md); no observed automated-test data-loss or silent-overwrite defect remains open.
