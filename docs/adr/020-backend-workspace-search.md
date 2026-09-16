# ADR-020: Derived backend index for workspace search

- **Status:** Validated
- **Date:** 2026-09-17

## Context

The title-only browser filter did not search document bodies or navigate to matching blocks. The requested search also needs backend indexing, while preserving the current unsaved browser draft and the filesystem repository as the source of truth. OpenSearch was evaluated because it offers document, bulk-indexing, and search APIs, but Lotion currently targets one local workspace and a measured 10,000-document scale.

## Decision

Use a replaceable `WorkspaceSearchIndex` boundary with an in-process `LocalWorkspaceSearchIndex` implementation. Build the derived index from every validated visible revision at startup and replace a document's indexed segments only after its manifest commit becomes visible. Search filters tombstoned pages and descendants at query time, so trash and restore follow canonical hierarchy state without destructive index writes.

Index titles, formatted inline text, nested blocks, table cells, attachment names/captions, code content, and Mermaid source. Normalize literal queries with Unicode NFKC and locale-independent lowercase matching. Rank exact and prefix title matches ahead of body matches, return stable page/block IDs and bounded excerpts, cap API queries at 200 characters and displayed results at 50, and mark responses `no-store`.

The browser debounces backend requests, cancels obsolete requests, and searches the active `SaveCoordinator` content locally through the same extraction code. It excludes that page from the backend request and merges its current draft results with saved workspace results. Choosing a body result opens the existing stable block deep link; closing search restores the prior editor focus.

Do not require OpenSearch for this release. Its REST API runs as a separate service, bulk operations require partial-failure handling, and indexed changes are near-real-time unless callers pay the cost of an explicit refresh policy. Its security demo configuration is explicitly unsuitable for production. Those operational costs are disproportionate for the current single-workspace scale. The interface remains an intentional seam for an OpenSearch adapter if measured corpus size, ranking, language analysis, or multi-tenant isolation outgrows the local implementation.

Official references: [OpenSearch Search API](https://docs.opensearch.org/latest/api-reference/search-apis/search/), [Bulk API and refresh behavior](https://docs.opensearch.org/latest/api-reference/document-apis/bulk/), and [security configuration guidance](https://docs.opensearch.org/latest/security/getting-started/).

## Alternatives

- Browser-only current-document find: rejected for this milestone because it cannot search other saved pages and does not satisfy backend indexing.
- Mandatory OpenSearch cluster: rejected at the current scale because it adds an external availability, security, backup, versioning, and deployment boundary to a self-contained local application.
- Persist an index beside canonical documents: deferred because startup reconstruction is fast enough and a disposable derived index avoids another recovery format.

## Consequences

Search index failures cannot alter source documents, and a restart deterministically repairs stale derived state. The local implementation uses memory proportional to searchable text and literal substring scans rather than linguistic token ranking. On the Apple M1 qualification fixture, a title lookup across 10,000 documents took 14.22 ms and startup with index reconstruction took 2.24 seconds, both below their budgets.

## Revisit when

Measured search exceeds 100 ms, memory becomes material, multi-workspace authorization is introduced, or language-aware relevance/fuzzy search becomes a committed requirement. At that point, implement the existing interface with OpenSearch, use bulk reconstruction from canonical snapshots, version the index mapping, and treat the external index as disposable derived data.
