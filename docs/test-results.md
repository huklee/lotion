# Test results

## 2026-09-19T00:02:11+09:00 — architecture documentation reconciliation

Documentation was compared with the implemented Fastify routes, repository filesystem mapping, reconciliation archive names, browser/local ownership boundaries, current ADR set, GitHub workflow, and the latest release evidence. `npm run lint` and `npm run typecheck` exited **0**. Prettier passed for every changed Markdown file, `git diff --check` passed, and a read-only documentation validator checked **37 Markdown files and 178 local links with zero missing targets**. No production code, package version, schema, or user data changed. The complete Ubuntu gate will run on the pull request before merge.

## 2026-09-18T00:05:09+09:00 — 0.16.0 storage diagnosis focused verification

Strict TypeScript, ESLint, and the repository/doctor integration group passed. The focused group passed **24/24** cases, including read-only detection of missing, malformed, orphaned, externally edited, and cyclic snapshots; exact candidate reporting; complete legacy manifest-hash migration; partial integrity-map rejection; explicit detach recovery; recovery metadata; monotonic new revisions; clean restart; stale-plan rejection; and rejection of a drop that would orphan a child without deleting its snapshot. The first recovery assertion found that a missing latest file could cause its manifest revision number to be reused; target numbering now includes both inventory and manifest state, and the corrected regression passes.

The final `CI=1 npm run check` exited **0** in **171.25 seconds**: lint, strict TypeScript, the production build, **170/170 unit and integration tests**, and **150/150 Playwright cases** passed with two workers. Prettier and `git diff --check` passed; documentation validation found **36 Markdown files, 167 local links, and zero missing targets**. The production build retained the known non-failing large-chunk warning. No command accessed or changed user data under `data/`.

## 2026-09-17T23:46:39+09:00 — 0.15.0 typed database focused verification

The database model, document schema, Markdown, search, and portability group passed **47/47** cases. Coverage includes every supported property type, invalid select/date/number/checkbox values, column/row bounds, searchable output, static-table Markdown warnings, exact custom-block preservation, and internal row-page ID remapping.

The complete database row workflow passed **3/3** across Chromium, Firefox, and WebKit. It creates a database through the slash menu, creates a real child-page row, edits all five default typed values, renames/adds a property, saves and reloads, opens the child page, renames it, uses browser history to return, and observes the current row title. The first Chromium assertion incorrectly expected an input value in element `textContent`; the corrected accessible-name/value assertion passed. A focused exact-bundle test then found and drove the serialized row-link remapping fix.

The final `CI=1 npm run check` exited **0** in **165.67 seconds**: lint, strict TypeScript, the production build, **164/164 unit and integration tests**, and **150/150 Playwright cases** passed with two workers. Prettier and `git diff --check` passed; documentation validation found **35 Markdown files, 157 local links, and zero missing targets**. The production build retained the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-17T23:26:07+09:00 — 0.14.0 file/date reference focused verification

Strict TypeScript and a production build passed. The document-schema, Markdown, and portability group passed **34/34** cases, including canonical file URLs, real ISO calendar dates, invalid kind-specific values, exact-snapshot reference preservation, portable file-asset remapping, and readable date degradation.

The complete calendar and mention group passed **18/18** across Chromium, Firefox, and WebKit. It covers keyboard selection and acceptance, semantic date values, adjacent typing after leaving a date atom, cancellation without insertion, arbitrary-file upload, named download, persistence, reload, existing page/external navigation, raw-link presentation, and stale preview refresh. The first Chromium run used an older production bundle because focused type checking did not rebuild `dist`; rebuilding exposed no product failure. One existing cancellation step then needed ArrowRight to leave the new atomic date node before adjacent input, which now explicitly verifies the intended keyboard boundary.

The final `CI=1 npm run check` exited **0** in **149.52 seconds**: lint, strict TypeScript, the production build, **154/154 unit and integration tests**, and **150/150 Playwright cases** passed with two workers. Prettier passed for every changed file, `git diff --check` passed, and documentation validation found **34 Markdown files, 148 local links, and zero missing targets**. The production build retained the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-17T07:53:11+09:00 — 0.13.0 typed mentions and preview-cache focused verification

The focused schema, legacy normalization, Markdown, search, link-network, and preview-service suites passed **57/57** cases. Coverage includes valid and invalid mention shapes, unsafe URLs and bounds, legacy page/external migration without changing raw links, portable Markdown output, mention search text, cache hits/expiry/LRU eviction, optional-image failure, public-address filtering, and OpenGraph parsing. Strict TypeScript, ESLint, and the production build passed.

The three mention scenarios passed **9/9** across Chromium, Firefox, and WebKit. They verify page and external chip insertion, immediate current-page icon updates, later target title/icon reconciliation, external persistence and hover cards, raw URL semantics and underlined presentation, stale metadata refresh de-duplication, refreshed chip/card content, save, and reload. The first Chromium run exposed the missing server validation branch for the new inline type; bounded `mention` validation and direct negative cases fixed the rejected save.

The first full gate passed all 149 unit/integration cases and 145/147 browser cases. The two failures were strict-locator errors in the existing folder-import test: custom atom support makes ProseMirror add a hidden cursor-separator image, so `.tiptap img` matched both that internal node and the correctly rendered imported image. The assertion now targets the imported image's accessible `diagram` name and passed **3/3** across browser engines. After extracting the preview-refresh lifecycle from the editor, the final `CI=1 npm run check` exited **0** in **173.64 seconds** with **149/149 unit and integration tests** and **147/147 Playwright cases**. Prettier passed for every changed file, `git diff --check` passed, and documentation validation found **33 Markdown files, 140 local links, and zero missing targets**. The production build retained the known non-failing large-chunk warning; user `data/` was untouched.

## 2026-09-17T07:33:51+09:00 — 0.12.1 link-preview network verification

The focused link-preview suite passed **27/27** cases. It covers public and non-public IPv4/IPv6 addresses, IPv4-mapped IPv6, RFC 6052 well-known NAT64, RFC 8215 local-use NAT64, mixed DNS candidate filtering, URL restrictions, pre-connection private-address rejection, and inert OpenGraph parsing. Strict TypeScript and ESLint also passed.

A production-mode Lotion server used an isolated temporary workspace for the supplied `https://techblog-history-younghunjo1.tistory.com/207#google_vignette` flow. `POST /api/link-preview` returned HTTP 200 with the live OpenGraph title and a 400-character description, fetched the remote image, stored it as a content-addressed local asset, and served the resulting 53,479-byte JPEG with HTTP 200. The temporary workspace was deleted after verification; user `data/` was untouched.

The final CI-equivalent `CI=1 npm run check` exited **0** in **147.26 seconds**: lint, strict TypeScript, production build, **140/140 unit and integration tests**, and **144/144 Playwright cases** passed with two workers. The production build retained the known non-failing large-chunk warning.

## 2026-09-17T07:12:23+09:00 — 0.12.0 backend workspace-search focused verification

Search extraction, repository, and API coverage passed **27/27** focused unit/integration cases. It verifies formatted-text boundaries, Unicode normalization, tables, Mermaid source, revision replacement, title ranking, filtering, result limits, restart reconstruction, trash/restore visibility, adapter-failure isolation, API validation, and `no-store` responses.

The workspace-search navigation scenario passed across Chromium, Firefox, and WebKit for active unsaved draft merging, saved backend results, counts, source labels, and exact block deep links. Focus restoration initially exposed that HTML `autoFocus` runs before the modal effect can capture the prior editor; capturing focus at the open action and restoring it on the next frame passed **9/9** repeated cases across all three engines.

The 10,000-document performance qualification passed on macOS arm64, Node 25.8.2, Apple M1: import 46,036.09 ms, tree projection 7.06 ms, workspace search **14.22 ms** (100 ms budget), 500-block save 61.04 ms, open 1.26 ms, startup with index reconstruction **2,235.36 ms** (15,000 ms budget), and 73 MB heap.

The final CI-equivalent `CI=1 npm run check` exited **0** in **143.71 seconds**: lint, strict TypeScript, production build, **134/134 unit and integration tests**, and **144/144 Playwright cases** passed with two workers. The production build retained the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-16T23:03:58+09:00 — 0.11.0 integrated-settings focused verification

The preference unit group passed **3/3** cases, including supported font restoration and fallback from an unsupported stored font. The integrated display-settings scenario passed **9/9** repeated cases across Chromium, Firefox, and WebKit. It verifies immediate scheme, font, text-size and page-width preview; startup-sidebar behavior; reload persistence; and the combined reset.

The first browser run exposed that BlockNote's own `.bn-root` font variable overrode the workspace font. Connecting the preference to that actual theme root fixed the document surface while retaining the shared application font variable. A production build and strict TypeScript check passed before the repeated browser run.

The final CI-equivalent `CI=1 npm run check` exited **0** in **143.37 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): lint, strict TypeScript, production build, **128/128 unit and integration tests**, and **138/138 Playwright cases** passed with two workers. The production build retained the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-16T22:50:57+09:00 — 0.10.0 pastel color-system focused verification

The centralized palette's unit coverage passed for all 54 contrast combinations: nine text and nine background choices in light, dark, and black. Each combination meets a 4.5:1 minimum. The related preference and shortcut unit group passed **9/9** cases.

The first browser contrast run exposed that BlockNote's dark-theme selector was more specific than the application override, leaving the library's lower-contrast colors active. Matching the selector specificity made the centralized palette authoritative. The resulting repeated palette scenario passed **9/9** cases across Chromium, Firefox, and WebKit; the complete settings group passed **12/12**, including black-scheme persistence, legacy preference recovery, reset behavior, and color shortcuts.

The first full gate passed 137/138 browser cases but exposed an unrelated test-only caret synchronization race in the existing checklist-paste scenario. Dispatching the same explicit `selectionchange` already used by adjacent exact-caret cases removed the stale ProseMirror offset; Chromium then passed **12/12** parallel repetitions. The final CI-equivalent `CI=1 npm run check` exited **0** in **142.39 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): lint, strict TypeScript, production build, **127/127 unit and integration tests**, and **138/138 Playwright cases** passed with two workers. The production build retained the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-16T22:41:29+09:00 — 0.9.0 page-favicon focused verification

Three direct unit cases passed for custom and missing page icons, hostile stored text escaping, and the stable Lotion application fallback. The browser regression passed **9/9** repeated cases across Chromium, Firefox, and WebKit. It verifies the initial page fallback, immediate icon edits, navigation to a different page without an icon, and reset to the application favicon on Home.

Lint, strict TypeScript, and a production build passed before the focused browser run. The initial browser run correctly reached and verified every favicon state but used a nonexistent Home heading in its final readiness assertion; the assertion now targets the actual level-one Home heading.

The final CI-equivalent `CI=1 npm run check` exited **0** in **140.88 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): lint, strict TypeScript, production build, **123/123 unit and integration tests**, and **135/135 Playwright cases** passed with two workers. The production build retained the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-16T22:34:38+09:00 — 0.8.0 nested block-lasso focused verification

The new regression first reproduced the defect: dragging only across a nested child's row selected its parent because the parent's outer rectangle included the complete descendant subtree. Hit testing now uses each block's own content row while selection overlays retain subtree bounds for parent selection.

After the fix, the complete focused lasso group passed **27/27** cases across Chromium, Firefox, and WebKit (three repetitions per scenario and engine). It covers native within-block text dragging, forward and reverse lasso, modifier-assisted extension, independent nested-child selection, edge auto-scroll, and retained off-screen hits.

The final CI-equivalent `CI=1 npm run check` exited **0** in **135.97 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): lint, strict TypeScript, production build, **120/120 unit and integration tests**, and **132/132 Playwright cases** passed with two workers. The production build retained the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-16T22:27:15+09:00 — 0.7.2 Mermaid keyboard-isolation verification

The new regression first reproduced the defect in Chromium: Ctrl/Command+Enter inside the Mermaid source field toggled the previously focused checklist because the editor-level capture handler used a stale document cursor. After form controls were excluded from editor capture and bubble shortcuts, character-by-character Mermaid editing, invalid-source recovery, rendering, checklist isolation, block-order stability, save, and reload passed **18/18** focused cases across Chromium, Firefox, and WebKit (three repetitions per scenario and engine).

The final CI-equivalent `CI=1 npm run check` exited **0** in **135.36 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): lint, strict TypeScript, production build, **120/120 unit and integration tests**, and **129/129 Playwright cases** passed with two workers. The production build retained the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-16T22:21:50+09:00 — 0.7.1 checklist paste gate passed

Lint, strict TypeScript, and the production build passed; 120/120 unit and integration tests passed. The complete two-worker Playwright suite passed **126/126** cases across Chromium, Firefox, and WebKit in **111.01 seconds**. The repaired mid-line multi-line checklist paste case also passed 9/9 focused repetitions across the three engines. It verifies exact prefix/first-line and last-line/suffix joining, no paragraph conversion, save, and reload.

The first four-worker run passed 125/126 cases but reproduced the known WebKit folder-import process stall after the imported content rendered. The CI-equivalent two-worker run passed that case. A later gate exposed an unrelated test-only caret assumption in the ordinary-text Backspace assertion; the assertion now verifies its actual contract—one character is removed while the block remains—and passed 8/8 Chromium repetitions. The complete WebKit project then passed 42/42 cases. The production build retains the known non-failing large-chunk warning. User data under `data/` was untouched.

## 2026-09-16T20:32:57+09:00 — Repository English-language cleanup verified

All tracked content and filenames outside the protected `data/` directory were scanned for Hangul characters; none remain. Prettier, `npm run lint`, `npm run typecheck`, 28 focused Markdown/repository tests and 36 related browser cases passed. The browser cases covered calendar suggestions, mentions, imports/exports and saving across Chromium, Firefox and WebKit.

The complete gate built successfully and passed 120/120 unit and integration tests. Its four-worker browser phase passed 125/126 cases; the remaining WebKit folder-import worker stopped responding to Playwright after the imported heading and image had rendered. A two-worker rerun passed that import case and 125/126 cases overall, but reproduced the existing Chromium checklist-paste regression: a paragraph was created after multi-line text was pasted into a checklist. That product failure is the first item in the next requested bug-fix sequence and is intentionally not hidden inside this language-only change. User data under `data/` was untouched.

## 2026-09-16T20:06:30+09:00 — Complete large-file refactoring gate passed

`npm run check` exited **0** in **153.39 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1). ESLint, strict TypeScript and the production Vite build passed; **120/120 unit and integration tests** passed in 18 files; and **126/126 Playwright cases** passed across Chromium, Firefox and WebKit with four workers. The production build retained the known non-failing large-chunk warning.

Before the final gate, the Chromium modified-click scenario passed **12/12** parallel repetitions after its assertion was scoped to the feature contract: the native link opens the requested page URL in another tab while the source tab stays on its current document. The prior locator-value assertion intermittently waited for a Chromium background-tab navigation signal even when the trace and screenshot showed the target document rendered; it was not an application failure. The split preserves all 41 former workspace scenario titles exactly once, and the complete suite still contains 42 scenarios across 11 feature specifications. `git diff --check` and Markdown formatting passed; local-link validation found **32 Markdown files, 124 local links and zero missing targets**. No test or command accessed tracked user data under `data/`.

## 2026-09-16T07:09:03+09:00 — TypeScript module-boundary refactor gate passed

`npm run check` exited **0** in **141.67 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1). ESLint, strict TypeScript and the production Vite build passed; **120/120 unit and integration tests** passed in 18 files; and **126/126 Playwright cases** passed across Chromium, Firefox and WebKit with four workers. The production build retained the known non-failing large-chunk warning.

New direct unit coverage verifies HTML, C++, Go, Python and JSON fallback inference plus nested supported/legacy code blocks. Before the complete gate, 24/24 focused cross-browser selection cases passed for section movement, selected deletion and undo, indentation preservation, lasso direction/addition/auto-scroll, rectangle deletion and selected-group drag. The newly separated direct-block-link specification passed 3/3 across the browser matrix. `git diff --check` and Prettier passed; documentation validation found **31 Markdown files, 118 local links and zero missing targets**. No test or command accessed tracked user data under `data/`.

## 2026-09-16 — TypeScript structure-rule documentation validation

The initial refactoring baseline used `rg --files` with `wc -l` across `apps/`, `packages/` and `tests/`, plus a 30-day Git filename-frequency count. It found 10,103 TypeScript/TSX lines and the three files over the automatic 1,000-line threshold recorded in the structure guide. No production code moved in this documentation checkpoint. Prettier passed for the changed Markdown, and the repository documentation validator found **31 Markdown files, 116 local links and zero missing targets**. Application verification follows the implementation slice.

## 2026-09-15T14:20:47Z — 0.7.0 direct-block-link gate passed

The final `npm run check` exited **0** in **143.62 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **114/114 unit and integration tests**, and **126/126 browser tests** passed across Chromium, Firefox and WebKit with four workers. New unit coverage verifies canonical page/block hash parsing, malformed identifier rejection and absolute same-application URL creation. The new three-browser regression copies the current cursor block's URL, opens it as a fresh navigation, verifies that the fragment survives initial routing, confirms centered target visibility and highlighting, surfaces denied clipboard writes, and proves that a missing/deleted block leaves its page usable without a false highlight. Large build-chunk warnings remain non-fatal. GitHub CI is pending the release push at this checkpoint.

## 2026-09-15T14:09:46Z — 0.6.1 hierarchy-preserving deletion gate passed

The final `npm run check` exited **0** in **139.63 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **111/111 unit and integration tests**, and **123/123 browser tests** passed across Chromium, Firefox and WebKit with four workers. New unit cases prove that deleting a nested block retains following siblings and grandchildren at their original tree depth, that unknown selections preserve object identity, and that selecting a parent removes its complete subtree. The new three-browser regression verifies the saved hierarchy and rendered horizontal indentation after reload; existing section deletion, undo and rectangle deletion regressions also passed. Large build-chunk warnings remain non-fatal. [GitHub CI run 34980141786](https://github.com/huklee/lotion/actions/runs/34980141786) subsequently passed the complete Ubuntu / Node 24 gate for release commit `090baf0`.

## 2026-09-15T14:00:35Z — 0.6.0 block-lasso gate passed

The final `npm run check` exited **0** in **141.06 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **109/109 unit and integration tests**, and **120/120 browser tests** passed across Chromium, Firefox and WebKit with four workers. New unit coverage verifies rectangle normalization, edge-touch intersection and stable selection comparison. New three-browser regressions verify within-block native text dragging, reverse lasso, Shift extension, edge auto-scroll and retention of off-screen hits; existing rectangle Backspace and selected-group drag regressions also passed. Large build-chunk warnings remain non-fatal. [GitHub CI run 34979252469](https://github.com/huklee/lotion/actions/runs/34979252469) subsequently passed the complete Ubuntu / Node 24 gate for release commit `e45d7c8`.

## 2026-09-15T11:21:54Z — 0.5.0 configurable color-shortcut gate passed

The final `npm run check` exited **0** in **126.87 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **106/106 unit and integration tests**, and **114/114 browser tests** passed across Chromium, Firefox and WebKit with four workers. Unit coverage verifies portable shortcut normalization/matching, malformed-setting fallback and duplicate reassignment. The new browser regression records and persists a custom red-text chord, applies it to a selection, reveals its toolbar hint on hover, chooses blue through the toolbar, reapplies blue with the default repeat chord, then proves that a subsequently chosen yellow background becomes the repeat target; all styles survive save/reload. Large build-chunk warnings remain non-fatal. [GitHub CI run 34977521325](https://github.com/huklee/lotion/actions/runs/34977521325) subsequently passed the complete Ubuntu / Node 24 gate for release commit `4f62db2`.

## 2026-09-15T11:09:08Z — 0.4.0 control panel gate passed

The final `npm run check` exited **0** in **129.57 seconds** on macOS arm64 (Node 25.8.2, npm 11.11.1): ESLint, TypeScript/production build, **103/103 unit and integration tests**, and **111/111 browser tests** passed across Chromium, Firefox and WebKit with four workers. New unit coverage verifies supported, invalid and boolean preference values. The three-browser regression verifies immediate theme/text-size/page-width application, computed CSS, persistence after reload, sidebar startup visibility and complete reset behavior. Large build-chunk warnings remain non-fatal. [GitHub CI run 34961824186](https://github.com/huklee/lotion/actions/runs/34961824186) subsequently passed the complete Ubuntu / Node 24 gate for release commit `0751d6c`.

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
