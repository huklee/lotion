# Development and documentation workflow

## Working agreement

All plans, architecture details, decisions, implementation notes, test plans, results, and operator documentation are Markdown under `docs/`. Keep executable tests in source/test directories. Add links from [the documentation index](README.md) when adding documents.

The user delegates major and minor technical design decisions to the implementing engineer. Make routine choices autonomously within scope and explain why in Markdown decision records. Use `docs/adr/NNN-topic.md` for major decisions; small choices can be grouped in a relevant technical decision record. Include alternatives, consequences, evidence status, and revisit conditions. Maintain [the decision index](decisions.md); do not claim an untested choice is validated.

Record every major completed work item in [implementation history log](implementation-history-log.md) using an actual clock timestamp in ISO 8601 with a UTC offset, plus task/milestone references and evidence links. Append entries; correct mistakes explicitly. For earlier work whose exact completion time was not captured, label the timestamp as its recording time rather than inventing a completion time. Keep history and current progress in this single log; do not create a separate implementation summary log.

For each feature: define acceptance criteria -> identify risks/test cases -> implement a small vertical slice -> execute applicable checks -> fix failures -> rerun -> update implementation/results/decision records. Do not hand off known routine failures as completed work.

## Pull-request integration loop

One completed fix or feature maps to one branch, one pull request targeting `main`, and one merge into `main`. Start the branch from current `origin/main`; never start the next item from an unmerged feature branch. A stacked pull request targeting another work branch can make GitHub show “merged” while leaving `main` unchanged, so it is prohibited for this repository.

After local verification, push the branch, open the pull request with `main` as its base, confirm the head commit and diff, wait for every required check, and merge it. Fetch `origin/main` and use `git merge-base --is-ancestor <feature-commit> origin/main` (or equivalent PR metadata for a squash merge) to verify delivery. Only then mark the integration complete and branch for the next backlog item. If a prerequisite is pending, finish and merge its own `main` pull request first rather than changing the next PR base.

Documentation-only workflow corrections use the same direct-to-`main` loop but do not require an application version increment. Never force-push or rewrite `main`, and never combine unrelated backlog items merely to repair branch ancestry.

## Tracking

Use Backlog -> Ready -> In progress -> Review -> Done. Each task names its milestone, dependencies, observable outcome, acceptance criteria, relevant test IDs, documentation impact, and verification evidence. Mark roadmap checkboxes only when their work is complete. Repository Markdown remains the durable record even if an external issue board is used.

## Definition of done

- Requested behavior and applicable error states implemented.
- Relevant tests executed and passed, with fixes verified.
- Necessary type/build/lint checks passed once scripts exist.
- Schema/API/decision documentation updated where behavior changed.
- Test results include exact commands, environment, outcomes, and limitations.
- No claim of execution for proposed commands or unavailable environments.
- Remaining work explicitly tracked, with no data-safety blocker concealed.

## Review cadence

At each milestone review working behavior, failed cases, measurements, and newly discovered risks. Re-estimate after evidence from M0. Revisit architecture only when a concrete limitation or requirement justifies it. Keep historical decision records; mark superseded entries and link replacements.

## Design document template

```markdown
# Design: <feature>

Status / owner / date:
Related milestone, issues, ADRs:

## Problem and user journeys

## Goals, non-goals, and assumptions

## Acceptance criteria

## Components and ownership

## Data/schema/API changes

## Concurrency and failure handling

## Security and resource limits

## Migration, rollout, and recovery

## Test cases and execution plan

## Performance measurement

## Alternatives and tradeoffs

## Open questions
```

## Decision template

```markdown
## ADR-NNN: <decision>

Date:
Status: Proposed / Baseline / Validated / Superseded
Context:
Decision:
Alternatives:
Consequences:
Evidence and linked test results:
Revisit when:
```

## Implementation entry template

```markdown
## <date> — <change>

Milestone / task:
Behavior implemented:
Files/components:
Schema/API implications:
Decisions/deviations:
Tests executed: <link to result entry>
Remaining work/risks:
```

## Test result template

```markdown
## <date> — <verification run>

Revision or workspace state:
Environment and versions:
Scope and test IDs:
Commands:
Exit status / passed / failed / skipped / duration:
Artifacts:
Failures and resolutions:
Unverified limitations:
Release/milestone impact:
```

## Required operator documentation before release

Create linked Markdown runbooks for installation/configuration, authentication/TLS, persistent volume ownership, backups and verified restoration, migration/rollback, corruption/disk-full recovery, and troubleshooting using non-sensitive logs. Avoid storing secrets or user document content in logs or test reports.
