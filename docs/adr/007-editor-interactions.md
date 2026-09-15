# ADR-007: Image drop, block selection, and section movement

Status: Baseline; editor/browser spike pending.
Date: 2026-09-09.

## Context

The user requires smooth Notion-like browser interactions for dropped images, selection boxes, and moving sections. These are required features, not optional polish.

## Decision and rationale

- Backspace deletes the custom block/section selection as one editor transaction. Normalize selected descendants to their selected parent so nested content is removed once, and clear the selection afterward. Capture the key while a custom selection exists, including when the browser leaves focus on the document body after a gutter drag or toolbar click. Ignore input fields and keys outside the editor; clicking outside clears the selection. Suppress the click generated when a rectangle drag finishes, while ordinary text/input clicks return to text editing. Keep composition and modified shortcuts out of this handler; native editor selections retain BlockNote behavior. Deleting all blocks must leave a usable editor, and one undo restores a selected group.
- Checklist completion is available through the checkbox and Ctrl+Enter/⌘Enter. Capture the intended checkbox state at pointer-down above BlockNote's imperative input boundary, then reconcile once after the complete browser click/change sequence; use the pointer identity and movement threshold so a drag-away is not a click. Restore the captured editor/window scroll offsets after DOM reconciliation. Single-line plain-text paste inserts a text node at the exact inline selection, retaining the containing checklist, callout or other inline block; multi-line insertion inherits the active checklist type so pasted tasks cannot silently become paragraphs.
- Disable browser spellcheck for the document editor. Lotion pages routinely mix source code, product names, and languages, making a single browser dictionary's red underlines misleading; this does not alter or validate saved text.

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
