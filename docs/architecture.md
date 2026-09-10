# Architecture

Status: implementation baseline; spikes pending.
Last updated: 2026-09-09.
Related records: [decisions](decisions.md), [test plan](test-plan.md), [roadmap](roadmap.md).

## Scope and assumptions

Deliver a clean, Notion-like web application with block editing, slash commands, block reordering, image drag-and-drop, rectangular multi-block selection, section movement, links, automatic saving, immediate sidebar title updates, a hierarchical sidebar, keyboard shortcuts, themes, document creation/trash/restore, and whole-folder Markdown import/export with assets.

Initial deployment: one user, one workspace, one backend writer process. Multiple tabs and devices are supported through revision conflicts, not concurrent collaborative merging. AI, databases-as-pages, comments, multiplayer editing, and granular workspace permissions are out of scope.

Local storage means the filesystem of the machine running the backend. A remote server does not have direct access to the browser user's disk. Browser downloads/uploads handle portability.

Canonical JSON preserves supported rich document state. Portable Markdown preserves a documented subset. A Markdown bundle with application JSON and a manifest provides full supported-data restoration.

## Stack

| Area | Baseline | Rationale |
| --- | --- | --- |
| Web | React, TypeScript, Vite | Client-rendered application, shared language with backend |
| Editor | BlockNote | Existing block UX, slash commands, image integration |
| UI | Accessible primitives and CSS theme variables | Consistent navigation, menus, dialogs, and focus behavior |
| State | Editor-owned blocks; small Zustand application store | Avoid full-document React updates per keystroke |
| Server | Node.js active LTS, Fastify, TypeScript | Lightweight HTTP and filesystem service |
| Validation | Zod | Validate inputs, disk data, and imports |
| Markdown | unified, remark-parse, remark-gfm, remark-stringify | Explicit syntax-tree conversion |
| Storage | JSON files, immutable hash-addressed assets | Inspectable files; no mandatory database |
| Draft recovery | IndexedDB | Recover recent browser-side edits |
| Testing | Vitest, Playwright | Unit/integration and real-browser coverage |
| Deployment | Single process/container with a persistent local volume | Simple ownership and operations |

Pin compatible dependency versions and record the runtime when scaffolding. Audit licenses of selected core/extensions before adoption. Tiptap is the fallback if the BlockNote spike exposes unacceptable customization constraints. Go is optional for a Go-oriented team; desktop wrappers are a separate future product decision.

## Components and data ownership

```text
Browser editor / title / sidebar
  -> per-document save coordinator -> HTTP API
  -> IndexedDB draft checkpoint        -> document service
                                        -> filesystem repository
                                        -> Markdown/asset services
```

- Editor adapter owns editor schema integration and portability mappings.
- Save coordinator owns dirty generations, snapshots, retries, and acknowledgments.
- Document service owns IDs, revisions, hierarchy rules, moves, deletion, and conflicts.
- Repository owns serialization, atomic replacement, writer ownership, and recovery.
- Portability service owns parsing, path/link rewriting, manifests, and staged imports.
- The sidebar index is derived metadata, never an independent source of truth.
- UI code never constructs disk paths. Request bodies cannot choose arbitrary storage paths.

Suggested source layout: `apps/web`, `apps/server`, `packages/document-schema`, `packages/editor-adapter`, `packages/markdown`, `packages/persistence`, and `packages/test-fixtures`. Documentation remains in `docs/`.

## Document model

Illustrative envelope; actual block properties must match the pinned editor schema:

```json
{
  "schemaVersion": 1,
  "editorSchemaVersion": 1,
  "id": "doc_01",
  "revision": 17,
  "lastMutationId": "mutation_17",
  "lastMutationDigest": "sha256:example",
  "title": "Project plan",
  "parentId": null,
  "position": "a0",
  "createdAt": "2026-09-09T01:00:00Z",
  "updatedAt": "2026-09-09T02:00:00Z",
  "deletedAt": null,
  "blocks": [
    {
      "id": "block_01",
      "type": "paragraph",
      "props": {},
      "content": [{ "type": "text", "text": "Launch checklist", "styles": { "bold": true } }],
      "children": []
    }
  ]
}
```

Use opaque generated document IDs. IDs do not depend on title, location, or export path. Block IDs remain stable on edits and moves; duplication generates new IDs. Internal links reference document IDs and optional block IDs. Asset references are stable logical IDs resolved to authenticated URLs, not blob URLs or expiring URLs.

Revisions and timestamps are server-controlled. Every document mutation increments its revision. Content requests only edit title/blocks; they cannot overwrite hierarchy fields from stale snapshots. Unknown newer schema versions fail clearly or open read-only. Migrations operate on validated inputs and preserve a recoverable original.

## Hierarchy

Store `parentId` and a lexicographically sortable rank in each document. Sort siblings by rank, then ID for deterministic ties. Validate that parents exist, belong to the workspace, are visible, and create no cycles. Select and test a fractional-rank implementation during Milestone 0; any future rank compaction requires a recoverable multi-file transaction.

The sidebar projection contains ID, parent ID, rank, title, revision, and deleted state. Rebuild it from canonical files at startup; an optional cache accelerates startup but must be safe to discard. Derive a tree ETag from authoritative projection metadata, and check it inside the mutation queue for moves.

Tombstoning a page hides it and its descendants through ancestry. Prevent updates/moves under a deleted ancestor. Restoration restores ancestor visibility without clearing descendants' own tombstones. Define and test attempts to restore a page whose parent remains deleted. Permanent deletion is deferred until retention and recovery behavior is implemented.

## Filesystem mapping

```text
workspace/
  workspace.json
  documents/doc_01.17.json
  documents/doc_02.4.json
  assets/sha256/ab/abcd...1234.png
  history/doc_01/000016.json
  cache/tree-index.json
```

`workspace.json` maps each document ID to its visible committed revision and stores retry receipts. Revision files are immutable; one atomic manifest replacement publishes a single-page mutation or an entire staged import. See [ADR-010](adr/010-implementation-foundations.md).

Logical hierarchy does not require nested canonical directories. Renames and moves leave file and asset identities unchanged. Asset bytes are immutable and hash-addressed. Finish and durably commit uploads before inserting persistent references. Interrupted/unreferenced uploads can be cleaned after a grace period. Garbage collection accounts for active documents, trash, retained history, and in-progress imports.

Workspace backups go to a configurable separate destination; a copy on the same disk is insufficient for disk-loss recovery. Capture a consistent snapshot by pausing mutations or using a supported snapshot mechanism. Include format versions and referenced assets; test restoring on a fresh installation.

## API contract

| Route | Behavior |
| --- | --- |
| `GET /api/tree` | Metadata projection and ETag |
| `POST /api/documents` | Create; mutation ID prevents retry duplication |
| `GET /api/documents/:id` | Document and revision ETag |
| `PUT /api/documents/:id/content` | Save title/blocks using `If-Match` |
| `POST /api/documents/:id/move` | Validate document revision and tree precondition |
| `POST /api/documents/:id/trash` | Tombstone with revision precondition |
| `POST /api/documents/:id/restore` | Restore with revision precondition |
| `POST /api/assets` | Stream, validate, hash, and persist upload |
| `POST /api/imports` | Validate/stage/commit import; expose job status |
| `POST /api/exports` | Snapshot/export selected document or subtree |

Return explicit validation, not-found, precondition, quota, and I/O errors. Missing required preconditions are rejected. Stale `If-Match` returns 412. Enforce body/upload/depth limits before expensive work. Final route schemas and response examples must be documented with implementation.

## Save algorithm

1. A document-changing editor transaction increments a local generation; selection-only changes do not.
2. Update title/sidebar synchronously through shared application state.
3. Schedule an IndexedDB checkpoint and a trailing 3-second server debounce with a 10-second maximum wait.
4. At dispatch, capture immutable content, generation, base revision, mutation ID, and payload digest.
5. Permit one in-flight request per document. Keep its coordinator alive during navigation.
6. On acknowledgment, advance the base revision. Mark clean only if the acknowledged generation still matches current edits.
7. If newer edits exist, schedule the latest snapshot. Clear only browser checkpoints covered by the acknowledgment.

Retry network/transient failures with bounded exponential backoff and jitter. Keep the same mutation identity for a retry. Check replay identity before stale-revision rejection: a matching last committed ID and digest can return its previous success; a reused ID with different data is invalid. Older ambiguous replays conflict safely. Creation and multi-file jobs need a durable receipt/job strategy rather than relying only on `lastMutationId`.

Revision conflicts preserve the browser draft and offer reload, save-as-copy, or explicit resolution. No silent last-write-wins. Draft records include document ID, base revision, client/session identity, generation, and content to avoid cross-tab overwrites. Uploads still pending at reload need a recoverable file checkpoint or a clear re-upload state.

Start with complete snapshots. Skip saves for selection-only changes and optionally equal canonical hashes at dispatch. Do not serialize/diff the entire tree every keystroke. Introduce block patches only after profiling.

Display Unsaved, Saving, Saved, Offline draft, Conflict, or Save failed accurately. Saved means server acknowledgment after the configured durability boundary. `Ctrl/Cmd+S` flushes immediately. Flush opportunistically when hidden; unloading the browser is not a durability mechanism. Browser checkpoints can fail or be evicted and are not backups.

## Race prevention and durability

Use one workspace mutation queue initially. Validate preconditions and hierarchy inside that queue. Enforce exclusive process ownership of the workspace; refuse a second writer. Direct external file editing while running is unsupported until an explicit reconciliation mechanism exists.

For each canonical replacement: validate -> create unique same-directory temporary file -> write -> flush and close -> rename over destination -> flush parent directory where supported -> update derived index -> acknowledge. Preserve the old canonical file until replacement is ready. Never acknowledge before the durability boundary.

Validate this protocol on Linux/local filesystems first. Other operating systems, network shares, and synchronized folders require explicit qualification. Startup discards uncommitted temporary files, validates canonical data, recovers committed jobs, rebuilds indexes, and exposes corruption instead of silently overwriting it.

History retention is configurable and coalesced to avoid one retained file per debounce indefinitely. Record recovery point and disk-space implications. Multi-file imports and any future bulk mutation use persistent transaction state with a defined commit point and idempotent startup recovery.

## Markdown portability

Convert `Markdown -> remark/mdast -> validated blocks` and `blocks -> mdast -> Markdown`. Use explicit mappings and fixture-based semantic comparisons; avoid regex conversion.

| Feature | Portable representation |
| --- | --- |
| Paragraphs/headings/emphasis/links | Standard Markdown |
| Nested lists/task lists | Markdown/GFM lists |
| Code | Fenced code with language |
| Simple tables | GFM tables |
| Images | Relative asset links and alt text |
| Embeds/bookmarks | Link fallback |
| Widths/colors/columns/custom layouts | Warning plus exact bundle metadata |

An export bundle contains `manifest.json`, nested title-plus-ID directories with `index.md`, `assets/`, and optional `.app/documents/*.json` snapshots. Store document mapping, sibling order, schema versions, and file hashes in the manifest. Recalculate relative document/asset links for each page. Plain `.md` export cannot itself represent a workspace hierarchy.

On import: validate archive/paths/limits -> parse/report losses -> allocate IDs -> map links -> commit assets -> validate staged documents -> commit job -> expose documents. Interrupted imports remain hidden until committed. Recovery finishes committed jobs and cleans incomplete ones idempotently. Parse frontmatter only as constrained data.

If exported Markdown was edited, detect its hash mismatch and ask which representation to import; do not silently restore stale JSON. Preserve unsupported source in a safe fallback where feasible. Missing/remote assets produce visible warnings. Remote fetching is an explicit behavior, never an arbitrary server fetch by default.

## UX and security

Required interaction semantics are defined in [ADR-007](adr/007-editor-interactions.md). Drag files into an exact block insertion point; show upload progress and allow retry. Drag from the editor gutter to select intersecting blocks without hijacking normal text selection. Move a heading and its section content together with stable IDs, one undo transaction, and one coherent save snapshot. Nested subtree movement must never create cycles. Verify actual behavior in the editor spike before adopting an extension or implementing a custom interaction layer.

Whole-folder import/export is mandatory; see [ADR-008](adr/008-folder-portability.md). Provide folder picker intake and directory drag-and-drop where supported, plus ZIP intake/export as a broadly usable path. Recursively preserve relative paths, Markdown pages, nested directories, and assets. A browser without directory-write capability still receives a ZIP containing the complete hierarchy. Unsupported directory-drop APIs must produce a clear folder-picker/ZIP fallback, not silently drop subdirectories.

Provide slash commands, keyboard-accessible block movement, undo/redo, paste handling, route-based selection, tree navigation, quick create/trash/restore, image progress/retry, system/light/dark themes, and accessible focus states. Test IME composition, particularly Korean text, during saves and slash-command interactions.

Serve UI/API on one origin. Bind loopback by default. Remote access requires authentication and TLS. Protect asset routes too. Apply origin/CSRF protection appropriate to the chosen session scheme. Deny traversal and symlink escapes; validate file signatures and serving content types. Imported HTML/MDX never executes. Use an embed provider allowlist and sandboxing. If adding link previews, restrict destinations and redirects to prevent internal-network requests.

## Performance and operations

Initial workload: 10,000 page metadata entries, a 500-block active document, and a documented asset corpus. Establish a named reference environment in Milestone 0, then set numerical budgets for input, open, save (excluding debounce), index rebuild, and memory. Do not claim benchmark performance before measurement.

Log request/mutation IDs, revisions, durations, and error categories, not document bodies. Operational documentation must cover setup, persistent volume permissions, backup, restore, migration, rollback, corruption recovery, and disk-full recovery before release.

## Source references

Evaluated during architecture planning on 2026-09-09; recheck exact versions when implementing.

- [BlockNote overview](https://www.blocknotejs.org/docs)
- [BlockNote Markdown fidelity](https://www.blocknotejs.org/docs/features/import/markdown)
- [BlockNote slash menus](https://www.blocknotejs.org/docs/react/components/suggestion-menus)
- [BlockNote uploads](https://www.blocknotejs.org/examples/backend/file-uploading)
- [BlockNote package/licensing information](https://www.blocknotejs.org/pricing)
- [Tiptap overview](https://tiptap.dev/docs/editor/getting-started/overview)
- [Node filesystem API](https://nodejs.org/api/fs.html)
- [remark](https://github.com/remarkjs/remark)
- [Browser File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
