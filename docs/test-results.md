# Test results

## 2026-09-15T11:09:08Z — 0.4.0 control panel gate passed

The final `npm run check` exited **0** in **129.57 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **103/103 unit and integration tests**, and **111/111 browser tests** passed across Chromium, Firefox and WebKit with four workers. New unit coverage verifies supported, invalid and boolean preference values. The three-browser regression verifies immediate theme/text-size/page-width application, computed CSS, persistence after reload, sidebar startup visibility and complete reset behavior. Large build-chunk warnings remain non-fatal. GitHub CI is pending the release push at this checkpoint.

## 2026-09-15T10:56:21Z — 0.3.1 checklist/callout paste and scroll gate passed

The final `npm run check` exited **0** in **131.96 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **101/101 unit and integration tests**, and **108/108 browser tests** passed across Chromium, Firefox and WebKit with four workers. The new three-browser regression places a single plain-text paste at exact mid-line selections inside an existing checklist and callout, verifies both original block types remain singular after save/reload, and checks that toggling a distant checkbox persists while preserving the `.main-scroll` offset. Existing mouse/keyboard checkbox completion and multi-line checklist paste tests also passed. Large build-chunk warnings remain non-fatal. [GitHub CI run 34960911713](https://github.com/huklee/lotion/actions/runs/34960911713) subsequently passed the complete Ubuntu / Node 24 gate for release commit `0bdb9b0`.

## 2026-09-14T22:53:10Z — parallel harness GitHub CI confirmed

Harness commit `48f9c9f` was pushed to `origin/main`. [GitHub Actions run 34905987686](https://github.com/huklee/lotion/actions/runs/34905987686) completed **successfully** on Ubuntu / Node 24 with the complete two-worker `npm run check`. The job took **3 minutes 32 seconds** and its check step took **151 seconds**. The preceding comparable successful run [34903723704](https://github.com/huklee/lotion/actions/runs/34903723704) took 5 minutes 35 seconds with a **278-second** check step. Parallel isolation therefore reduced the CI check step by **127 seconds / 45.7%** (**1.84× speedup**) and the full job by **123 seconds / 36.7%**. This documentation-only follow-up records the remote result.

## 2026-09-14T22:45:47Z — parallel harness complete local gate passed

The final `npm run check` exited **0** in **120.96 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **101/101 unit and integration tests**, and **105/105 browser tests** passed across Chromium, Firefox and WebKit with four workers. The browser phase reported 1.5 minutes; the dedicated benchmark below provides the less noisy before/after measurement. Large build-chunk warnings remain non-fatal. GitHub CI is pending the push at this checkpoint.

## 2026-09-14T22:42:20Z — parallel browser-test benchmark

Refactored the Playwright harness so each worker owns a production server on an operating-system-assigned localhost port and an independent temporary repository. With `fullyParallel` enabled on macOS arm64 (8 logical CPUs, 8 GiB memory; Node 25.8.2), the unchanged **105/105 browser cases passed** across Chromium, Firefox and WebKit using the configured four local workers in **90.79 seconds** (Playwright: 1.5 minutes). The preceding single-worker release gate took **174 seconds** (Playwright: 2.9 minutes), so elapsed browser-test time fell by **83.21 seconds / 47.8%**, a **1.92× speedup**.

An explicit eight-worker capacity probe was rejected as the default: resource contention caused five Firefox timeouts before the run was stopped, with 56 cases passed and 44 not run. This is benchmark evidence for the four-worker limit on this 8 GiB machine, not an application regression. The checked-in policy uses 50% of logical CPUs locally and two workers in CI. Lint and typecheck passed after the harness change; the complete local gate is recorded above.

## 2026-09-14T22:27:44Z — 0.3.0 GitHub CI confirmed

The test/documentation follow-up commit `5ad6cce` was pushed to `origin/main`. [GitHub Actions run 34903723704](https://github.com/huklee/lotion/actions/runs/34903723704) completed **successfully** on Ubuntu / Node 24 in 5 minutes 35 seconds: checkout, `npm ci`, browser installation, and the complete `npm run check` passed. This remotely verifies the 0.3.0 application release and its Linux-portable regression suite.

## 2026-09-14T22:12:57Z — 0.3.0 complete local release verification

The final `npm run check` exited **0** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **101/101 unit and integration tests**, and **105/105 browser tests** passed across Chromium, Firefox, and WebKit in 2.9 minutes. Coverage includes favorites persistence/cross-tab sync, native modified-click links, route history, checklist click/shortcut/paste behavior, spellcheck suppression, calendar Enter acceptance, blank-line Markdown clipboard output, and all prior regressions.

Two preceding full attempts each passed 104/105 browser cases and exposed the same WebKit folder-import assertion once the shared isolated test workspace exceeded 100 root pages. The imported hierarchy and editor link were valid, but its root was outside the sidebar's first rendered page. The final implementation expands the rendered root limit after a successful import; the complete rerun above passed. A focused WebKit folder-import run also passed 3/3. Large build-chunk warnings remain non-fatal. GitHub CI is pending the release push at this checkpoint.

Initial GitHub run [34903052123](https://github.com/huklee/lotion/actions/runs/34903052123) passed the application behavior but failed one checklist test in all three engines: Linux normalized away an empty suffix block and produced three checklist blocks where macOS retained it and produced four. Both pasted lines stayed checklist items, no paragraph appeared, and the test proceeded through all remaining cases. The follow-up assertion retains those functional and persistence checks while allowing the editor engine to discard the semantically empty suffix. A follow-up CI run is pending.

## 2026-09-14T21:50:33Z — 0.3.0 focused editor verification

`npm run lint`, `npm run typecheck`, and 14 focused Markdown/clipboard unit tests passed. After a production rebuild, six focused browser scenarios passed across Chromium, Firefox, and WebKit: checklist mouse completion, Ctrl+Enter/⌘Enter toggling, checklist-preserving multi-line paste and reload, inherited spellcheck suppression, and next-Enter insertion of today's date. Earlier iterations correctly exposed the production-test server's stale build, BlockNote's stopped checkbox event, and Firefox target detachment; those were corrected before the passing run.

This focused checkpoint is superseded by the complete passing release gate above.

## 2026-09-13T14:45:53Z — 0.2.0 GitHub CI confirmed

Release commit `cd018bc` was pushed to `origin/main`. [GitHub Actions run 34763348532](https://github.com/huklee/lotion/actions/runs/34763348532) completed **successfully** on Ubuntu / Node 24: `npm ci`, browser installation and `npm run check` passed, including **100 unit/integration tests** and **90/90 browser tests** (3.1 minutes). This verifies the exact application commit and resolves the prior local/CI regression gate. The following documentation-only commit records this result without changing the application version.

## 2026-09-13T14:39:13Z — 0.2.0 complete local release verification

`npm run check` exited **0** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/build, **100 unit/integration tests**, and **90/90 browser tests** passed. Browser duration: 2.8 minutes. Tests include the earlier CI regressions and all new clipboard, calendar, TOC and Backspace behavior. A preceding focused invocation passed 21/21 cases across Chromium, Firefox and WebKit.

New deletion checks cover parent/child section removal, one-step undo, persistence after reload, ordinary text Backspace, rectangle deletion of all blocks and continued typing. Existing section/rectangle drag/move regressions passed. Clipboard checks verify each stored line is plain text (including literal Markdown, HTML and unsafe-looking links) and survives save/reload; unit checks cover CRLF, empty lines, spaces and rejecting more than 10,000 lines. Calendar tests exercise `@date`, direct date entry, next-month/day selection, insertion, save/reload and Escape cancellation. TOC tests check both computed alignment and actual text-left coordinates while retaining heading indentation.

Intermediate tests exposed focus differences after selection, asynchronous focus calls disrupting native caret placement, and Markdown paste rules formatting text passed through `pasteHTML`. The final implementation scopes Backspace to active custom selections, preserves normal click focus, and inserts validated plain schema nodes without paste rules. Only the complete final invocation above is counted as release verification.

Documentation validation: 24 Markdown files / 84 local links passed before the final result entries; package/lock versions match at 0.2.0, and `git diff --check` passed. The search document contains three reviewed implementation proposals, not an implemented search feature. Large build-chunk warnings remain. GitHub CI for the release commit is pending publication at this checkpoint.

## 2026-09-13T09:13:54Z — Mermaid paste and Markdown clipboard export

`npm run check` exited 0 on macOS arm64: ESLint, TypeScript/production build, **98 unit/integration tests**, and **75/75 browser tests** passed across Chromium, Firefox and WebKit. Existing paste-chooser and legacy-code regressions also passed in this invocation; this is local evidence, not a new GitHub CI result.

New tests cover complete fenced Mermaid recognition (including CRLF), rejecting incomplete/mixed/other-language input, diagram creation from the supplied `graph TD; A --> B;` example, unwrapping a fence in an existing diagram source input without duplicating blocks, rendering, saving and reloading. Chromium uses an actual clipboard write and paste shortcut. Firefox/WebKit dispatch clipboard events into the editor root. Export tests check the latest draft title, bold body, Mermaid fence and final paragraph, successful-copy feedback, denied clipboard writes and retry availability. Chromium reads the actual Clipboard API result; Firefox/WebKit use a clipboard adapter because automated clipboard permissions differ by engine.

The initial browser attempt could not launch because the Playwright browser cache was missing; `npx playwright install chromium firefox webkit` restored it. The six focused new browser cases then passed. An intermediate full check was interrupted to correct handling of native paste events targeting the editor root and add the real Chromium paste path; the final complete invocation above supersedes it. Large-bundle build warnings remain.

## 2026-09-10T13:48:20Z — Lotion rename verification

Executed `npm run check` in `/Users/huklee/work/lotion`: lint and type/build passed; **96 unit/integration tests passed**, **67/69 browser cases passed**. The new legacy-settings/draft migration scenario passed in Chromium, Firefox and WebKit. Unit/integration tests verify old/new bundle imports, legacy TOC/new marker export, settings precedence and old-draft cleanup after save.

The full command exited 1 because of the previously reported WebKit paste-chooser scroll-position assertion and ResizeObserver notification in the legacy-code/failed-subpage scenario. These remain open in [remaining jobs](remained_job.md); no broad browser-error suppression was added. Build warnings about large chunks remain.

README/documentation validation: 19 Markdown files, 61 local links, no missing targets. Naming audit found former-brand literals only in explicit compatibility readers and tests; current UI, output and configuration names use Lotion.

## 2026-09-10T05:23:03Z — Destination verification and follow-up

In `/Users/huklee/work/lotion`, `npm run check` passed lint, type/build and all 92 unit/integration tests; the browser run passed 64/66. Two existing slash-page test assumptions failed: an unscoped Untitled selector matched multiple pages, and typing began in the code block instead of the intended trailing paragraph. Removed the redundant ambiguous selector (the test still verifies the newly created child's parent ID) and explicitly positioned the caret at the document end for the failed-request test.

Follow-up: `npx playwright test -g 'slash page creates|legacy code pages'` passed all 6 cases in 24.8 seconds across Chromium, Firefox and WebKit. This is a full-run-plus-targeted-retest record, not a claim that the original 66-test invocation exited successfully. The separate 9-case conflict/navigation/recovery browser run passed completely.

The first incremental GitHub push remains blocked by unavailable HTTPS credentials. No commits were pushed; the conflict fix is prepared as an additional local commit with its tests and design rationale.

## 2026-09-10T05:17:23Z — Conflict resolution

`npm test`: 92 tests passed in 10 files. Build/typecheck and ESLint passed. `npx playwright test -g 'two tabs|offline browser draft|pending page A'`: 9 passed in 29.3 seconds across Chromium, Firefox and WebKit. Added assertions for recovered conflict controls, explicit resolution and persistence after another reload. Unit coverage includes independent block merges, overlap/ordering conflicts, legacy checkpoints, archive failure, new mutation IDs and a second server race.

Live target page f63edb5a-4d08-4145-8f55-f41a6bc130df: API 200 and editor rendered; document writes were blocked during the browser smoke check. The server document at revision 47 is valid. Existing user-session browser drafts were not accessed or deleted. Earlier full-suite verification remains separate; this checkpoint is a targeted saving/conflict regression gate.

## 2026-09-10 — Editor follow-up verification (in progress)

Executed `npm test`: 86 unit/integration tests passed, including the full configured syntax palette, Markdown Mermaid round-trip, nested-folder Mermaid import and exact-bundle icon/preview/diagram preservation. ESLint and TypeScript passed after formatting.

The first contrast test correctly failed in all three browsers on a faint HTML token (4.09:1). Fixed the underlying dark-palette mismatch and introduced per-palette-color contrast adjustment. Updated tests measure computed colors for JSON, HTML, Python, Go and C++ in both themes, rather than merely asserting that highlighted text exists.

Full-suite attempts identified two additional test/accessibility issues: decorative tree emoji changed accessible names (fixed using aria-hidden), and shared backend fixtures reused mention titles across browser projects (fixed using unique titles). Interrupted those runs to fix the issues; they are not counted as passing full runs. Final all-browser verification is pending below.

Read-only Chromium smoke test at `http://127.0.0.1:3001/#/page/ccccb650-059e-4141-816b-234dd209ce19` rendered code successfully. Content writes were explicitly blocked during that smoke test. Inspected the captured code screenshot: dark readable body text and red syntax on beige. This does not substitute for a manual native IME/accessibility review.

Documentation validation: 14 Markdown files and 49 local links checked; no missing local targets. Major changes and reasons are in [ADR-011](adr/011-editor-previews-and-diagrams.md).

Record actual execution here. Planned cases live in [test plan](test-plan.md).

## 2026-09-09 — Documentation baseline

Workspace state: initially empty; documentation-only change. No Git revision or application package manifest available.

Executed at: 2026-09-09T03:29:27.226+09:00 (2026-09-08T18:29:27.226Z).

Environment: macOS (`darwin`), Node v25.8.2; existing local runtime used for documentation validation only, not selected as the application runtime.

Command: `node` with an inline read-only JavaScript validator via standard input, run from the workspace root. Validator recursively enumerated `docs/**/*.md`, checked local Markdown link targets with `existsSync`, counted matching triple-backtick fences, parsed every JSON example with `JSON.parse`, checked the nine required root documentation files, and checked test table IDs for duplicates.

Result: PASS, exit 0; tool wall time 1.254 seconds. Checked 12 Markdown files, 36 local links, one JSON example, and 65 distinct test scenarios. Zero errors. No external-link availability check was performed. No artifacts beyond this Markdown report were generated.

Failures and resolutions: none in the executed documentation checks. A manually noticed incorrect BlockNote upload documentation URL was corrected before the run.

Milestone impact: documentation baseline verified; application milestone gates remain open.

Application test status: NOT RUN. No application code, dependency manifest, or executable test harness exists. No claim is made about editor behavior, saving, recovery, browser compatibility, or performance.

That statement describes only the documentation-baseline checkpoint. Current application verification follows.

## 2026-09-09T19:58:16+09:00 — MVP release-candidate verification

Workspace state: implemented application with pinned `package-lock.json`, locally bundled fonts, server, browser client, filesystem repository, Markdown/bundle conversion, and test harnesses.

Environment: Node v25.8.2; macOS Darwin 25.5.0 x64; Apple M1. Playwright 1.63.0 with bundled Chromium, Firefox, and WebKit. Recommended deployment runtime remains Node 24 LTS; CI is configured to verify it but has not run remotely.

Executed `npm run check`: PASS. This ran ESLint, strict TypeScript, the production Vite build, 63 Vitest unit/integration tests across seven files, and 42 Playwright browser workflows across Chromium, Firefox, and WebKit. The final browser matrix completed in approximately 1.2 minutes. The build emitted one non-failing warning: the initial JavaScript chunk is approximately 1.15 MB minified / 345 KB gzip.

Coverage included:

- create/edit/title synchronization, slash commands, themes, search, auto-save/reload, offline draft recovery, concurrent-tab conflicts, and navigation during a delayed save;
- rectangle block selection, whole-section movement and undo, image drop persistence, pending-upload cancellation, sidebar nesting and edge-based sibling reordering;
- trash/restore, revision preconditions, mutation replay, hierarchy invariants, exclusive workspace writer, safe URLs/paths, authenticated assets, and cross-origin/Host rejection;
- injected write/flush/rename/pre-manifest failures, real SIGKILL before and after the commit point, corrupt/newer-schema startup refusal, and a stopped-workspace restore including trash and assets;
- Markdown semantic fixtures, nested quotes/code/tables, recursive folder import, images and internal links, ZIP/exact-bundle restoration, changed-Markdown detection, empty directories, path traversal, ZIP path normalization, and case collisions.

Executed `npm run test:performance`: PASS. With 10,000 synthetic pages and a 500-block active document: tree projection 16.45 ms, 500-block save 75.38 ms, document retrieval 1.60 ms, startup 2545.51 ms, heap 57 MB. Initial 10,000-document import took 43.51 seconds; it is a bulk-ingestion measurement, not an interactive latency budget.

Failures found and fixed during verification: typed request headers, unsafe ZIP stream assumptions, restore re-open race, initial page creation race, modified bundle selectors, selection-toolbar layout shifting the rectangle, quote nesting conversion, pending image cancellation, and cross-browser sidebar edge dragging. Every affected test was rerun, followed by the complete green suite.

Unverified limits: native IME composition was not manually tested; Korean text insertion was automated. Screen-reader and full assistive-technology checks remain manual. Linux, Windows, network shares, synchronized folders, and actual power-loss durability are not qualified by this macOS run. GitHub Actions is configured but has not executed in this workspace. Retention-aware garbage collection is not implemented. Browser folder pickers may omit empty directories; Lotion manifests/ZIP entries preserve them when supplied.
