# ADR-008: Whole-folder import and hierarchical export

Status: Baseline; capability verification and implementation pending.
Date: 2026-09-09.

## Context

The user explicitly requires import/export to work with an entire folder, including nested documents and embedded assets. A collection of independently imported flat Markdown files is insufficient.

## Decision and rationale

- Offer a folder picker, directory drag-and-drop where supported, and ZIP import. Normalize all intake to a bounded stream of relative paths and bytes before common validation. Recursively enumerate directories; do not depend solely on the top-level dropped FileList.
- Offer a ZIP export containing the whole selected hierarchy and all referenced local assets. Add direct directory export only on browsers with the necessary user-granted directory capabilities. ZIP keeps complete-folder export usable across the supported browser matrix.
- Map a directory's `index.md` to its page. A directory without `index.md` becomes a container page named after the directory; its Markdown files and subdirectories become children. Preserve source directory entries in the manifest, including empty directories. Ordinary input ordering is deterministic by normalized path; application manifests preserve explicit sibling order.
- Validate manifests; allocate new IDs by default and remap internal links. Exact data restoration means supported content/structure equality after the documented ID remapping, not overwriting an existing workspace by untrusted IDs.
- Preserve assets' relative relationships during intake; store bytes by hash internally; rewrite links on export. Carry otherwise unreferenced supported files as attachments or report excluded files explicitly. Never silently discard files.
- Use title-plus-ID names for generated exports. Detect case-folding/Unicode/path collisions before writing and apply deterministic disambiguation recorded in the manifest.
- Import the whole staged tree under one recoverable job with atomic visibility. Fail validation before publication and report per-file issues. Resource limits apply to total expanded bytes, file count, depth, and individual files.

## Alternatives and consequences

Single `.md` upload cannot express the full hierarchy. Browser filesystem APIs alone restrict portability and require permissions. ZIP adds archive validation obligations but provides a complete, portable representation. Direct directory drops/writes require explicit feature detection and tested fallback UI.

## Evidence and revisit condition

Required tests: MD-08 through MD-11, MD-02/03/06, IO-07, SEC-01/02. Verify browser capabilities against current official documentation during M0. Revisit container mapping if real import fixtures reveal ambiguity; preserve the original path map so migration remains possible.
