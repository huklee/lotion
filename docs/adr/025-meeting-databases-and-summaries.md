# ADR-025: Meeting databases and on-demand summaries

- **Status:** Accepted (incremental; see progress in [meeting-db-progress](../meeting-db-progress.md))
- **Date:** 2026-10-16

## Context

Meeting notes are written as raw bullets in one page per topic, newest meeting first, with each meeting introduced inconsistently (a date mention paragraph, a date mention inside an H3, or plain "📅 YYYY-MM-DD" text). Reading by scrolling one topic page is the valued workflow. The owner wants each meeting to become a database row (long-term structure: date, type, attendees, status, summary link) while keeping that scroll-reading experience, and a one-button, on-demand summary in a Korean enterprise (Confluence-style) report format. External AI (Codex by default, Claude Code selectable) may be used; prompt and skill must be editable; completion is announced in a Slack channel. Email delivery is deferred.

The bounded database of [ADR-023](023-typed-database-rows.md) (one table view, add/rename properties, typed cells) is not enough for that.

## Decision

Build it in small, separately merged releases:

1. **Properties and rows (0.29.0):** change a property's type with value conversion, edit select options (rename follows values, removal clears them), move and delete properties, duplicate/move/delete rows (a deleted row's page goes to the trash; the row is removed immediately and restored if trashing fails). Menus render in a floating layer so the table's scroll container cannot clip them.
2. **Views (0.30.0):** saved views per database (table and feed), each with its own sort, filter (date range, select, text, checkbox) and visible properties, stored in the block next to columns and rows; old blocks get one default table view.
3. **Feed view:** row pages rendered one after another, newest first, read inline; the newest editable in place, any other opened beside the feed; a "New meeting" button creating a row from a template (date = today, defaults, body skeleton).
4. **Bulk selection and range helpers** used by summaries (select rows; filter presets such as this week).
5. **Migration:** one database per topic page; each meeting section becomes a row (date, title), originals kept untouched in an archive page; a preview table before applying.
6. **Summaries:** a server job runs the chosen engine (`codex exec` by default, `claude -p` selectable) headless and read-only with an editable prompt and a selectable skill, on one meeting, a block selection or several rows; the result is a summary page linked from the row(s) and a Slack notification.

Each step keeps the stored contract backward compatible: blocks without the new properties behave as before.

## Consequences

- Data model growth stays inside the database block's props (columns, rows, views) and ordinary child pages; no document schema version change.
- Trash and restore of a page no longer wait for the _parent_ page's draft (only a move rewrites parent page links on the server), which is also what lets a row be deleted right after other database edits.
- Summaries send the selected meeting text to the chosen external AI provider; this is explicitly accepted for this feature and shown at the point of use.
