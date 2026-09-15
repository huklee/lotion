# ADR-019: Stable direct links to document blocks

- **Status:** Validated
- **Date:** 2026-09-15

## Context

Page links cannot identify a particular paragraph, heading, callout or other block. A Notion-style “copy link to block” interaction must survive title edits and block movement, preserve browser history, work on a fresh application load, and fail safely when a referenced block has since been deleted.

## Decision

Address locations with the existing stable page and block IDs using `#/page/{pageId}#block={blockId}`. Validate both identifiers against the document ID character and length boundary. **Copy block link** reads the editor's current cursor block and writes an absolute same-application URL so it can be shared outside the browser.

The page router retains a valid block fragment during initial replacement navigation. Once the editor is present, it finds the corresponding outer block, centers it, and displays a React-owned fixed overlay measured from that block. The overlay is pointer-transparent and remeasured on scroll and resize, avoiding attributes on BlockNote-owned DOM that can disappear during reconciliation. An unknown block ID leaves the page open without moving to a different location. Clipboard errors use the existing visible application error path.

## Alternatives

- Encode a block index or text excerpt: rejected because editing or moving preceding content would invalidate it.
- Put the block ID in a server-side redirect route: rejected because the client hash router can resolve the existing local workspace without another endpoint.
- Persist a highlight attribute on editor DOM: rejected because BlockNote owns and may replace those nodes.

## Consequences

Links remain valid while the identified page and block exist, including after titles and positions change. Deleting and recreating equivalent text does not revive the old link because it receives a different ID. The second hash delimiter is part of the application's fragment syntax and requires no server routing changes.

## Revisit when

The application moves to pathname routing, exposes block aliases, or needs direct links into table cells or inline text ranges rather than whole blocks.
