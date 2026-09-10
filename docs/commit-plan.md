# Incremental commit and push plan

The destination repository is `/Users/huklee/work/lotion`, branch `main`, with an empty `origin` at `https://github.com/huklee/lotion.git`.

Each unit is staged and committed independently, then pushed and verified with `git ls-remote` before the next unit. Local runtime data, dependencies, build output, and browser artifacts remain ignored.

1. `feat: add persistence and document service foundation` — package manifests, TypeScript/Vite configuration, filesystem repository, document schema, and Fastify API.
2. `feat: add block editor and workspace interactions` — React application, BlockNote schema/editor, themes, hierarchy, drag/selection, slash commands, pages, TOC, callouts, database, Mermaid, mentions, image handling, and styles.
3. `feat: add markdown bundles and secure link previews` — Markdown conversion, whole-folder ZIP import/export, asset mapping, OpenGraph fetching, SSRF protections, and portable/exact bundle behavior.
4. `test: add browser and persistence verification` — unit/integration/e2e tests, performance checks, browser configuration, and CI workflow.
5. `docs: record architecture and implementation history` — architecture, roadmap, ADRs, runbook, test plan/results, decision log, and this plan.

Before each push: run the smallest relevant test set, then run `npm run check` for the final unit if no failures remain. If a push is rejected, stop and report the exact remote error; do not rewrite history or force-push.
