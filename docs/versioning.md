# Version management guide

Established 2026-09-13 from the user's versioning instructions. Read this guide before changing a version or preparing a release. Current release: **0.10.0**, incremented from **0.9.0**.

## Choose the increment

Use `MAJOR.MINOR.PATCH` and the scope of the complete release, not the number of commits or features.

| Increment | When to use                                                                             | Example           |
| --------- | --------------------------------------------------------------------------------------- | ----------------- |
| Major     | Incompatible behavior/data/API changes, or an explicitly agreed major product milestone | `0.2.0` → `1.0.0` |
| Minor     | Backward-compatible, modest feature additions or interaction improvements               | `0.1.0` → `0.2.0` |
| Patch     | Bug fixes without a new functional feature                                              | `0.2.0` → `0.2.1` |

Do not promote a release to major merely because features were added. The Mermaid paste, Markdown clipboard copy and selected-block Backspace changes are the reference example for a **minor** release. Major/minor increments reset the lower components to zero. Documentation-only follow-ups normally retain the current version. An explicit user version instruction takes precedence.

## Record the release

1. Inspect the current package version, Git history, working tree and latest [changelog](changelog.md). Preserve uncommitted user work and `data/`.
2. Choose one version for the complete release. Keep `package.json`, both root package version entries in `package-lock.json`, and the README current-version line consistent. Do not change dependency versions merely to update the application version.
3. Add a dated changelog entry describing user-visible additions, fixes, compatibility/migration effects and known limits. A version entry must not imply successful tests or a published tag without evidence.
4. Run relevant focused tests and `npm run check` before publishing functional changes. Record exact results and environment in [test results](test-results.md); record decisions/publication in the timestamped [implementation history](implementation-history-log.md). Update [remaining jobs](remained_job.md) only for completed work.
5. Review the diff and tracked files. Exclude user data, raw session history, dependencies and generated test/build artifacts. Commit the release with its version in the subject, for example `feat: release v0.2.0 editor clipboard and selection improvements`.
6. Push when requested or already authorized, then check the GitHub Actions run for that commit. Distinguish a successful local check, a successful push and successful remote CI. Fix failures and repeat the applicable checks before declaring the release verified.
7. A Git tag or GitHub release is a separate publication artifact. Create `vX.Y.Z` on the tested release commit when that workflow is requested/authorized; do not claim a tag exists just because package metadata was updated. Never move or overwrite a published tag to conceal later corrections.

Keep release notes in `docs/changelog.md`; use `docs/implementation-history-log.md` for exact timestamped work history rather than duplicating a second implementation log. Update the handover's current checkpoint so later sessions can find the current version and verification evidence.
