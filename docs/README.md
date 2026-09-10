# Yestion documentation

Self-hosted, web-based, block-oriented document editing without AI.

All project plans, design records, implementation notes, test plans, and test reports live in this `docs/` directory as Markdown. Update them alongside the relevant implementation.

## Reading order

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
