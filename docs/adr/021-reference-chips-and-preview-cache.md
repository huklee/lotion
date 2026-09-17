# ADR-021: Typed mention chips and bounded preview freshness

- **Status:** Validated
- **Date:** 2026-09-17

## Context

Raw links and references were both stored as ordinary BlockNote links and shared the same chip styling. The application could distinguish an external preview only through a separate document-level map, while page titles/icons were duplicated into link text. External OpenGraph metadata never expired, so saved chips could remain stale indefinitely. Refreshing every hover would instead create unbounded remote traffic and repeated asset writes.

## Decision

Represent page and external references as a custom `mention` inline-content type with validated `kind`, `href`, `label`, and `icon` properties. Keep ordinary pasted URLs as BlockNote links. Mention renderers use chip styling and separate icon/label elements; raw links use conventional underlined-link presentation. The page tree remains authoritative for internal labels and icons, and changes update matching mentions immediately in the active editor.

Migrate existing internal page links and external links that have persisted `linkPreviews` metadata when a page opens. Leave every other link untouched. Exact bundles preserve typed mention data. Portable Markdown intentionally emits ordinary links with the visible icon and label, so references remain useful without requiring a Lotion-specific extension. Mention labels participate in table-of-contents text and workspace search.

Add an optional ISO `fetchedAt` field to persisted preview metadata. A saved preview older than 15 minutes refreshes on hover while its stale content remains visible. Only one client request per URL may be active, a failed refresh retains saved metadata, and a successful refresh updates both the preview card and every matching external mention label.

The server canonicalizes preview URLs, caches successful results for 15 minutes, retains at most 256 least-recently-used entries, and stores no failed lookup. Cache entries are process-local derived state. Existing request concurrency, timeout, response-size, MIME, redirect, DNS-pinning, and SSRF controls remain authoritative for cache misses.

## Consequences

The document format gains a backward-compatible inline type and optional preview timestamp but keeps schema version 1 because existing readers already preserve generic block JSON and legacy links migrate deterministically. Old exact bundles remain readable. New exact bundles require a reader that understands `mention` to render the chip exactly; portable Markdown remains the interoperability path.

[ADR-022](022-file-and-date-references.md) extends this typed node with file and date semantics without changing the page/external preview rules decided here.

The cache bounds memory and remote fetch frequency per server process but is intentionally not shared across replicas or restarts. A remote page can remain stale for at most the configured TTL after a successful fetch. Cached preview images remain immutable content-addressed assets; asset garbage collection is a separate backlog item.

## Alternatives

- CSS heuristics over link text: rejected because styling cannot reliably distinguish a titled external mention from a raw URL and would not provide a stable type for future reference behavior.
- Refresh on every render or hover: rejected because it creates uncontrolled remote traffic and asset churn.
- Persist the server cache: rejected because canonical documents already contain the latest successful metadata, while the cache is disposable rate control rather than user data.

## References

The implementation follows BlockNote's official [custom inline content](https://www.blocknotejs.org/docs/features/custom-schemas/custom-inline-content) extension point and its [document structure](https://www.blocknotejs.org/docs/foundations/document-structure).
