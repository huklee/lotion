# In-document search plan — three approaches

Written: 2026-09-13. Status: **plan for review; search is not implemented yet**.

The current search field in `apps/web/App.tsx` filters document titles in the sidebar. It does not search the current document body, count matches, or navigate to the previous or next match. Document content lives in the BlockNote/ProseMirror editor in `apps/web/Editor.tsx` and includes structures with different text locations, such as nested blocks, tables, and Mermaid source.

## Comparison

| Approach                                       | Interaction                                                                  | Scope                                      | Benefits                                                                                          | Cost and limitations                                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Use browser find                            | Document the existing ⌘F/Ctrl+F behavior                                     | Content rendered on the current screen     | Lowest implementation and maintenance cost                                                        | May search the sidebar too; behavior for collapsed content, inputs, and Mermaid source differs by browser; the application cannot control results   |
| 2. Current-document find panel **Recommended** | Use **Find in document** in the document menu or ⌘F/Ctrl+F inside the editor | Current document body                      | Focused results with a match count, highlighting, and previous/next navigation; no server changes | Must map positions during editing and navigate results in collapsed blocks and tables                                                               |
| 3. Document and workspace search               | Choose **Current document** or **All documents** in unified search           | Every saved document and the current draft | Can grow into cross-document knowledge search                                                     | Requires server-side text extraction, indexing, updates, authorization, reindexing after backup restoration, and draft-versus-saved-result handling |

## Approach 1 — use browser find

The work mainly adds help and shortcut guidance. The application should not try to open the browser find UI through JavaScript, and it must continue to leave the shortcut available to the browser.

Verification: confirm in all three browsers that the shortcut does not conflict with application behavior and can find visible document text. Do not promise results for collapsed or unrendered content. This is an interim option that does not fully satisfy the requirement for application-controlled search.

## Approach 2 — current-document find panel

### User experience

- Place a find panel at the top right of the document with a query field, `current match / total matches`, previous, next, and close controls.
- Enter moves to the next match, Shift+Enter moves to the previous match, and Escape closes the panel. Navigation wraps after the last or first result.
- Highlight every result and use a distinct color for the active result. Navigating scrolls its block into view.
- Case sensitivity is optional. Limit the first release to literal text search and review regular expressions and replacement later.
- Closing the panel restores the original editing position without changing document content or save state.

### Implementation design

Put text extraction and matching in `apps/web/document-search.ts`, and keep the panel in a separate `DocumentSearch.tsx`. Associate text from ordinary paragraphs, headings, lists, nested blocks, and table cells with block IDs and ProseMirror positions. Treat a match spanning formatting boundaries as one result. Handle the document title separately from the body. Search Mermaid source text rather than text inside the rendered image.

Use ProseMirror decorations for highlighting; do not write highlights into document JSON or save transactions. Do not highlight by directly modifying editor DOM outside React. Recalculate result positions after edits and undo, or update them through transaction mapping. Search dates by their stored ISO date text. When navigating to a result inside collapsed content, expand its ancestors and verify the interaction.

Use the existing 500-block performance fixture to target results within 100 ms of input. This is an acceptance target, not a measured result. Apply a short debounce and a displayed-result cap for large documents while clearly reporting the total match count and whether displayed results are truncated. Do not intercept shortcuts or input during IME composition.

### Acceptance tests

Cover English and composed-text input, empty queries, special characters, repeated words, no-match cases, formatting boundaries, tables, collapsed children, code, Mermaid source, and document switching. Result positions must remain valid after editing, deletion, and undo while search is open. Search alone must not trigger autosave or change document content. Include keyboard wrapping, focus restoration, accessible result-count announcements, and tests in all three browsers.

## Approach 3 — unified full-text search

Build a server-side full-text search API on top of the current-document search from Approach 2. Connect indexing to successful commits in `packages/persistence/repository.ts`, storing document ID, revision, title, body text, and block ID. Measure expected scale before choosing between a simple text index and a dedicated search store. The index must be reproducible derived data rather than a source of truth.

Limit authentication, query length, result count, and pagination at the API boundary. Return the document title, matching excerpt, and target block location. Update the index after deletion, restoration, import, and revision restoration, while isolating indexing failures so they cannot damage source-document saves. Merge the current unsaved draft on the client and distinguish it from server results. Replace the existing title-search UI with the unified search while ranking title matches first.

Verification includes result consistency after save, deletion, and restoration; restart and reindex behavior; prevention of authorization leaks; composed-text tokenization or substring rules; performance across 10,000 documents; and navigation to result blocks. This scope is substantially larger than Approach 2 and should be a separate milestone.

## Recommended sequence

Implement **Approach 2** first to provide current-document search. Expand to **Approach 3** if real usage shows a need for full workspace search. **Approach 1** can provide interim guidance until Approach 2 is ready. This document contains only the plan; choose an approach before setting the search implementation scope and version.
