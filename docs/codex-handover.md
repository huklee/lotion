# Codex handover: Yestion to Lotion

Updated: 2026-09-10. This file is the portable project memory for future Codex sessions working in `/Users/huklee/Work/lotion`.

## Project identity

- The project began as **Yestion** in `/Users/huklee/Work/yestion` and was moved into the Git repository `/Users/huklee/Work/lotion`.
- Lotion is the canonical working tree and GitHub repository: `https://github.com/huklee/lotion.git`, branch `main`.
- Do not copy the old tree wholesale over Lotion. Lotion is ahead: it contains the rename, compatibility code, a root README, remaining-work documentation, ADR-013, new migration tests, and Git history.
- The old tree has no Git history. `data/` is user data and must never be committed or replaced by a bulk copy.

## Local Codex history

The original Yestion sessions are retained locally, outside Git, at:

- `.codex/yestion-session-history/rollout-2026-09-09T03-08-50-01a08235-5d65-7880-87d7-83577716cb2e.jsonl`
- `.codex/yestion-session-history/rollout-2026-09-09T03-14-48-01a0823a-d4c2-7ab2-a185-55bc6179b606.jsonl`

They are copied from the global Codex session store, retained read-only as a historical reference, and ignored by Git because they are raw conversation logs. Future Codex sessions do not automatically ingest JSONL logs; use this handover, the project docs, and the Git history as the normal working context.

## Current implementation

- React/TypeScript/Vite frontend, Fastify/Node filesystem backend, BlockNote editor, Zod validation, immutable document revisions/assets, Markdown/ZIP portability, IndexedDB drafts, Vitest and Playwright.
- Core features: block editing, auto-save, document hierarchy/tree/breadcrumbs, block drag/drop and rectangle selection, image drop/upload, Markdown folder import/export, `/page`, `/toc`, `/callout`, `/database` basic table, `/mermaid`, page mentions, link chips, page icons, code highlighting, theme selection, conflict recovery/merge.
- The current public product name is **Lotion**. New configuration uses `LOTION_DATA_DIR` and `LOTION_TOKEN`; legacy `YESTION_*` values remain compatibility fallbacks. Browser settings, drafts, exact bundles, TOC markers and directory MIME types have legacy readers.

## Source of truth and workflow

- Start by reading `README.md`, `docs/remained_job.md`, `docs/test-results.md`, `docs/implementation-history-log.md`, `docs/decisions.md`, and relevant ADRs.
- Keep plans, design decisions, tests and implementation logs in `docs/` Markdown.
- Use `apply_patch` for source edits. Preserve existing user changes and data.
- Commit functional changes in small units, run focused tests first, then broader checks. Push only after the applicable checks and documentation are updated.
- The standard command is `npm run check`; it runs lint, type/build, Vitest and the Playwright suite. It currently has two known WebKit failures listed below.

## Current status and open work

- Git remote was verified at `555d7b4` when this handover was created. Check `git status --branch` and `git log` before working; later commits may exist.
- Latest rename verification: 96 unit/integration tests passed; 67/69 browser tests passed. The full suite still fails on WebKit paste-chooser scroll positioning and a WebKit `ResizeObserver` notification in the failed-subpage/legacy-code scenario.
- The complete backlog and acceptance criteria live in `docs/remained_job.md`. Prioritize P0 verification regressions, then secure live OpenGraph preview support, link-chip refresh semantics, file/date mentions, richer database scope, filesystem reconciliation, and documentation/platform qualification.
- The reported server pages returned HTTP 200. The specific user browser conflict draft cannot be inspected from a separate browser/session; verify it through the UI and retain a recovery copy before choosing a conflicting version.

## Important implementation decisions

- No silent last-write-wins. Conflict resolution uses a conservative three-way merge for independent top-level blocks/fields and requires user choice for overlaps. See ADR-012.
- Mermaid uses a local, strict, non-interactive image preview. Code blocks remain beige with contrast-adjusted syntax colors. See ADR-011.
- Whole-folder import/export and exact bundles are implemented. Portable Markdown intentionally cannot reproduce every custom visual block exactly.
- The active backend binds `127.0.0.1:3001`; restart it after backend changes. Build before browser tests because Playwright serves the production `dist` build.

## Known command paths

- Canonical repository: `/Users/huklee/Work/lotion`
- Legacy source/reference tree: `/Users/huklee/Work/yestion`
- Production local URL: `http://127.0.0.1:3001`
- Browser tests: temporary data and `http://127.0.0.1:3101`
