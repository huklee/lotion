# Remaining jobs

Recorded: **2026-09-10T05:32:53Z**. Audited application revision: `8423b85` in `/Users/huklee/work/lotion`.

This checklist records unfinished requirements, failed verification, and remaining qualification work. Unchecked items are not complete. Fixes below have not been implemented as part of this audit.

## Current evidence

- Latest local `npm run check`: lint, type/build and **92 unit/integration tests passed**; **64/66 browser tests passed**.
- Latest GitHub Actions run: **62/66 browser tests passed**, workflow failed. [Run 34441029972](https://github.com/huklee/lotion/actions/runs/34441029972).
- Local failures: paste chooser scroll tracking in WebKit; `ResizeObserver loop completed with undelivered notifications` during the WebKit legacy-code/failed-subpage test.
- CI failures: paste chooser scroll tracking in Chromium, Firefox and WebKit, plus the same WebKit ResizeObserver error.
- A live metadata fetch for `https://techblog-history-younghunjo1.tistory.com/207#google_vignette` failed with `Private network previews are not allowed`. DNS returned both a public IPv4 address and an IPv6 address classified as `rfc6052` (NAT64). The current guard rejects the entire answer set. This does not establish that the target website itself is private.
- Both previously reported document API URLs returned HTTP 200. The user's existing browser-session conflict draft has not been inspected or confirmed resolved.
- All five implementation commits and the publication-log commit were pushed individually and verified. `main` matched `origin/main` at the audit. GitHub authentication is resolved; earlier authentication-blocker notes are historical.

## P0 — Regressions and release verification

### 1. Paste chooser positioning while scrolling

- [ ] Reproduce why the chooser's Y coordinate does not change in the failing scroll test.
- [ ] Distinguish application positioning defects from test assumptions: verify that the intended scroll container actually moved and measure the chooser against the caret block, including viewport clamping.
- [ ] Fix any actual positioning defect and make the regression assert the intended behavior without weakening it to mere visibility.
- [ ] Verify URL insertion, cancellation, delayed preview completion and scrolling in Chromium, Firefox and WebKit.

Relevant files: `apps/web/Editor.tsx`, `tests/e2e/workspace.spec.ts`.

Done when: the chooser follows the insertion block correctly and the regression passes locally and on Linux CI in every browser.

### 2. WebKit ResizeObserver error

- [ ] Trace the observer/layout cycle reported by the legacy-code and failed-`/page` test.
- [ ] Fix the cause, or establish with evidence whether a dependency/browser notification requires narrowly scoped handling. Do not globally suppress browser errors to make the test pass.
- [ ] Verify code rendering, failed subpage creation recovery and continued typing without the reported error.

Done when: the failing scenario passes repeatedly and the complete browser suite passes without blanket error suppression.

### 3. Restore a complete green verification gate

- [ ] Run `npm run check` after the fixes: lint, type/build, all unit/integration tests and the complete three-browser suite.
- [ ] Confirm a successful GitHub Actions run for the resulting application commit.
- [ ] Record exact commands, results, environment and timestamps in `docs/test-results.md` and `docs/implementation-history-log.md`.

Done when: one full local invocation and the corresponding CI workflow pass. Separate targeted retests alone do not satisfy this gate.

## P1 — Unfinished user-requested behavior

### 4. Real external metadata fetching, including the supplied Tistory URL

- [ ] Support legitimate public destinations in the observed IPv4/NAT64 environment without allowing private/internal addresses through the SSRF guard.
- [ ] Specify validated address selection and redirect behavior; preserve DNS pinning, deadlines, size limits and MIME validation.
- [ ] Test translated addresses with public and private embedded IPv4 destinations, mixed DNS answers and redirect targets.
- [ ] Verify the supplied URL's actual OpenGraph title and image through the application flow. Existing mocked browser metadata does not prove this live path works.
- [ ] Preserve a usable link and a clear fallback when a website denies access or has no metadata.

Relevant file: `apps/server/link-preview.ts`.

Done when: the supplied URL works in the user's environment, with security regressions passing and no need to disable destination validation.

### 5. Refresh all link-chip titles and keep icons consistent

- [ ] Extend page-open refresh beyond internal workspace titles/icons to external OpenGraph chips, using bounded refresh/caching and retaining existing metadata on failure.
- [ ] Ensure pasted internal-page mentions receive their page icon immediately.
- [ ] Ensure failed external metadata lookups still insert the requested default document icon; the current hostname fallback omits it.
- [ ] Verify whether raw URL links and mention chips need distinct presentation; the current implementation styles ordinary inline links as chips too.

Relevant files: `apps/web/Editor.tsx`, `apps/web/styles.css`.

Done when: newly inserted and reopened chips consistently show the appropriate title/icon, and plain URL versus mention behavior is explicit and tested.

### 6. File and date mentions

- [ ] Implement file and date references in the mention picker described in the original request. Current `@` and `[[` search only workspace pages.
- [ ] Define persistence, navigation/display, keyboard selection and import/export behavior for these additional mention types.
- [ ] Add representative tests and document any differences between the page-link shortcut and general mention search.

Done when: page, file and date references have implemented and tested behavior rather than page-only search.

### 7. Database insertion beyond a basic table

- [ ] Close the gap between the requested Notion-like database insertion and the current `/database`, which inserts a simple editable Name/Status table.
- [ ] Define the intended database feature boundary in an ADR, including typed properties and row/page behavior. Document whether views, sorting/filtering, relations and formulas are included or deferred.
- [ ] Implement and test the selected database behavior, including persistence and export/import.

Done when: the database scope is explicit and its implemented behavior matches that scope; a plain table must not be presented as full Notion database functionality.

### 8. Filesystem validity and tree reconciliation

- [ ] Add a diagnostic/reconciliation workflow for missing, invalid or orphaned document files and invalid hierarchy links.
- [ ] Decide safe recovery/quarantine behavior and preserve recoverable data before applying repairs.
- [ ] Clarify how externally changed files are detected. Current sidebar refresh reads the server's in-memory tree; startup validates committed files and refuses corruption, but does not repair it.
- [ ] Test missing files, malformed JSON, invalid parents, cycles and stale projections with isolated fixtures.

Done when: the user's “refresh valid files, otherwise sort it out” request has a tested recovery workflow beyond refreshing the existing projection.

### 9. Confirm resolution of the reported browser conflict

- [ ] Verify the existing user-session draft for page `f63edb5a-4d08-4145-8f55-f41a6bc130df` using the new resolution UI.
- [ ] If changes overlap, obtain the user's version choice rather than silently selecting one.
- [ ] Confirm the resulting page reaches Saved and remains correct after reload, with a recovery copy retained.

The generic recovery/merge/resolution logic is implemented and tested. This item is confirmation of the specific browser draft, not a claim that the server document is corrupt. An isolated automation browser cannot access that original draft.

## P2 — Documentation and acceptance gaps

### 10. Bring design and status documents up to date

- [ ] Update `docs/architecture.md`: it still describes spikes as pending, a Zustand store that is not used, illustrative storage paths that differ from implementation, and older API/scope assumptions.
- [ ] Reconcile architecture, roadmap and ADRs with Mermaid, previews, page icons, database scope and conflict merging.
- [ ] Update roadmap test counts, selection behavior and CI status. Preserve old dated test reports as history but make the current status unambiguous.
- [ ] Keep the single implementation record at `docs/implementation-history-log.md`; record major work with exact timestamps and rationale in decision Markdown files.

Done when: current documentation describes the implemented system and open work accurately, and local documentation links validate.

### 11. Markdown fidelity and whole-folder acceptance

- [ ] Publish an explicit current fidelity matrix for ordinary Markdown versus exact bundles, including callouts, toggles, TOC, icons, previews, Mermaid and future databases/mentions.
- [ ] Verify user-facing warnings and full-folder export/import for these custom features.
- [ ] Avoid promising exact visual restoration from ordinary `.md`: exact bundles retain structured snapshots; portable Markdown loses some custom layout/styling.

Whole-folder/ZIP import/export, hierarchy, assets and exact bundles are implemented and tested. This remaining item closes the gap between that behavior and an unrestricted promise to preserve every layout in plain Markdown.

### 12. Native interaction and platform qualification

- [ ] Perform manual Korean/native IME, keyboard and screen-reader checks; automated text insertion is not native composition testing.
- [ ] Add accessibility scanning and document supported browser/OS combinations.
- [ ] Verify native emoji rendering/search on the user's macOS version. The searchable Unicode catalog exists; exact Apple glyph availability depends on the OS.

Done when: the declared acceptance checks have actual results, with any platform limitations documented.

## P3 — Existing roadmap hardening, not missing core editing features

- [ ] Add revision/receipt/asset retention and garbage collection that accounts for active pages, trash, history and in-progress work.
- [ ] Reduce initial JavaScript payload; the production build still reports large chunks.
- [ ] Qualify filesystem durability and backup/restore on declared deployment platforms. A passing Linux CI run alone does not prove power-loss durability.

## Already implemented — do not restart these tasks

The application includes block editing without AI, automatic saving and browser draft recovery, a page tree and breadcrumbs, image upload/drop, block rectangle selection and movement, keyboard commands and themes, `/page`, live TOC, toggles, callouts, page mentions and same-tab navigation, searchable page icons, beige/high-contrast syntax-highlighted code for JSON/HTML/Python/Go/C++, `/mermaid`, and whole-folder/ZIP import/export. Architecture templates, roadmap, test plans, ADRs and timestamped history files exist under `docs/`.

The remaining tasks above distinguish implemented features from unresolved defects, missing extensions and unverified acceptance. Complete P0 first, then the live-preview and metadata issues, and continue through P1/P2 with focused tests and small, separately verified commit/push units.
