# Codex project handover

Before making project changes, read [docs/codex-handover.md](docs/codex-handover.md).

Follow [docs/versioning.md](docs/versioning.md) for version increments and release preparation. Record added features and fixes in [docs/changelog.md](docs/changelog.md); ordinary compatible feature additions use a minor increment, not a major increment.

Keep implementation/design/test documentation under `docs/`, use the timestamped [implementation history log](docs/implementation-history-log.md) for major work, and update [remaining jobs](docs/remained_job.md) as items are completed. Preserve user data under `data/`; do not commit it. Run relevant tests and record results in `docs/test-results.md`.

## Required GitHub workflow

Every fix or feature must reach `main` through its own pull request before the next backlog item begins.

1. Fetch `origin/main` and create the work branch directly from current `origin/main`.
2. Keep one fix or feature in the branch. Do not base a new work branch or pull request on another unmerged feature branch.
3. Complete implementation, focused tests, the applicable full gate, version/changelog/history/test-result updates, and the `docs/remained_job.md` checkbox on that branch.
4. Push the branch and open a pull request whose base is `main`. A pull request targeting another feature branch does not count as delivery.
5. Wait for all required GitHub checks to pass, then merge that pull request into `main`. Do not merely leave a ready pull request open when merge is authorized by the task.
6. Fetch the merged `origin/main`, verify the feature commit is an ancestor of it, and only then create the next work branch from that updated `origin/main`.

If a prerequisite is not yet on `main`, merge its own `main`-targeted pull request first. Do not build a stacked pull-request chain as a substitute. Preserve any in-progress work before repairing an incorrect branch base.
