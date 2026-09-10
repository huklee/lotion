# ADR-009: Autonomous technical decisions with rationale records

Status: Accepted workflow requirement.
Date: 2026-09-09.

## Context

The user delegates major and minor system design decisions and requires the reasons to be logged in technical decision Markdown files. The user also requires executed test plans and timestamped implementation history.

## Decision and rationale

Make implementation choices autonomously within the established product scope. Record major choices in dedicated `docs/adr/` files and group related small decisions there when useful. Every record explains the problem, selected approach, alternatives, tradeoffs, evidence status, and when to reconsider. This avoids repeated approval interruptions while retaining reviewable reasoning.

Maintain `docs/decisions.md` as the index/baseline log, `docs/implementation-history-log.md` as the single record for timestamped major work and implementation state, and `docs/test-results.md` for actual execution evidence. The user's subsequent instruction supersedes the original two-log arrangement: preserve history, use a filename ending in `log.md`, and remove the redundant summary. All planning and technical prose stays under `docs/` as Markdown.

## Boundaries and consequences

Design autonomy does not imply that unimplemented behavior is tested. Mark spikes, implementation, and tests pending until performed. It also does not expand the product scope or authorize unrelated external/destructive operations. Missing requirements are resolved with documented reasonable assumptions where feasible.

## Evidence and revisit condition

Authority: explicit user instruction in this conversation. Revisit workflow organization if records become hard to navigate, while retaining rationale, timestamps, test evidence, and the `docs/` requirement.
