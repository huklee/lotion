# Complete the large-file refactoring

## Scope and acceptance

Continue PR #1 using the established [module rules](typescript-file-structure.md). Preserve public behavior and stored document formats; keep version 0.7.0. Every application or test file over 1,000 lines must be reduced through meaningful feature boundaries. New modules should normally remain below 500 lines, with explicit typed inputs rather than a generic application-state bag.

## Implementation order

1. Split workspace browser tests by navigation, clipboard, diagrams, settings, saving, portability and block interactions. Retain the isolated worker fixture and shared seed helper; preserve every scenario and assertion.
2. Extract App presentation for dialogs and sidebar, keeping feature-specific props. Separate import/export orchestration from rendering and retain save-before-export and navigation guards.
3. Extract Editor suggestion-menu and checklist interaction lifecycles. Preserve caret restoration, async subpage creation guards and checkbox viewport behavior.
4. Recount all TypeScript files, review dependencies and contracts, and document any remaining 501–1,000-line composition modules with concrete follow-up boundaries.

## Verification

Run lint and strict type checks after each boundary moves. Compare E2E test titles before and after splitting. Run the complete `npm run check` once the final implementation is ready, covering saving/conflicts, routing, settings, paste, menus, selection and portability across three browsers. Record actual results in [test results](test-results.md), update [remaining jobs](remained_job.md), commit and push to the existing PR, and verify GitHub CI. User data under `data/` is excluded.

## Result

Completed on 2026-09-16. All automatic candidates are below 1,000 lines:

- `App.tsx`: 1,847 → 716 lines. It now coordinates page/tree state, save coordinators and feature composition. Sidebar, top bar, dialogs, settings, import/export, active-document rendering, conflict actions, icon picker, home and trash UI have focused owners.
- `Editor.tsx`: 1,695 → 799 lines. It now creates BlockNote and routes editor events. Selection, deep-link reveal, suggestions, checklist interaction, paste-link workflow, formatting toolbar, normalization, preview and transient overlays have focused owners.
- `workspace.spec.ts`: 2,144 lines removed. Its 41 scenarios are preserved across ten product-area specifications; the pre-existing direct-link specification brings the browser suite to 42 scenarios and 126 browser cases. The largest specification is 457 lines.

The remaining 501–1,000-line files are composition roots. Their callbacks join stateful framework APIs, so further movement without a touched feature would add indirection without a new test seam. New feature logic should still be extracted at the point of change. No version increment is required because behavior, APIs and stored formats are unchanged.

Final verification passed `npm run check` in 153.39 seconds: lint, strict type checking, the production build, 120 unit/integration tests and 126 browser cases across Chromium, Firefox and WebKit. The modified-click navigation case also passed 12 focused Chromium repetitions after removing reliance on an intermittent background-tab load signal. User data under `data/` remained untouched.
