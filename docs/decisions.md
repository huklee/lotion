# Architecture decision log

Editor follow-up decisions: [ADR-011: previews, navigation, code contrast and Mermaid](adr/011-editor-previews-and-diagrams.md).

Status convention: Baseline means selected for planning; Validated requires implementation evidence. All entries below are Baseline as of 2026-09-09.

Additional dedicated technical decision records:

- [ADR-010: Implementation foundations and atomic workspace commits](adr/010-implementation-foundations.md)

- [ADR-007: Editor interactions](adr/007-editor-interactions.md)
- [ADR-008: Whole-folder portability](adr/008-folder-portability.md)
- [ADR-009: Engineering decision ownership](adr/009-decision-ownership.md)

## ADR-001: React, BlockNote, and Node.js/Fastify

Context: deliver Notion-like core editing with a small self-hosted application.
Decision: TypeScript across browser/backend; BlockNote for block UX; Node filesystem service.
Alternatives: headless Tiptap, Go backend, desktop wrapper.
Consequences: editor schema/license/dependency compatibility must be validated and pinned in M0. Keep editor adaptation separate from repository logic.
Revisit when: required block UX cannot be implemented cleanly, licensing is unsuitable, or measured runtime constraints warrant a backend change.

## ADR-002: Canonical JSON and immutable filesystem assets

Context: Markdown cannot preserve all rich editing/layout state.
Decision: versioned JSON document files and hash-addressed asset files are canonical. Markdown is a portability format; optional bundle metadata preserves full supported data.
Alternatives: Markdown-only authority; SQLite authority.
Consequences: explicit migrations and conversion mappings; derived index rebuild; no direct concurrent external file edits.
Revisit when: external Markdown editing becomes a core workflow or measured scale demands transactional database storage.

## ADR-003: One writer process, serialized mutations, revision checks

Context: single-user product must still withstand multiple tabs and retries.
Decision: enforce process ownership; serialize mutations; check revisions within queue; preserve conflicting drafts; use mutation identity for retry recognition.
Alternatives: last-write-wins; CRDT collaboration; multiple writers with distributed locking.
Consequences: simple correctness boundary, limited write parallelism, explicit conflict UI. Creation/bulk jobs need durable receipt state.
Revisit when: measured queue contention or actual collaboration requirements justify a stronger protocol.

## ADR-004: Stable IDs and logical hierarchy

Context: title and tree changes must not break references or require directory migrations.
Decision: flat canonical document files; parent ID and sortable rank encode nesting/order; stable IDs encode links.
Alternatives: nested title-based canonical paths.
Consequences: derived sidebar and explicit export path mapping; rank compaction must be recoverable.
Revisit when: direct folder editing becomes an explicit product requirement.

## ADR-005: Debounced snapshots with browser draft recovery

Context: seamless saves must not starve during typing or lose newer edits on late responses.
Decision: 3-second debounce, 10-second maximum wait, one in-flight save per document, immutable snapshots and generation-aware acknowledgments; IndexedDB recovery checkpoints.
Alternatives: per-keystroke server writes; fixed interval; block-patch protocol.
Consequences: recent uncheckpointed edits remain vulnerable; full snapshot cost must be measured; browser storage is not a backup.
Revisit when: measured payload/latency cost or stronger offline guarantees require changes.

## ADR-006: Tests and Markdown records are milestone gates

Context: user requests proactive testing and complete design/implementation tracking under `docs/`.
Decision: plan and execute applicable tests with each milestone, fix failures, record evidence, and keep all planning/technical records as Markdown in `docs/`.
Alternatives: ad hoc manual checks and undocumented implementation.
Consequences: test harness is M0 work; application tests cannot pass before code exists; unverified work remains explicitly pending.
Revisit when: workflow changes improve verification without weakening the user's documentation/testing requirements.
