# ADR-013: Lotion naming and upgrade compatibility

Accepted 2026-09-10.

## Decision

Use Lotion for the application title, sidebar wordmark/initial, slash-menu groups, documentation, package/lockfile names, link-preview user agent, exported filenames and new bundle/Markdown markers. Use `lotion-` browser keys and CSS classes, Lotion drag/import MIME names, and `LOTION_DATA_DIR` / `LOTION_TOKEN` environment variables.

Changing a brand must not abandon unsaved drafts, settings, existing deployments or exact exports. Keep the former literal names only in explicit compatibility readers and their tests:

- Read the new browser settings first; copy legacy session identity, theme and token settings into the new namespace on first read.
- Read a new draft first, then its legacy key. New checkpoints use the new namespace; successful save cleanup removes both names so an old draft does not reappear. Existing recovery archives stay in their original browser storage rather than being deleted.
- New environment variables take precedence; legacy aliases remain fallback-only to keep existing data directories and authentication configured.
- Write the new bundle format and TOC marker, but accept both generations during import. Accept old directory-upload MIME types from already-open clients.

Existing document IDs, canonical workspace files, asset hashes and page URLs are unchanged. Browser migration requires the same origin and session; copying a repository does not transfer browser storage between different origins or migrate the original workspace directory.

## Verification

Tests exercise legacy settings/draft reads and cleanup, legacy/new exact bundles, old TOC import/new TOC export, and browser reload/save after a legacy draft and theme are restored. Existing tests use new visible labels, CSS classes and export filenames. Search remaining old-name references to ensure they are limited to compatibility paths and tests.
