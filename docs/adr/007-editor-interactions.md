# ADR-007: Image drop, block selection, and section movement

Status: Baseline; editor/browser spike pending.
Date: 2026-09-09.

## Context

The user requires smooth Notion-like browser interactions for dropped images, selection boxes, and moving sections. These are required features, not optional polish.

## Decision and rationale

- Interpret selection boxes as rectangular multi-block selection initiated from the editor gutter. This preserves ordinary text selection inside block content. Offer Shift-based range selection and keyboard alternatives; Escape clears block selection.
- Use stable block IDs as the selection model. If parent and child are selected, normalize to the parent subtree once to avoid duplicate movement. Once the rectangle selects multiple blocks, both the visible selection handle and selected block surfaces expose one native drag payload for the normalized group.
- Show a precise insertion marker and auto-scroll near viewport edges while dragging. Commit only at a valid drop target; cancellation leaves the document unchanged.
- A section begins at a heading and includes following sibling blocks up to the next heading of equal or higher level, plus each included block's children. For nested headings, apply this boundary within their sibling container. Offer explicit section movement so a normal single-block drag remains predictable.
- Commit a multi-block or section move as one editor transaction so undo, selection restoration, and saving observe a coherent state. Preserve IDs; reject moves into the moving subtree.
- External file drops and internal block drags have separate payload handling. Dropped images insert placeholders in input order at the targeted position, with individual upload status. Completion replaces only the still-existing matching placeholder. The visible cancel action and removal must not allow an upload callback to resurrect a block; keyboard undo also cancels current pending uploads when the browser dispatches it to the application.
- Stage pending image bytes in browser draft storage when feasible; if storage fails, show a re-upload requirement. Persistent saved content references only committed assets.

## Alternatives and consequences

Native text selection alone does not satisfy block rectangle selection. Moving only the heading does not satisfy moving a section. A custom editor interaction layer may be necessary; test available core functionality first to avoid conflicting drag/selection handlers. No claim is made that BlockNote provides all these semantics unchanged.

## Evidence and revisit condition

Required tests: EDIT-07 through EDIT-10, ASSET-05/06, SAVE navigation/late-response regressions. Revisit editor choice if the M0 spike cannot implement these behaviors without unstable editor internals.
