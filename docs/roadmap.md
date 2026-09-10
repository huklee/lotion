# Implementation roadmap

Status: usable self-hosted MVP implemented and locally verified on 2026-09-09. Remaining hardening is listed below; CI has been configured but has not yet run on a remote Linux runner.

Every milestone includes implementation, applicable executed tests, failure fixes, and updates to [implementation history log](implementation-history-log.md), [test results](test-results.md), and [decisions](decisions.md). Unexecuted gates remain unchecked.

## M0 — Architecture validation and test harness (3–5 days)

- [x] Confirm initial browser/OS scope, supported blocks, limits, and embed expectations.
- [x] Prototype BlockNote nesting, reordering, slash commands, image integration, and automated Unicode/Korean text behavior.
- [x] Prototype rectangular block selection, whole-section movement, image file drops, and recursive folder intake; document browser capability limits.
- [x] Select and pin runtime/packages; record editor licensing and package choices.
- [x] Validate atomic replacement and workspace writer ownership on the available local filesystem.
- [x] Select fractional ranks and establish Apple M1 performance budgets/results.
- [x] Scaffold source layout, formatting/type checks, Vitest, Playwright, and GitHub Actions CI.
- [x] Run initial tests and document repeatable commands.

Gate: editor and storage assumptions demonstrated; actual harness commands recorded.

## M1 — Editor core (1–2 weeks; depends on M0)

- [x] Implement shell, editor adapter, title input, and supported block schema.
- [x] Add slash commands, drag-and-drop, keyboard movement, undo/redo, and paste behavior.
- [x] Add gutter-origin selection rectangles, multi-block movement, section boundary handling, drag auto-scroll, and drop indicators.
- [x] Add keyboard-aware dialogs/menus and system/light/dark themes.
- [x] Run automated EDIT/UX browser scenarios, including Korean and Unicode text.
- [x] Resolve observed automated-test failures and record evidence.
- [ ] Complete manual native IME and assistive-technology checks on declared release platforms.

Gate: representative content edits correctly in browser tests, without persisted-data claims.

## M2 — Persistence and auto-save (2 weeks; depends on M1)

- [x] Implement validated repository, revision preconditions, mutation identity, and exclusive writer ownership.
- [x] Implement atomic manifest publication, startup validation, and failure recovery.
- [x] Implement debounce/max-wait, isolated per-document saves, retries, and accurate status.
- [x] Add IndexedDB checkpoints and conflict recovery.
- [x] Run SAVE and IO scenarios, including real process termination, injected disk errors, and two-tab conflicts.
- [x] Verify create -> edit -> save -> reload/restore as an end-to-end slice.

Gate: tested acknowledged writes survive process failures; stale clients cannot silently overwrite.

## M3 — Workspace hierarchy (1–2 weeks; depends on M2)

- [x] Build/rebuild sidebar projection and immediate title synchronization.
- [x] Add create, nest, sibling reorder, trash, restore, and URL navigation.
- [x] Enforce cycle, missing-parent, rank, and deleted-ancestor rules.
- [x] Run TREE scenarios and SAVE navigation regressions.

Gate: hierarchy and pending edits remain consistent across navigation/restart.

## M4 — Assets and links (1 week; depends on M2/M3)

- [x] Stream/validate/hash uploads and serve authenticated asset routes.
- [x] Add upload progress, retry, cancellation/reload behavior, and stable references.
- [x] Support dropping multiple image files into the editor at a precise insertion point; distinguish internal block drags from external file drops.
- [x] Support editor links and imported internal-link remapping.
- [ ] Define/test retention-aware asset cleanup.
- [x] Run implemented ASSET and applicable SEC scenarios.

Gate: assets survive rename/move/reload/restore; failed uploads do not appear durably saved.

## M5 — Markdown portability (2 weeks; depends on M3/M4)

- [x] Implement supported Markdown mappings and fixture corpus.
- [x] Add single-file and hierarchical import/export with link rewriting.
- [x] Support recursive whole-folder picker/drop intake, empty directories through manifests, and complete folder-tree ZIP export/re-import; provide browser capability fallbacks.
- [x] Add exact bundles, manifest validation, and changed-Markdown detection.
- [x] Implement atomic staged-import visibility and restart-safe publication.
- [x] Run implemented MD, import IO, and archive SEC scenarios.

Gate: semantic Markdown round-trips pass; exact bundles restore supported document data/assets.

## M6 — Release hardening (1–2 weeks; depends on M1–M5)

- [x] Add documented deployment, authentication, and remote-access protections.
- [x] Document revision history, stopped-workspace backup/restore, and future migration/rollback workflows.
- [x] Run a fresh-directory backup restore drill and newer-schema refusal test.
- [x] Run lint, type/build, 63 unit/integration tests, 42 browser tests, and the PERF benchmark.
- [x] Resolve observed release-blocking automated-test defects and record remaining limitations.
- [x] Complete the initial operator runbook and publish verification in Markdown.
- [ ] Run the configured CI workflow on Linux and qualify Linux filesystem durability.
- [ ] Add automated accessibility scanning and perform manual keyboard/screen-reader review.
- [ ] Add revision/receipt/asset retention and garbage-collection tooling before long-term heavy use.
- [ ] Reduce the initial JavaScript bundle (currently approximately 1.15 MB minified / 345 KB gzip).

Gate: fresh deployment, editing, restart, export/import, and restore all pass on supported environments.
