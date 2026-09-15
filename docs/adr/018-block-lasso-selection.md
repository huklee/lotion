# ADR-018: Notion-style block lasso selection

- **Status:** Validated
- **Date:** 2026-09-15

## Context

The original rectangle selector only covered a basic forward drag. It could interfere with native text selection, did not extend an existing selection, lost useful context while scrolling, and tied visual state to BlockNote DOM attributes that may disappear when the editor replaces block elements.

## Decision

Keep native selection when a pointer drag remains within its starting editable block. Transition to block lasso selection when the pointer crosses outside that block, or start lasso immediately from editor whitespace. Normalize the rectangle so every drag direction works. Shift, Command, or Control extends the prior selection; a plain lasso replaces it.

Hit-test in document coordinates and retain prior off-screen hits while the editor auto-scrolls near its top or bottom edge. If both a parent and its nested child intersect, retain only the ancestor so group operations do not duplicate a subtree. Render selection as fixed, pointer-transparent overlays measured from current block elements rather than persistent attributes on editor-owned DOM. Re-measure on selection, scroll, and resize. Existing Backspace and group-drag commands continue to consume stable block IDs.

## Alternatives

- Treat every content drag as a block lasso: rejected because it breaks ordinary text selection.
- Store selected state only as attributes on BlockNote nodes: rejected because editor reconciliation can replace those nodes.
- Select every intersecting nested block: rejected because moving or deleting a parent already covers its descendants.

## Consequences

Selection is transient UI state and does not change saved documents. A drag that begins in text and crosses into another block deliberately becomes block selection. Fixed overlays do not intercept clicks, but their geometry must be refreshed when the viewport changes.

## Revisit when

BlockNote exposes a stable native multi-block selection API, horizontal editor scrolling is introduced, or keyboard range extension needs to share a generalized selection model.
