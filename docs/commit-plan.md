# Incremental commit and push plan

Completed at 2026-09-10T05:25:13Z: all five commits listed below were pushed individually to origin/main and each remote SHA was verified. The earlier authentication blocker is resolved. A final documentation commit records publication completion.

The destination repository is `/Users/huklee/work/lotion`, branch `main`, with `origin` at `https://github.com/huklee/lotion.git`. The remote was empty at the initial audit.

Push one commit hash at a time to main and verify with `git ls-remote` before pushing the next hash. The original four commits were prepared locally after authentication blocked the first push. Local runtime data, dependencies, build output, and browser artifacts remain ignored.

1. `feat: add persistence and document service foundation` — package manifests, TypeScript/Vite configuration, filesystem repository, document schema, and Fastify API.
2. `feat: add block editor and workspace interactions` — React application, BlockNote schema/editor, themes, hierarchy, drag/selection, slash commands, pages, TOC, callouts, database, Mermaid, mentions, image handling, and styles.
3. `test: add browser and persistence verification` — unit/integration/e2e tests, performance checks, browser configuration, and CI workflow.
4. `docs: record architecture and implementation history` — architecture, roadmap, ADRs, runbook, test plan/results, decision log, and this plan.
5. `fix: preserve drafts and resolve revision conflicts` — visible recovered-conflict controls, conservative three-way merge, archived resolution, new conditional mutations, and regressions requested before finishing pushes.

Markdown bundles and secure preview fetching belong to the foundation commit because the server imports them. The foundation is a backend increment; the complete frontend first exists in commit 2. No claim is made that the frontend build succeeds at commit 1.

Before each push: run the smallest relevant test set, then run `npm run check` for the final unit if no failures remain. If a push is rejected, stop and report the exact remote error; do not rewrite history or force-push.
