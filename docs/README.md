# Lotion documentation

## Install and run

Use Node.js 24 LTS and npm (minimum Node 22.12). From the repository root:

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3001**. For development, run `npm run dev` and open **http://127.0.0.1:5173**. Documents are saved to the backend's `data/` directory by default. Stop an existing server before starting another on the same port/workspace.

See the [repository README](../README.md) for cloning instructions, the [runbook](running.md) for configuration, and [remaining jobs](remained_job.md) for known gaps.

## Project documentation

Self-hosted, web-based, block-oriented document editing without AI.

All project plans, design records, implementation notes, test plans, and test reports live in this `docs/` directory as Markdown. Update them alongside the relevant implementation.

## Reading order

- [Version history](changelog.md): features, fixes and compatibility for each version.
- [Version management guide](versioning.md): version increments, release documentation and verification.
- [In-document search plan](document-search-plan.md): three approaches and a recommendation.

1. [Architecture](architecture.md): scope, stack, boundaries, data, APIs, persistence, portability, and deployment.
2. [Roadmap](roadmap.md): milestones, tasks, dependencies, and completion gates.
3. [Test plan](test-plan.md): scenarios, execution requirements, fixtures, and release criteria.
4. [Development workflow](development-workflow.md): issue tracking, definition of done, documentation, and templates.
5. [Decision log](decisions.md): architecture decisions and revisit conditions.
6. [Implementation history log](implementation-history-log.md): timestamped work, progress, outstanding tasks, and deviations.
7. [Test results](test-results.md): executed checks and explicit limitations.
8. [Interaction decisions](adr/007-editor-interactions.md): image drop, block selection, and section movement.
9. [Folder portability decisions](adr/008-folder-portability.md): complete folder intake and hierarchical export.
10. [Decision ownership](adr/009-decision-ownership.md): engineering autonomy and rationale tracking.
11. [Implementation foundations](adr/010-implementation-foundations.md): concrete storage and runtime decisions.
12. [Run and verify the application](running.md): startup, configuration, tests, import/export, and recovery.
13. [Editor previews and diagrams](adr/011-editor-previews-and-diagrams.md): mention navigation, OpenGraph security, code contrast and Mermaid.
14. [Parallel browser-test isolation](adr/015-parallel-browser-test-isolation.md): per-worker servers/repositories, worker policy, cleanup and benchmark evidence.
15. [Browser-local control panel](adr/016-control-panel.md): validated display preferences, persistence boundaries and reset behavior.
16. [Configurable color shortcuts](adr/017-color-shortcuts.md): portable key chords, toolbar hints and last-color reapplication.
17. [Notion-style block lasso selection](adr/018-block-lasso-selection.md): native text drag preservation, additive/reverse selection, edge scrolling and stable overlays.
18. [Stable direct block links](adr/019-direct-block-links.md): copyable absolute URLs, deep-link routing, target reveal and deleted-target behavior.
19. [Backend-indexed workspace search](adr/020-backend-workspace-search.md): derived-index consistency, OpenSearch boundary and measured local default.
20. [Typed mention chips and preview freshness](adr/021-reference-chips-and-preview-cache.md): reference semantics, legacy migration and bounded OpenGraph caching.
21. [TypeScript file and module structure rules](typescript-file-structure.md): SRP boundaries, size limits, dependency direction, extraction gates and the measured refactoring baseline.
22. [Large-file refactoring plan](typescript-refactoring-plan.md): scoped sequence, acceptance criteria and verification for completing the automatic candidates.

## Current status

- Documentation baseline established on 2026-09-09.
- Application code, a pinned dependency manifest, and executable test harnesses now exist; verification is in progress.
- The self-hosted MVP is implemented and passes the recorded local automated test suite.
- See the timestamped implementation log and test results for actual execution. Documentation checks alone are not evidence that product behavior works.

## Project-wide requirements

- Include test planning in every milestone and run the applicable tests during implementation.
- Fix failures and rerun affected checks before declaring the milestone complete.
- Record the exact checks, results, environment, and remaining limitations in Markdown.
- Keep plans and technical documentation in `docs/`; keep executable application/test code in the appropriate source directories.
- Never mark an unexecuted test as passed or silently replace a failed test with a weaker assertion.
