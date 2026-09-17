# ADR-022: File and date reference semantics

- **Status:** Validated
- **Date:** 2026-09-17

## Context

The `@` picker could create page mentions or open a calendar, but calendar output was indistinguishable from ordinary text and files could only appear as block attachments or images. References need stable types so validation, rendering, keyboard behavior, navigation, search, and export do not depend on visible emoji or text patterns.

## Decision

Extend the existing `mention` inline node with `file` and `date` kinds. A file reference stores a bounded label and a canonical `/api/assets/<sha256>.<type>` URL. It uses the existing 20 MB upload boundary and immutable content-addressed asset store. Activating the chip fetches with the workspace authorization header and starts a browser download with the saved label, so token-protected workspaces behave the same as loopback workspaces. Cancelling the picker aborts an in-flight upload and inserts no reference.

A date reference stores an empty `href`, an ISO `YYYY-MM-DD` value, the same canonical label, and a calendar icon. Server validation rejects impossible calendar dates, mismatched labels, non-empty date links, and values on non-date reference kinds. The editor renders dates as semantic `<time datetime="…">` atoms. Enter selects picker actions, Enter in the calendar accepts the selected date, Escape cancels, and ArrowRight moves the caret beyond a date atom before adjacent text is entered.

Exact bundles preserve both typed nodes. Portable Markdown exports files as standard links and includes their immutable asset bytes; importing that Markdown intentionally creates an ordinary link because standard Markdown has no typed-reference marker. Dates export as readable `📅 YYYY-MM-DD` text and likewise import as text. This is an explicit interoperability loss, not silent exact round-trip behavior.

## Consequences

The document schema stays at version 1: the generic inline JSON envelope already supports optional properties, existing mention kinds remain valid without a `value`, and old readers can use portable Markdown. New exact snapshots require a client that knows the added kinds. File garbage collection must consider inline file mentions in addition to attachment blocks; the existing recursive asset scan already does so.

The `@` menu can match a page title and a built-in reference action at the same time. Tests select built-in actions by their explanatory text where ambiguity exists; normal keyboard filtering selects the first best-matching action.

## Alternatives

- Keep dates as emoji-prefixed text: rejected because validation, semantics, and future date behavior would rely on parsing presentation text.
- Store files as browser blob URLs: rejected because blob URLs expire, bypass canonical persistence, and cannot survive export or reload.
- Add Lotion-only Markdown syntax: rejected because portable Markdown should remain useful in standard tools; exact bundles already provide lossless application interchange.
