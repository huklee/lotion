# Implementation history log

## 2026-09-19T00:02:11+09:00 — 0.16.0 architecture documentation reconciled

Audited the architecture, roadmap, ADR index and foundational interaction/portability records against the version 0.16.0 implementation. Documentation now names the implemented source modules, flat immutable asset/revision paths, recovery archive files, synchronous import/export routes, authenticated asset retrieval, SSRF-bounded link previews, browser-local ownership boundaries, typed database scope, conservative conflict handling, derived search index, current performance measurements, and retention limitations. Removed obsolete proposed cache/history paths and claims that link previews or remote Linux CI were still pending.

The roadmap now separates successful Ubuntu / Node 24 GitHub Actions coverage from filesystem durability that CI does not establish, records the current 170 unit/integration and 150 browser-case release gate, and summarizes post-MVP capabilities. Missing ADR-012 through ADR-014 index entries were restored; ADR-007, ADR-008, ADR-010 and ADR-011 statuses/evidence now point to the implemented suites. This documentation-only correction retains version 0.16.0 and does not change application behavior, storage, or user data. ESLint, strict TypeScript, Prettier, `git diff --check`, and local-link validation passed; remote CI evidence follows after publication.

## 2026-09-18T06:41:50+09:00 — direct-to-main delivery workflow established

Corrected the repository workflow after feature pull requests were stacked on other feature branches, allowing GitHub to mark intermediate PRs merged without integrating their changes into `main`. The root agent instructions and development/version guides now require one branch created from current `origin/main`, one PR whose base is `main`, successful required checks, an actual merge, and ancestry verification before the next backlog item begins. Documentation-only workflow correction; no application version change.

## 2026-09-18T00:05:09+09:00 — 0.16.0 storage diagnosis and reconciliation prepared

Added an offline workspace doctor because storage corruption can prevent the web application from starting. Its read-only inventory distinguishes committed history from future/unknown orphan snapshots and reports missing files, symlinks, malformed JSON, envelope/schema failures, external semantic changes, missing parents, and hierarchy cycles without logging document bodies. Version-1 manifests now record canonical document hashes after legacy workspaces pass existing validation.

Reconciliation requires a reviewed plan bound to the exact report token. It rechecks state under the writer lock, copies only named valid sources into revisions greater than every known/manifest revision, validates the full resulting hierarchy, archives the old manifest/report/plan, and atomically publishes without deleting or overwriting snapshots. Focused repository/doctor coverage passed 24/24 after regressions exposed and fixed revision-number reuse when a manifest-referenced latest file was missing and required complete integrity maps after legacy migration. [ADR-024](adr/024-storage-diagnostics-and-reconciliation.md) records why automatic candidate selection and orphan deletion remain forbidden. The final CI-equivalent gate passed lint/type/build, 170 unit/integration tests, and 150 browser cases in 171.25 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T23:46:39+09:00 — 0.15.0 typed database row pages prepared

Replaced `/database`'s ordinary table alias with a dedicated validated custom block. One table view supports bounded text, number, select, checkbox, and date properties. Every row is created as a normal child document, opens through application navigation, and derives its visible title/icon from the current tree. The shared database model owns parsing, bounds, typed values, search text, and Markdown formatting; the React block owns only editing and page actions. [ADR-023](adr/023-typed-database-rows.md) records the deliberately excluded view/query/formula scope.

Focused model/schema/Markdown/search/portability coverage passed 47/47 and the create/edit/save/reload/navigate/rename browser flow passed 3/3 across Chromium, Firefox, and WebKit. The new exact-bundle test exposed that internal links inside serialized database props initially bypassed generic URL remapping; the bundle mapper now handles typed row links and the regression passes. The final CI-equivalent gate passed lint/type/build, 164 unit/integration tests, and 150 browser cases in 165.67 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T23:26:07+09:00 — 0.14.0 file and date references prepared

Extended the existing custom mention node instead of introducing emoji/text heuristics. `@date` now inserts an ISO-validated semantic time atom, and `@file` opens an accessible picker that uploads through the established 20 MB content-addressed asset boundary. File activation performs an authenticated fetch before starting a named browser download; cancelling the picker aborts an in-flight request. The picker, download behavior, and reference renderer remain separate from the editor composition root, which stays below the project's automatic 1,000-line refactoring threshold.

[ADR-022](adr/022-file-and-date-references.md) defines persistence, keyboard, navigation, and portability behavior. Exact bundles preserve both types. Portable Markdown emits a bundled standard file link and readable date text, and importing that portable form deliberately yields ordinary link/text nodes. Schema/Markdown/portability coverage passed 34/34, and the complete date/mention group passed 18/18 across Chromium, Firefox, and WebKit. The final CI-equivalent gate passed lint/type/build, 154 unit/integration tests, and 150 browser cases in 149.52 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T07:53:11+09:00 — 0.13.0 typed mentions and bounded preview freshness prepared

Replaced text-shape inference with a validated BlockNote `mention` inline type for page and external references. Raw pasted URLs retain native link semantics and underlined presentation, while mention chips render their icon and label separately. Page-tree updates immediately reconcile internal mention titles/icons. Existing internal links and links with saved preview metadata migrate on open; exact bundles preserve the new type, portable Markdown emits visible links, and search/TOC extraction includes mention labels.

Added optional preview fetch timestamps, stale-on-hover refresh with per-URL client de-duplication, and refreshed external chip labels. The refresh lifecycle is isolated in a dedicated hook instead of expanding the editor component. The backend canonicalizes URLs and keeps only successful results in a process-local 15-minute, 256-entry LRU without bypassing existing concurrency, DNS, redirect, MIME, size, or SSRF controls. [ADR-021](adr/021-reference-chips-and-preview-cache.md) records the boundaries. Focused tests passed 57/57 and the three-browser interaction group passed 9/9. After narrowing an existing image assertion away from ProseMirror's hidden cursor separator, the final CI-equivalent gate passed lint/type/build, 149 unit/integration tests, and 147 browser cases in 173.64 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T07:33:51+09:00 — 0.12.1 IPv4/NAT64 link previews prepared

Replaced single-answer DNS pinning with a filtered set of public answers passed to Node's IPv4/IPv6 family selection. Mixed DNS responses discard non-public candidates instead of rejecting a usable public candidate, while every redirect still performs fresh validation and the socket lookup remains pinned to the approved set. Added explicit decoding for RFC 6052's well-known /96 and RFC 8215's local-use /48 NAT64 forms; their embedded IPv4 destination must satisfy the existing public-address policy, preventing translation to loopback, private, link-local, carrier-grade NAT, documentation, or other special-use ranges.

The focused security suite, strict type checking, and lint passed. A live production-mode server with an isolated temporary workspace fetched the supplied Tistory page, parsed its OpenGraph metadata, cached the remote preview image, and served that local JPEG successfully. The final CI-equivalent gate passed lint/type/build, 140 unit/integration tests, and 144 browser cases in 147.26 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T07:12:23+09:00 — 0.12.0 backend-indexed workspace search prepared

Selected an adapted unified-search approach after the user requested backend indexing and consideration of OpenSearch. Added a replaceable search-index boundary, an in-process index rebuilt from canonical revisions at startup, commit-time revision replacement, hidden-page filtering, a validated search API, and shared extraction for titles, nested rich text, tables, attachment labels, code, and Mermaid source. The browser debounces/cancels requests, merges the active unsaved draft, reports exact counts, opens matching block deep links, and restores editor focus on close.

OpenSearch remains a future adapter rather than a mandatory service because the current single-workspace 10,000-document fixture searches in 14.22 ms and reconstructs on startup in 2.24 seconds. [ADR-020](adr/020-backend-workspace-search.md) records the operational and consistency tradeoff. Focused unit/integration, three-browser navigation, repeated focus, and performance gates passed. The final CI-equivalent gate passed lint/type/build, 134 unit/integration tests, and 144 browser cases in 143.71 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-16T23:03:58+09:00 — 0.11.0 integrated system settings prepared

Prepared the sixth and final requested incremental pull request. Reorganized the existing control panel into system appearance, editor/startup, and formatting sections; added five validated workspace-font choices; and applied the selected font immediately to both application chrome and BlockNote's actual theme root. Font state uses the existing browser-local compatibility reader, persists across reloads, and participates in the combined display reset without entering document storage or exports.

Focused preference tests and nine repeated cross-browser settings cases passed. The first browser test correctly identified BlockNote's internal font-variable boundary, which the final implementation now addresses. The final CI-equivalent gate passed lint/type/build, 128 unit/integration tests, and 138 browser cases in 143.37 seconds. Commit, push, pull-request, and remote CI evidence are recorded separately when complete. User data under `data/` was untouched.

## 2026-09-16T22:50:57+09:00 — 0.10.0 accessible pastel color system prepared

Kept BlockNote's portable `default`, gray, brown, red, orange, yellow, green, blue, purple, and pink keys so existing documents and shortcuts remain valid. Centralized the nine hue pairs for light, dark, and black instead of inheriting different library defaults. The preference lifecycle now applies the palette immediately, and a persistent black scheme uses BlockNote's dark component chrome with a true-black application canvas.

Unit tests calculate WCAG contrast for every text/canvas and default-text/background pair. A browser regression measures computed DOM colors in all three schemes and verifies black persistence. It initially demonstrated that BlockNote's more-specific dark selector defeated the application override; the production selector now matches that specificity. Focused palette repetitions passed 9/9 across three engines, and the full settings group passed 12/12. An unrelated stale-caret assumption exposed by the first full gate was aligned with adjacent explicit selection synchronization and passed 12/12 Chromium repetitions. The final CI-equivalent gate passed lint/type/build, 127 unit/integration tests, and 138 browser cases in 142.39 seconds. Prepared backward-compatible minor release 0.10.0 with no schema migration or user-data change. Publication evidence is recorded separately.

## 2026-09-16T22:41:29+09:00 — 0.9.0 page-aware browser favicon prepared

Added a focused favicon module that generates escaped SVG data URLs for existing page-icon metadata and updates one owned `<link rel="icon">` element. The application derives the favicon from the save coordinator's live content, so an icon-picker change appears immediately, while route changes follow the newly active document. Missing page icons use the same `📄` fallback as the editor; non-page routes and the initial HTML use a stable Lotion `L` mark.

Unit tests cover custom/default icons, XML escaping, and the application fallback. A repeated three-browser regression covers immediate edits, page navigation, missing icons, and Home reset. The final CI-equivalent gate passed lint/type/build, 123 unit/integration tests, and 135 browser cases in 140.88 seconds. Prepared backward-compatible minor release 0.9.0 with no schema migration or user-data change. Publication evidence is recorded separately.

## 2026-09-16T22:34:38+09:00 — 0.8.0 precise nested block-lasso hit testing prepared

Found that every `.bn-block-outer` bounding box includes its descendants. The lasso therefore reported the parent as intersecting when a drag touched only a nested child's visible row, and the existing ancestor de-duplication correctly—but undesirably—removed the child. Selection hit testing now measures the direct block content row instead. The parent remains selected, with its complete subtree overlay and existing group actions, when the drag crosses the parent's own row.

Added a direct browser regression that selects only a nested child and proves its parent is absent from both selection state and overlays. The broader lasso group passed 27/27 repeated cases across Chromium, Firefox, and WebKit. The final CI-equivalent gate passed lint/type/build, 120 unit/integration tests, and 132 browser cases in 135.97 seconds. Prepared backward-compatible minor release 0.8.0; no stored document format or user data changed. Publication evidence is recorded separately.

## 2026-09-16T22:27:15+09:00 — 0.7.2 Mermaid editor input isolation prepared

Reproduced the reported Mermaid editor failure as an event-ownership defect. Because a custom Mermaid textarea sits inside the editor shell while the ProseMirror cursor remains on its previous block, Ctrl/Command+Enter could toggle a stale checklist and Alt+Shift+Arrow could move a document block instead of remaining local to source editing. Editor-level capture and bubble shortcuts now ignore native form controls; global application save remains handled separately.

Strengthened the existing Mermaid scenario to type source character by character instead of using an atomic field fill. Added a regression that proves checklist state and surrounding block order remain unchanged while editing Mermaid source. The two scenarios passed 18/18 focused repetitions across the three browser engines, including render, error recovery, persistence, and reload. The final CI-equivalent gate passed lint/type/build, 120 unit/integration tests, and 129 browser cases in 135.36 seconds. Prepared patch version 0.7.2; no document schema or user data changed.

## 2026-09-16T22:21:50+09:00 — 0.7.1 checklist paste fix prepared

Replaced block-node insertion for multi-line text pasted into a checklist with one chained editor transaction that inserts each line through the checklist's normal Enter behavior. This preserves the current item's prefix, moves its suffix onto the final pasted checklist line, retains checklist types, avoids the synthetic empty paragraph produced by inserting closed block nodes at an inline selection, and keeps the paste as one editor transaction. Single-line checklist and callout paste behavior is unchanged.

Cleaned `docs/remained_job.md` so it contains only active work, registered the six newly requested tasks in order, and marked only this first item complete. Prepared patch version 0.7.1 under the version guide; the document schema and stored user data are unchanged. The complete two-worker browser suite passed 126/126 cases, all 120 unit/integration tests passed, and focused checklist coverage passed repeatedly in every browser. A flaky ordinary-text Backspace test now asserts its actual one-character-edit contract without assuming where an automated click places the caret. User data under `data/` was untouched.

## 2026-09-16T20:32:57+09:00 — Repository text standardized in English

Translated the remaining Korean documentation, test fixtures and date-command aliases into English. The document-search proposal keeps its original three alternatives and recommendation, while README links now describe it in English. Test data still covers Unicode through emoji without retaining Korean words. The folder-import browser assertion now targets its semantic imported heading instead of waiting on the complete editor container. A tracked-file content and filename audit found no remaining Hangul outside the protected `data/` directory.

This cleanup does not add product behavior, change storage formats or require a version increment; version 0.7.0 remains correct. Lint, strict type checking, 28 focused unit/integration tests and 36 related cross-browser cases passed. Full-gate attempts exposed the already requested checklist newline regression and a separate WebKit test-process stall, both recorded in the test results rather than folded into this translation change. User data under `data/` was untouched.

## 2026-09-16T20:06:30+09:00 — Large TypeScript candidate refactoring completed

Completed the remaining work in the large-file refactoring plan. `App.tsx` fell from 1,847 to 716 lines after extracting workspace presentation, dialogs, preferences, transfer workflows and conflict actions. `Editor.tsx` fell from 1,695 to 799 lines after extracting suggestion, checklist, paste-link and overlay lifecycles. The 2,144-line workspace browser specification was replaced by ten product-area specifications; all 41 original scenarios remain, and the largest resulting specification is 457 lines.

No TypeScript or TSX file now exceeds the automatic 1,000-line threshold. The two remaining 501–1,000-line files are accepted framework composition roots: each retains stateful library coordination while feature behavior lives behind focused props or hook contracts. This reduces shared-file conflicts and makes feature ownership visible without manufacturing pass-through layers. Version 0.7.0 remains correct because application behavior, public APIs and stored data formats are unchanged. User data under `data/` was untouched.

The final `npm run check` passed ESLint, strict TypeScript, the production build, 120/120 unit and integration tests, and 126/126 Playwright cases across Chromium, Firefox and WebKit in 153.39 seconds. A Chromium native modified-click assertion exposed an intermittent Playwright wait on an already-rendered background tab; the navigation specification now tests its actual contract—correct new-tab URL and unchanged opener—and passed 12/12 focused repetitions before the complete gate. The known non-failing production chunk-size warning remains.

## 2026-09-16T07:09:03+09:00 — First TypeScript module-boundary slice completed

Applied the new structure rules to `Editor.tsx` without changing editor behavior or document formats. The 1,695-line component is now 1,223 lines. Block lasso/selection state and browser lifecycles moved to a 286-line hook; direct block-link reveal and measurement moved to a 79-line hook; the shortcut-aware formatting toolbar moved to a 145-line leaf component; and legacy code-language normalization moved to a 48-line pure module. Six direct unit cases now cover normalization without mounting BlockNote. Direct-link browser coverage moved out of the congested workspace specification, and a 24-line shared E2E seed helper provides the seam for subsequent feature splits.

The result improves testability and conflict isolation while keeping the extracted modules in the preferred 0–500-line ranges. `Editor.tsx`, `App.tsx` and `workspace.spec.ts` remain automatic candidates, so they are recorded as incremental follow-ups rather than being mechanically split in this branch. No version increment was made: this is an internal, backward-compatible refactor with no new feature, fix, API or data-format change. User data under `data/` was untouched.

The final `npm run check` passed lint, strict TypeScript and the production build, 120/120 unit and integration tests, and 126/126 browser cases across Chromium, Firefox and WebKit in 141.67 seconds. Focused selection coverage passed 24/24 browser cases before the full run, and the separated direct-link scenario passed 3/3. Build chunk-size warnings remain the previously tracked non-failing issue.

## 2026-09-16T06:54:18+09:00 — TypeScript structure rules established

Created the mandatory pre-refactoring rules in [TypeScript file and module structure rules](typescript-file-structure.md). The baseline measured 10,103 TypeScript/TSX lines and identified only three automatic candidates: the 2,144-line workspace browser specification, 1,847-line application component and 1,695-line editor component. Recent history also concentrates changes in those files. Persistence and Markdown files in the 200–500-line healthy range are explicitly deferred because they already have cohesive responsibilities.

The first implementation slice is constrained to editor selection/direct-link lifecycles and their browser-test boundary. It must improve isolated testing and conflict locality without changing document persistence or user data. This entry records the rules before any production code is moved; verification evidence follows after implementation.

## 2026-09-15T14:20:47Z — 0.7.0 direct block links prepared

Prepared backward-compatible minor release 0.7.0 as the sixth and final requested incremental item. Added a cursor-aware **Copy block link** action that copies an absolute stable-ID URL. Centralized strict page/block hash construction and parsing, retained deep fragments during initial page loading, and allowed internal deep links to use the existing history-aware router. Target blocks are centered and identified by a React-owned fixed overlay that follows scrolling/resizing without mutating BlockNote-owned DOM. Missing targets keep the requested page and URL open without selecting an unrelated fallback. See [ADR-019](adr/019-direct-block-links.md).

Focused URL unit tests, lint/type/build and the three-browser direct-link scenario passed before the full gate. The final `npm run check` passed lint/type/build, 114 unit/integration tests and 126 browser cases in 143.62 seconds. It covers success, fresh navigation, target reveal, clipboard denial and deleted-target behavior. User data under `data/` was untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T14:09:46Z — 0.6.1 hierarchy-preserving deletion prepared

Prepared patch release 0.6.1 as the fifth requested incremental item. Replaced selected-block deletion's direct multi-node editor removal with an immutable tree transform that drops selected subtrees while retaining unselected parents, siblings and descendants at the same depth. The transformed hierarchy is applied in one replace transaction, retains stable IDs, leaves one editable paragraph when everything is deleted, and remains a single undo step.

Focused unit tests, lint/type checks and nine deletion browser cases passed before the full gate. The final `npm run check` passed lint/type/build, 111 unit/integration tests and 123 browser cases in 139.63 seconds. The three-browser regression checks both persisted `children` relationships and rendered indentation after reload. Existing section deletion/undo and rectangle deletion cases passed. User data under `data/` was untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T14:00:35Z — 0.6.0 Notion-style block lasso prepared

Prepared backward-compatible minor release 0.6.0 as the fourth requested incremental item. Block lasso selection now normalizes every drag direction, extends with Shift/Command/Control, auto-scrolls near vertical editor edges, retains off-screen hits, and removes redundant nested hits when an ancestor is selected. A drag kept within one editable block remains native text selection; crossing into another block transitions to lasso selection. Fixed, pointer-transparent viewport overlays replace selection attributes on editor-owned DOM so BlockNote node replacement no longer removes the visible selection. Existing selected-block Backspace and group dragging continue to use stable block IDs. See [ADR-018](adr/018-block-lasso-selection.md).

Focused geometry unit tests and 15 lasso/selection browser cases passed across all three engines. The final `npm run check` passed lint/type/build, 109 unit/integration tests and 120 browser cases in 141.06 seconds. The release changes transient interaction state only, requires no document migration, and leaves user data under `data/` untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T11:21:54Z — 0.5.0 configurable color shortcuts prepared

Prepared backward-compatible minor release 0.5.0 as the third requested incremental item. Extended the control panel with capture fields for every text color and the repeat-last action. Chords use a platform-neutral `Mod` representation, reject unsafe plain typing, validate persisted JSON, clear duplicates when reassigned and default repeat-last to ⌘ShiftH / Ctrl+Shift+H. Replaced only BlockNote's color toolbar control, preserving the rest of its default formatting UI; assigned text-color shortcuts appear on hover/focus. Direct chords and menu choices both update the last-color state, including background colors. See [ADR-017](adr/017-color-shortcuts.md).

Focused shortcut unit tests and the full three-browser interaction regression passed. The final `npm run check` passed lint/type/build, 106 unit/integration tests and 114 browser cases in 126.87 seconds. Applied styles persisted through the normal save/reload path, shortcut preferences remained browser-local, and user data under `data/` was untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T11:09:08Z — 0.4.0 browser-local control panel prepared

Prepared backward-compatible minor release 0.4.0 as the second requested incremental item. Added a single sidebar control panel for theme mode, editor text size, page width and sidebar startup visibility, with immediate root-attribute application, canonical local-storage persistence, stale-value validation and a full reset. Preferences do not enter document data, revisions or exports. The existing appearance-cycle button remains available, and the panel is intentionally ready for the separately requested shortcut configuration without implementing that next item in this commit. See [ADR-016](adr/016-control-panel.md).

The focused unit tests and three-browser control-panel test passed. The final `npm run check` passed lint/type/build, 103 unit/integration tests and 111 browser cases in 129.57 seconds. User data under `data/` remained untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T10:56:21Z — 0.3.1 inline paste and checkbox stability prepared

Prepared patch release 0.3.1. A validated one-line clipboard payload now enters as an inline text node at the exact ProseMirror selection, so an existing checklist or callout retains its ID, type, surrounding text and cursor placement without an added block. Multi-line checklist behavior remains on the typed-block path. Checkbox pointer handling records the intended state and scroll offsets at pointer-down, accepts only the matching low-movement pointer-up, reconciles after the browser's full click/change sequence, and restores editor/window scroll. This removes WebKit event-order double toggles and viewport jumps while retaining Ctrl+Enter/⌘Enter.

Registered the user's six requested tasks in `docs/remained_job.md`; only the first is marked complete. `npm run check` passed lint/type/build, 101 unit/integration tests and 108 browser cases across three engines in 131.96 seconds. User data under `data/` remained untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-14T22:53:10Z — parallel harness published and CI verified

Committed and pushed `48f9c9f` (`test: parallelize isolated browser suite`) to `main`. [GitHub verification 34905987686](https://github.com/huklee/lotion/actions/runs/34905987686) passed the complete Ubuntu / Node 24 gate with two workers. Its `npm run check` step took 151 seconds versus 278 seconds in the preceding comparable success, a 45.7% reduction and 1.84× speedup. This documentation-only follow-up records publication evidence; application version remains 0.3.0 and user data remains untouched.

## 2026-09-14T22:45:47Z — parallel harness complete local gate passed

The final `npm run check` passed in 120.96 seconds: lint, type/production build, 101 unit/integration tests and all 105 Chromium, Firefox and WebKit cases with four workers. Documentation and harness changes are ready to publish; this entry does not claim remote CI success.

## 2026-09-14T22:42:20Z — browser-test workers isolated and parallelized

Replaced the shared fixed-port Playwright server/repository with a worker fixture that starts one server on a dynamic localhost port and one temporary repository per worker, and always closes/removes both during teardown. Enabled full test parallelism, using half of logical CPUs locally and two workers in CI. The stable four-worker run passed all 105 browser cases in 90.79 seconds versus the previous 174-second single-worker gate (47.8% less elapsed time, 1.92× speedup). An eight-worker probe produced Firefox timeouts under resource contention and was not selected. See [ADR-015](adr/015-parallel-browser-test-isolation.md).

This is test infrastructure only: it does not change product behavior, stored data or public interfaces, so the application remains at 0.3.0 under the version guide. User data under `data/` was untouched. Final complete gate and publication evidence follow in later entries.

## 2026-09-14T22:27:44Z — 0.3.0 published and CI verified

Published release commit `dbce105` and Linux-portable test follow-up `5ad6cce` to `main`. [GitHub verification 34903723704](https://github.com/huklee/lotion/actions/runs/34903723704) succeeded on Ubuntu / Node 24, including the complete `npm run check`. This documentation-only follow-up records the remote result; application version remains 0.3.0 and no release tag was created. User data remains ignored and untouched.

## 2026-09-14T22:12:57Z — 0.3.0 complete local gate passed

Final `npm run check` passed lint, type/production build, 101 unit/integration tests and 105 browser tests across Chromium, Firefox, and WebKit. The folder-import pagination regression found during the full gate was corrected in the import completion path and passed the complete rerun. Documentation, version metadata, and application changes are ready for commit/push; this entry does not yet claim remote CI success.

Release commit `dbce105` was pushed to `main`. Initial GitHub run [34903052123](https://github.com/huklee/lotion/actions/runs/34903052123) exposed a platform-specific test assumption rather than lost checklist content: Linux removes an empty suffix created by caret splitting, while macOS retained it. The follow-up test asserts the required checklist types, pasted text, absence of paragraphs, and reload persistence without fixing a meaningless empty-block count. Application version remains 0.3.0 for this test/documentation follow-up.

## 2026-09-14T21:50:33Z — 0.3.0 navigation and editor fixes prepared

Prepared the backward-compatible 0.3.0 minor release. Added persistent browser favorites, native sidebar page links with modified-click behavior, and route-aware browser Back/Forward history. Fixed checklist completion by mouse and Ctrl+Enter/⌘Enter, retained checklist types during validated plain-text paste, removed `&#x20;` output for whitespace-only Markdown blocks, made the next calendar Enter accept today, and disabled misleading browser dictionary underlines in document content.

Focused lint/type/unit checks and six cross-browser checklist/date scenarios passed. The complete local release gate is recorded above; commit, push, and GitHub CI status are recorded separately when complete. User data under `data/` remains untouched and untracked.

The full browser gate exposed a deterministic pagination edge: after shared test data exceeded 100 root pages, WebKit's newly imported folder was valid but hidden behind the sidebar's initial render limit. Import now expands that limit to include all current roots, keeping the new folder visible without removing normal incremental rendering.

## 2026-09-13T14:45:53Z — 0.2.0 published and CI verified

Committed and pushed `cd018bc` (`feat: release v0.2.0 clipboard, calendar and block editing improvements`) to `main`. [GitHub verification](https://github.com/huklee/lotion/actions/runs/34763348532) succeeded on Ubuntu / Node 24 with 100 unit/integration tests and 90 browser tests. Updated release/backlog/handover evidence in this documentation-only follow-up; version stays 0.2.0. No release tag was created. User data remains untracked and untouched.

## 2026-09-13T14:39:13Z — 0.2.0 features and release preparation verified

Prepared minor version 0.2.0 from 0.1.0 at the user's direction. Added persistent versioning guidance linked from AGENTS, README and the handover, plus a release changelog. Consolidated Mermaid fenced paste, complete-current-draft Markdown clipboard copy, selected-block Backspace deletion/undo, line-validated plain text pasting, the `@` calendar module, and left-aligned TOC labels. Dates remain portable text; current data formats and user data are preserved.

The initial deletion implementation exposed focus/drag issues; the final handler listens only while a custom selection exists and excludes input fields/outside targets. Rectangle-ending clicks do not clear the selected group. Plain text paste bypasses Markdown paste rules after schema validation. Oversized Mermaid input remains plain text instead of becoming an unsavable diagram.

Created the requested Korean document-search plan with three options: browser find, a current-document panel (recommended), and a workspace-wide search extension. Linked it in README; search implementation awaits choosing an option.

Release verification: `npm run check` passed lint/type/build, 100 unit/integration tests and 90 browser cases across three engines. Earlier focused fixes and failed iterations are recorded in test-results. This checkpoint precedes commit/push and does not claim a remote CI result.

## 2026-09-13T09:13:54Z — Mermaid paste and current-page Markdown copying

Implemented automatic conversion of a complete fenced Mermaid clipboard payload into a diagram using the existing insertion flow. Existing Mermaid source inputs unwrap the same payload and immediately update their diagram. Custom input pastes are handled by their own input, and ordinary clipboard content keeps its existing behavior.

Added **Export → Copy page as Markdown**, using the current save-coordinator draft and the shared Markdown serializer to include the title and entire body, even before auto-save. Success/fidelity feedback follows a successful clipboard write; permission errors preserve retry access. Documented current-page scope and the ZIP alternative for subpages/assets in README and ADR-011. Preserved the pre-existing uncommitted CI regression work and all user data.

Verification: final `npm run check` exited 0, with 98 unit/integration tests and 75 browser tests passing. Actual Chromium clipboard paste/read was verified, alongside event/adapter checks in Firefox and WebKit. No GitHub run or publication is asserted by this checkpoint.

## 2026-09-10T13:55:00Z — Codex memory and history transferred

Copied the two Yestion-specific raw Codex session logs into the local ignored `.codex/yestion-session-history/` directory in Lotion (about 10.3 MB total) without deleting their originals in the global Codex session store. Added root `AGENTS.md` and `docs/codex-handover.md` so future sessions begin with portable project context, current state, workflow, known regressions, paths and documentation references. Raw transcripts remain outside Git; the handover is versioned.

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
