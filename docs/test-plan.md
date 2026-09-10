# Test plan

## Conflict resolution regression gate

Verify stale recovered drafts always expose resolution controls; separate-field/block edits merge; competing edits and structural changes stay in Conflict; local archives survive resolution; archive failure prevents replacement; a server change after review triggers another conflict; successful resolution replaces the rejected mutation and persists across reload. Execute real two-tab resolution and offline recovery in all three browsers. Never erase the user's browser storage to clear a conflict.

## Editor regression additions — 2026-09-10

- Verify every supported code grammar (JSON/HTML/Python/Go/C++) in light and dark modes. Measure computed token colors against the actual beige background; require at least 4.5:1, including comments. Keep spacing, selector and highlighting tests.
- `/mermaid`: insert through slash search, render a nonempty image, edit source, report invalid syntax, recover with valid source, save and reload. Round-trip fenced Mermaid source through Markdown conversion.
- `/page`: successful child creation/navigation, live TOC, same-tab mentions, failed-create recovery, no lost preceding mention text, legacy code rendering.
- Paste chooser: cursor-block location, scroll tracking, cancellation and raw URL insertion. External preview: mocked OpenGraph title/image, persistence and hover after reload; SSRF address/URL validation and HTML parsing unit tests.
- Emoji: search/selection, persistence, Escape/outside dismissal, breadcrumb parent navigation. Run browser scenarios in Chromium, Firefox and WebKit using isolated test data, not the user's workspace.

Status: executable application tests implemented for the MVP. See [test results](test-results.md) for the exact verified subset and remaining manual/operating-system checks.
Related: [architecture](architecture.md), [roadmap](roadmap.md), [executed results](test-results.md).

## Execution policy

Build tests with the feature, execute them before milestone completion, fix failures, and rerun affected checks. Run a broader suite when shared behavior changes or a failure reveals wider risk. Release requires the full required suite. Documentation-only changes require documentation checks, not claims of application verification.

Use Vitest for schemas, conversions, save coordination, and repository integration; Playwright for actual browser workflows. Test behavior and invariants rather than private implementation details. Do not add brittle tests that merely mirror trivial implementation.

Each regression fix includes a reproducer where practical. Save browser failure traces/screenshots without private content. Keep fixtures synthetic. Tests use isolated temporary workspaces, never real user data. Clean up only test-owned paths.

## Planned commands

During M0 define package scripts for `typecheck`, `lint`, `test:unit`, `test:integration`, `test:e2e`, and `build`. Pin the package manager and runtime. These are required script names to implement, not commands claimed to exist today. Record actual invocations, versions, exit statuses, counts, durations, and artifact paths in the results log.

PR gate: typecheck, lint, relevant unit/integration suites, production build, and affected browser workflows. Storage/schema changes also run fault/recovery regressions. Release gate: complete suite, supported browser matrix, security cases, restore/upgrade drill, and performance benchmarks.

## Editor and UX scenarios

| ID | Scenario | Expected result / method |
| --- | --- | --- |
| EDIT-01 | Paragraph, heading, list, checklist, code, table, image, link | Supported content survives editor serialization; fixture tests and browser editing |
| EDIT-02 | Slash menu filtering, selection, escape | Correct insertion, predictable focus, no stray command text |
| EDIT-03 | Drag/nest/reorder, keyboard movement, duplicate | Order/nesting retained; moves preserve IDs, duplicates get new IDs |
| EDIT-04 | Undo/redo across typing and block changes | Logical actions reverse without corrupted blocks |
| EDIT-05 | Rich/plain paste, Unicode, emoji, long text | Expected safe content with no text truncation |
| EDIT-06 | Korean/other IME composition during save/menu use | Composition text is not duplicated, truncated, or committed prematurely; browser tests plus real IME manual smoke |
| EDIT-07 | Gutter-origin rectangle selection; normal text drag | Intersecting blocks select visibly; normal text selection remains native; Escape clears block selection |
| EDIT-08 | Multi-block drag across viewport with auto-scroll | Stable order/IDs, correct drop marker, one undo action, no duplicate or lost blocks |
| EDIT-08A | Rectangle-select multiple lines/blocks, then drag the selected group | All selected blocks move together at the indicated insertion point; IDs/order stay stable and one undo restores the group |
| EDIT-09 | Move heading section with nested children to start/middle/end | Same-or-higher heading boundary honored; subtree remains intact; undo/reload preserves content |
| EDIT-10 | Drag cancellation, invalid nested target, document switch | No partial move, cycle, stale selection, or unintended save |
| UX-01 | Header title edit | Sidebar changes immediately before server acknowledgment |
| UX-02 | System/light/dark reload and preference changes | Correct theme, readable selection, no startup flash |
| UX-03 | Keyboard-only tree/menu/dialog workflows | Visible focus, correct labels, escape/return behavior; accessibility scan plus manual check |

## Auto-save and concurrency scenarios

| ID | Scenario | Expected result / method |
| --- | --- | --- |
| SAVE-01 | Type, pause 3 seconds | One latest snapshot save; controlled-clock unit test and browser smoke |
| SAVE-02 | Continuous typing beyond 10 seconds | Maximum wait dispatches a snapshot; no starvation |
| SAVE-03 | Change selection without changing content | No dirty generation or save |
| SAVE-04 | Type while a response is delayed | Old acknowledgment cannot mark newer edits clean; next snapshot saves |
| SAVE-05 | Navigate A -> B with A save pending | A persists; response cannot overwrite B or its status |
| SAVE-06 | Commit succeeds but response is lost | Same mutation retry is recognized, or safely conflicts if superseded; no overwrite |
| SAVE-07 | Same mutation ID, different payload | Rejected explicitly |
| SAVE-08 | Two tabs save the same base revision | One succeeds, one conflicts; losing draft remains recoverable |
| SAVE-09 | Disconnect, type, refresh, reconnect | Checkpoint restored; server revision checked before replay |
| SAVE-10 | IndexedDB failure/eviction | Recovery limitation shown; no false offline-durability claim |
| SAVE-11 | Old acknowledgment vs newer checkpoint | Only acknowledged generations are cleared |
| SAVE-12 | Immediate shortcut/hidden-page flush | Flush attempted without relying on unload for correctness |
| SAVE-13 | Content save races with move/trash | Revision check prevents stale overwrite/resurrection |

## Filesystem and recovery scenarios

Use a repository fault-injection interface for deterministic errors and a child backend process for actual process-kill tests. Process termination does not simulate power loss; qualify filesystem durability separately and state the limits.

| ID | Scenario | Expected result / method |
| --- | --- | --- |
| IO-01 | Terminate before/after temp write, flush, rename, acknowledgment | Restart sees valid old or new canonical JSON; acknowledged version survives tested process crash |
| IO-02 | ENOSPC, access denied, rename/flush failure | Save fails visibly; prior committed content preserved where commit has not occurred |
| IO-03 | Burst of concurrent mutations | Serialized preconditions; no malformed files or lost successful updates |
| IO-04 | Two backend processes use one workspace | Second writer refused; test stale ownership recovery |
| IO-05 | Stray temp files and corrupt/missing cache | Canonical files retained; derived index rebuilt |
| IO-06 | Corrupt document / newer schema | Explicit error/read-only handling; no silent empty replacement |
| IO-07 | Interrupted multi-file import | Incomplete content hidden; committed job recovered idempotently |
| IO-08 | Restart during migration | Recoverable original; retry/rollback documented and tested |
| IO-09 | Backup during pending edits, restore fresh | Consistent committed snapshot and all referenced assets; unsaved drafts not misrepresented |
| IO-10 | Retry a create request after lost acknowledgment | No duplicate page from identical mutation |

## Hierarchy, assets, and portability scenarios

| ID | Scenario | Expected result / method |
| --- | --- | --- |
| TREE-01 | Duplicate/empty/Unicode titles; rename | Stable identity; deterministic display; no path collision |
| TREE-02 | Self/descendant/missing/deleted parent move | Invalid operation rejected without partial mutation |
| TREE-03 | Reorder and restart, concurrent tree preconditions | Stable deterministic order; stale operation rejected |
| TREE-04 | Trash parent with children; restore | Ancestor visibility respected; independently trashed children stay trashed |
| TREE-05 | Rebuild sidebar after cache removal | Same authoritative titles/hierarchy |
| ASSET-01 | Same bytes uploaded twice | Stable content identity and deduplication |
| ASSET-02 | Interrupted upload, reload, retry | No broken reference represented as successfully saved; recover/re-upload UI |
| ASSET-03 | Rename/move/trash/restore page with image | Asset remains available through stable references |
| ASSET-04 | Cleanup with history/trash/import references | Referenced assets retained; only eligible unreferenced assets removed |
| ASSET-05 | Drop multiple images at a block boundary while typing | Input order and target preserved; per-file progress/failure; no replacement of unrelated text |
| ASSET-06 | Image drop during slow upload, undo, navigation, reload | Upload completion cannot resurrect removed blocks or mutate another page; draft recovery/re-upload state explicit |
| MD-01 | Supported Markdown corpus round-trip | Normalized semantic trees equal; whitespace need not match |
| MD-02 | Exact bundle round-trip | Supported JSON data, hierarchy, links, and asset bytes restored |
| MD-03 | Nested export with duplicate/Unicode names | Unique sanitized paths; all relative links resolve |
| MD-04 | Unsupported colors/layout/HTML/blocks | Explicit warnings/fallback; source not silently discarded |
| MD-05 | Edited Markdown with unchanged snapshot | Hash mismatch detected; source choice required |
| MD-06 | Missing assets, broken links, foreign IDs | Clear report and deterministic remapping/fallback |
| MD-07 | Code fences, escaped syntax, deep lists, tables, frontmatter | Documented mappings; resource limits enforced |
| MD-08 | Whole folder picker/drop with nested pages, assets, and empty directories | Full relative hierarchy preserved; manifests retain empty directories; no flattened or skipped files |
| MD-09 | Folder -> ZIP export -> whole-tree import | Page order/links/assets restored; byte hashes match supported local assets |
| MD-10 | Unsupported directory-drop/write capability | Clear picker/ZIP fallback; no false success or silent partial folder import |
| MD-11 | Directory with no index page, duplicate basenames, case collisions | Deterministic container-page mapping and collision handling with import report |

## Security and performance

| ID | Scenario | Expected result / method |
| --- | --- | --- |
| SEC-01 | Traversal, absolute paths, symlink escapes | Cannot read/write outside workspace/import staging |
| SEC-02 | Oversized payload/archive expansion/deep nesting | Bounded resource use and explicit rejection |
| SEC-03 | Script/HTML/MDX, unsafe links, spoofed file MIME | No execution; safe rendering/serving |
| SEC-04 | Unauthorized document/asset access and forged requests | Rejected by the selected auth/origin policy |
| SEC-05 | Link-preview private IPs and redirect chains, if implemented | Internal-network fetches denied |
| PERF-01 | 10,000-page tree and 500-block active document | Measure open/input/save/index/memory against M0 budgets |
| PERF-02 | Long typing session, large image corpus | No accumulating requests/listeners/drafts or unexplained memory growth |

## Fixture matrix and environments

Include empty/large documents, deep hierarchies up to the supported limit, duplicate titles, Unicode filenames, tables/lists/code, internal block links, image captions, unsupported blocks, missing assets, and intentionally invalid inputs.

Baseline backend qualification: Linux and local filesystem. Run Chromium, Firefox, and WebKit browser workflows where available; list unsupported/skipped cases explicitly. Native IME and assistive-technology behavior requires manual checks because automation is incomplete. Record OS/filesystem/runtime/browser versions for relevant results.

## Release acceptance

- All required gates pass on declared supported environments.
- No unresolved known data-loss, silent-overwrite, corruption, auth-bypass, or import execution defects.
- Core editing/save/reload/navigation/import/export/restore workflows pass.
- Every failure has a disposition; flaky tests are investigated rather than hidden by retries.
- Fresh-install restore and upgrade recovery are demonstrated.
- Documentation describes remaining limits and recovery behavior accurately.

These checks reduce routine bugs but do not guarantee a defect-free product. Report verification boundaries precisely.
