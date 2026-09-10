# Architecture decision log

- Status convention:
  - **Baseline**: selected for planning.
  - **Validated**: supported by implementation and recorded test evidence.
- Dedicated implementation decisions:
  - [ADR-007: Editor interactions](adr/007-editor-interactions.md)
  - [ADR-008: Whole-folder portability](adr/008-folder-portability.md)
  - [ADR-009: Engineering decision ownership](adr/009-decision-ownership.md)
  - [ADR-010: Implementation foundations and atomic workspace commits](adr/010-implementation-foundations.md)
  - [ADR-011: Previews, navigation, code contrast, and Mermaid](adr/011-editor-previews-and-diagrams.md)
  - [ADR-012: Draft-preserving conflict resolution](adr/012-conflict-resolution.md)

## ADR-001: React, BlockNote, and Node.js/Fastify

- **Context:** Deliver Notion-like core editing with a small self-hosted application.
- **Decision:** Use TypeScript across browser and backend, BlockNote for block UX, and a Node filesystem service.
- **Alternatives:** Headless Tiptap, a Go backend, or a desktop wrapper.
- **Consequences:** Validate and pin editor schema, license, and dependency compatibility in M0; keep editor adaptation separate from repository logic.
- **Revisit when:** Required block UX cannot be implemented cleanly, licensing is unsuitable, or measured runtime constraints warrant a backend change.

## ADR-002: Canonical JSON and immutable filesystem assets

- **Context:** Markdown cannot preserve all rich editing and layout state.
- **Decision:** Use versioned JSON document files and hash-addressed asset files as canonical data. Markdown is a portability format; optional bundle metadata preserves supported rich data.
- **Alternatives:** Markdown-only authority or SQLite authority.
- **Consequences:** Require explicit migrations and conversion mappings, rebuild derived indexes, and do not support direct concurrent external file edits.
- **Revisit when:** External Markdown editing becomes a core workflow or measured scale demands transactional database storage.

## ADR-003: One writer process, serialized mutations, revision checks

- **Context:** A single-user product must still withstand multiple tabs and retries.
- **Decision:** Enforce process ownership, serialize mutations, check revisions within the queue, preserve conflicting drafts, and use mutation identity for retry recognition.
- **Alternatives:** Last-write-wins, CRDT collaboration, or multiple writers with distributed locking.
- **Consequences:** Establish a simple correctness boundary with limited write parallelism and explicit conflict UI. Creation and bulk jobs need durable receipt state.
- **Revisit when:** Measured queue contention or actual collaboration requirements justify a stronger protocol.

## ADR-004: Stable IDs and logical hierarchy

- **Context:** Title and tree changes must not break references or require directory migrations.
- **Decision:** Store canonical documents in a flat file layout; use parent IDs and sortable ranks for nesting/order; use stable IDs for links.
- **Alternatives:** Nested title-based canonical paths.
- **Consequences:** Need a derived sidebar and explicit export-path mapping; rank compaction must be recoverable.
- **Revisit when:** Direct folder editing becomes an explicit product requirement.

## ADR-005: Debounced snapshots with browser draft recovery

- **Context:** Seamless saves must not starve during typing or lose newer edits on late responses.
- **Decision:** Use a 3-second debounce, 10-second maximum wait, one in-flight save per document, immutable snapshots, generation-aware acknowledgments, and IndexedDB recovery checkpoints.
- **Alternatives:** Per-keystroke server writes, a fixed interval, or a block-patch protocol.
- **Consequences:** Recent uncheckpointed edits remain vulnerable; full snapshot cost must be measured; browser storage is not a backup.
- **Revisit when:** Measured payload/latency cost or stronger offline guarantees require changes.

## ADR-006: Tests and Markdown records are milestone gates

- **Context:** The project requires proactive testing and complete design/implementation tracking under `docs/`.
- **Decision:** Plan and execute applicable tests with each milestone, fix failures, record evidence, and keep planning/technical records as Markdown in `docs/`.
- **Alternatives:** Ad hoc manual checks and undocumented implementation.
- **Consequences:** Test harness work belongs in M0; unverified work remains explicitly pending.
- **Revisit when:** Workflow changes improve verification without weakening documentation and testing requirements.
