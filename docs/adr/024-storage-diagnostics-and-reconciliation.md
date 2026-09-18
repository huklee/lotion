# ADR-024: Safe storage diagnosis and reviewed reconciliation

Status: Implemented.

Recorded: 2026-09-18.

## Context

The repository correctly refused to start when a manifest-referenced snapshot was missing, malformed, or part of an invalid hierarchy, but the error did not identify all affected files or give an operator a safe recovery path. Unreferenced future snapshots can remain after a failed pre-manifest commit, and editing an immutable JSON snapshot outside Lotion previously became indistinguishable from canonical content after a restart. A recovery tool that depends on the web application starting cannot handle these cases.

## Decision

Provide an offline `npm run doctor` workflow. Diagnosis reads the manifest and complete revision inventory without modifying either. It reports stable issue codes for missing files, unsafe symlinks, malformed JSON, envelope/schema failures, missing parents, hierarchy cycles, future/unknown orphan snapshots, and canonical content whose stored hash changed. Historical revisions below the committed revision remain intentional history and are not reported as orphans.

The manifest retains a semantic SHA-256 hash for each committed document. Existing version-1 workspaces establish hashes only after their previously accepted snapshots and hierarchy pass the same startup validation. A later mismatch refuses startup with a doctor command instead of silently accepting externally edited bytes. This extends the version-1 manifest compatibly; document and content schemas do not change.

Reconciliation is a separate, explicit phase. `--write-plan` emits an empty JSON plan bound to the diagnostic token. The operator adds exact actions:

- `recover` names a document ID and a valid source revision, and can explicitly replace its parent with another ID or `null`. The source is copied into a new revision greater than every known and manifest revision; no existing snapshot is overwritten.
- `drop-reference` removes an irrecoverable document from the next manifest. It does not delete its files. Any child must also be recovered to a valid parent or explicitly dropped, or validation rejects the entire plan.

Applying a plan acquires the normal exclusive workspace lock, repeats diagnosis, and rejects a stale token. It validates every source and the complete resulting hierarchy before writing. It records the old manifest, diagnosis, and plan under `recovery/`, writes new immutable snapshots, then atomically publishes one manifest. Existing files are never deleted. Remaining unreferenced snapshots stay visible as warnings until a future retention policy is implemented.

## Consequences

The workflow can repair document-level corruption even when the server cannot start and does not require exposing filesystem recovery through the browser. It deliberately cannot guess content, reconstruct a missing/malformed manifest, or choose between competing valid snapshots. Operators must stop the server, retain an independent full backup, inspect candidate revisions, and state their choice in the plan.

Canonical hash checks detect semantic JSON changes, not whitespace-only rewrites. They provide integrity and external-change detection, not cryptographic authenticity: an operator with filesystem access can also modify the manifest hashes. Live external editing remains unsupported.

Automated retention and garbage collection remain separate because history, failed commits, recovery sources, trash, and assets require a broader reachability policy.

## Alternatives rejected

- Automatically choose the highest readable revision: rejected because a failed/partial future write is not necessarily the user's intended version.
- Rewrite damaged files in place: rejected because it destroys evidence and violates immutable revision semantics.
- Delete every unreferenced snapshot: rejected because it can remove history or the only recoverable copy after an interrupted commit.
- Put recovery only in the control panel: rejected because canonical corruption may prevent the backend and UI from starting.
