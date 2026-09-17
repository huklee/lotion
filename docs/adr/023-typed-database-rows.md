# ADR-023: Typed database properties and child-page rows

- **Status:** Validated
- **Date:** 2026-09-17

## Context

The original `/database` command inserted an ordinary two-column BlockNote table. It provided editable cells but no stable property schema, typed validation, row identity, page behavior, or explicit portability contract. Reproducing all of Notion databases at once would combine data modeling, multiple views, formulas, relations, filtering, grouping, and page lifecycle into an unsafe refactor.

## Decision

Implement one bounded custom `database` block as a vertical slice. The database has an implicit Page title column and up to 20 user properties of type text, number, select, checkbox, or date. It stores at most 500 row references. Property and row identifiers are stable; names and values have explicit bounds; dates must be real ISO calendar dates; numbers must be finite; select values must belong to the property's options. The shared model validates browser edits, API saves, imports, Markdown output, and search extraction.

Every row is a real child document of the page containing the database. Creating a row first creates that page through the normal document API, then stores its internal page link and cached title in the database block. Activating the title cell uses normal application navigation. Current tree metadata is authoritative for the displayed title and icon; returning after a row-page rename reconciles the cached export label. Removing the database block does not trash its row pages, because page lifecycle remains governed by the workspace tree.

The first view is a table only. Users can add and rename properties and edit typed cell values. Select properties begin with bounded default options; editing option definitions, deleting properties/rows, sorting, filtering, grouping, multiple views, formulas, rollups, relations, templates, and bulk operations remain out of scope. These limits keep the stored contract small and avoid pretending that a table is a relational query engine.

Exact bundles preserve the custom block, typed values, and row-page links; import remaps internal page IDs. Portable Markdown exports a static GFM table whose first cells link to row pages. Importing portable Markdown produces an ordinary table and does not reconstruct database behavior. Workspace search indexes property names, cached row titles, and formatted values.

## Consequences

The document schema stays at version 1 because custom blocks already live inside the generic validated block envelope. Older clients should use portable Markdown; they cannot render the new exact custom block. Database metadata is saved with its containing page, while row body content and titles use normal child documents, revisions, drafts, trash, and conflicts.

Creating a row is a two-step operation: the child page is durable before its view reference is saved. If the second step is interrupted, the child remains visible and recoverable in the page tree rather than being silently deleted. A future reconciliation workflow can offer to attach such children; it must not guess or delete them automatically.

## Alternatives

- Continue using an ordinary table: rejected because cell appearance cannot enforce types or make rows real pages.
- Store complete row-page bodies inside one database block: rejected because it bypasses document revision, draft, navigation, search, trash, and export behavior.
- Implement relations/formulas/views now: rejected because those require a larger query and dependency model; they should follow measured use of this bounded core.
