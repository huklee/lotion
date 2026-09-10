# Implementation history log

## 2026-09-10T13:52:00Z — Structured decision-log transfer

Transferred the completed decision-log restructuring from `/Users/huklee/Work/yestion` into this repository. Reformatted `docs/decisions.md` as bullet-based status, decision-record links, and Context/Decision/Alternatives/Consequences/Revisit fields without changing decision meaning. Validated all local Markdown links before publication.

## 2026-09-10T13:49:04Z — Installation guide and incremental publication

Exact UTC recording time. Added root README.md with installation/production startup first, followed by development startup, configuration, tests and documentation links. Added the same quick-start at the head of docs/README.md and updated the runbook to Lotion configuration names and upgrade compatibility. Documentation links were validated; no additional application code changed for this documentation unit.

Published and verified separate remote updates for 2ff487e (remaining-work checklist) and 7ed19a5 (Lotion rename with compatibility). This guide and record form the next individual commit/push unit. Outstanding WebKit failures and feature work remain documented rather than being marked finished.

## 2026-09-10T13:48:20Z — Lotion rename and compatibility verified

Exact UTC recording time. Renamed UI/wordmark, titles, slash groups, CSS/MIME namespaces, package/lockfile, exports, markers, environment configuration and current documentation to Lotion. Retained old literals only in compatibility readers/tests for browser session/theme/token settings, draft recovery, environment aliases, directory uploads and exact bundles/TOC imports. No canonical document data or asset IDs were renamed. Decision: [ADR-013](adr/013-lotion-naming-and-compatibility.md).

`npm run check` passed lint, type/build and 96 unit/integration tests; 67/69 browser tests passed. All three new browser migration tests passed. The two WebKit failures reproduce previously recorded paste-scroll positioning and ResizeObserver errors, still open in remained_job.md. This commit publishes the requested rename without claiming that the remaining-jobs backlog or full release gate is complete.

## 2026-09-10T13:45:39Z — Remaining-work checklist prepared for publication

Exact UTC recording time. Added docs/remained_job.md from the request audit, preserving its original audit timestamp, failed local/CI test counts, live-preview findings, missing features and completion gates. This backlog is published as its own documentation unit before the requested Lotion rename and installation guide. No backlog task is marked complete merely because the list has been committed.

## 2026-09-10T05:25:13Z — Incremental GitHub publication completed

Exact UTC recording time after verifying the fifth push. GitHub authentication is now available for huklee. Pushed each existing commit separately to https://github.com/huklee/lotion.git, branch main, verifying the remote SHA with git ls-remote after each operation:

1. f9e935c — persistence and document service foundation.
2. 22063f3 — block editor and workspace interactions.
3. f60984b — browser and persistence verification.
4. 5b0de3e — architecture and implementation history.
5. fe69722 — draft-preserving revision conflict resolution.

Configured local main to track origin/main. All five remote updates succeeded as fast-forwards (the first created main). No application code changed during publication; existing test evidence remains in test-results.md. This completion record is published as a separate documentation commit. Local data, dependencies and generated artifacts remain excluded.

## 2026-09-10T05:23:03Z — Destination verification completed for conflict fix

Exact UTC recording time. Ported the conflict changes and tests to lotion; lint/type/build and 92 unit/integration tests passed. Full browser run: 64/66, then all 6 targeted cases passed after correcting two slash-page test assumptions. All 9 conflict/navigation/offline recovery browser cases passed. Exact scope is recorded in test-results.md. Updated the commit plan to reflect the four existing local commits plus a separate conflict fix. Attempted pushing only the first foundation commit; HTTPS credential lookup failed, and no later push was attempted.

## 2026-09-10T05:17:23Z — Conflict recovery and resolution verified

Exact UTC recording time. Investigated page f63edb5a-4d08-4145-8f55-f41a6bc130df: server revision 47, 13 blocks, schema-valid. A read-only live browser smoke check returned API 200 and rendered the editor with content writes blocked. The user's existing browser draft is inaccessible to the automation browser, so no claim is made that a competing draft has already been selected or discarded.

Fixed invisible recovery controls caused by Conflict without an error message. Checkpoints now carry base content; recovery preserves the original revision. Added conservative three-way merge for independent fields/top-level blocks, latest-version review, explicit local/server choice, archived local drafts, conditional revision-safe resolution, fresh mutation IDs, editor refresh, and error handling for recovery-copy creation. Removed the unarchived discard button. Existing ambiguous drafts remain available for the user's choice after reloading the updated app.

Verification: build/typecheck and ESLint passed; 92 unit/integration tests passed. Nine browser tests passed across Chromium, Firefox and WebKit covering two-tab conflict, reload/resolve/save/reload, navigation during saves and offline draft recovery. Decision: [ADR-012](adr/012-conflict-resolution.md). Port this change into lotion as its own fix commit before completing the pending incremental pushes.

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
