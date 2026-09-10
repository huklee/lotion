# ADR-012: Preserve drafts and resolve revision conflicts

Accepted 2026-09-10. The target page f63edb5a-4d08-4145-8f55-f41a6bc130df has a valid server document at revision 47 with 13 blocks. Its browser draft is private to the user's browser session and cannot be inspected from an isolated automation browser.

## Defect

Recovered stale drafts entered Conflict without setting an error message. App.tsx rendered recovery controls only when an error existed, leaving stale drafts stuck without controls. Recovery also retained the newer server revision instead of the draft's original revision; rejected pending requests had no explicit resolution path.

## Decision

Always show conflict controls, store the base content with future browser checkpoints, and keep the draft's revision during recovery. On a save conflict, fetch the latest server version and attempt a conservative three-way merge. Merge independent fields and edits to distinct top-level blocks with unchanged block ordering. Treat competing edits to the same block, simultaneous structural edits, and ambiguous legacy drafts without base snapshots as requiring review. Nested blocks are part of their top-level block; they are not independently merged.

Show both versions and conflicting field/block identifiers. Users can retain their draft, use the server version, or save the draft as a separate document. Before applying a resolution, archive the local draft to a distinct browser IndexedDB recovery key. Archive failure prevents replacement. A draft edit during archiving also cancels resolution. Server revisions remain immutable on disk. Using the server version writes a new revision conditionally, so intervening writes still surface as conflicts.

A resolution discards the rejected pending mutation and uses a new mutation ID with the revision that was reviewed. Never force-write past If-Match checks. Limit automatic review to one attempt after a conflict; further races require another review. Remount the editor only when a resolution changes its content so its view matches the coordinator.

Recovery archives are local browser storage, not backups; clearing browser storage removes them. Existing stale drafts cannot be safely merged without a common base unless both versions already agree on a field. The UI therefore requires a user's choice for genuine competing content. There is no automatic last-writer-wins overwrite.

## Verification

Unit tests cover independent block merges, overlapping edits, reorder conflicts, legacy recovery, immutable pending mutation replacement, independent-field rebasing, archive failure and repeated server changes. Browser tests exercise a real two-tab collision, reload into recovery controls, choosing the local draft, successful conditional save and another reload in Chromium, Firefox and WebKit.
