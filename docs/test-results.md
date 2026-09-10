# Test results

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

Unverified limits: native IME composition was not manually tested; Korean text insertion was automated. Screen-reader and full assistive-technology checks remain manual. Linux, Windows, network shares, synchronized folders, and actual power-loss durability are not qualified by this macOS run. GitHub Actions is configured but has not executed in this workspace. Retention-aware garbage collection is not implemented. Browser folder pickers may omit empty directories; Yestion manifests/ZIP entries preserve them when supplied.
