# ADR-026: Personal issue tracker (Issues board, status notes, CLI)

- **Status:** Accepted. Stage 1 (MVP) is in 0.45.0; stages 2–4 follow in their own releases.
- **Date:** 2026-10-22

## Context

The owner wants a personal issue tracker inside Lotion rather than a separate app (Vikunja, Gitea, Kanboard and Kaneo were compared; Plane and OpenProject were rejected as too heavy). Requirements:

- local and open;
- a CLI that agents use to read, create and change issues;
- Vimium-like keyboard-only use;
- a kanban board with mouse drag between statuses;
- a comment-like status note thread per issue.

Pages and database blocks are whole documents saved with a revision precondition (If-Match). If an agent's CLI wrote to a board stored in a document while a browser had it open, the browser's next save would conflict. Issues therefore need per-record writes.

## Decision

Issues are a server-side store, not a document block.

- **Domain** (`packages/issues/model.ts`, pure):
  - Issue: `number`, `title`, `body` (Markdown), `status`, `labels`, `rank` (order inside the column), timestamps, `closedAt`, `version`, `notes`.
  - Note: `at`, `author`, `kind` (created / status / note), `text`, `from` / `to`.
  - Statuses default to Backlog / Todo / In progress / Done; the last status counts as closed.
  - Moving to another status adds a status note.
  - Ranks are fractional midpoints; a column is renumbered when a gap becomes too small.
- **Store** (`apps/server/issues.ts`):
  - `IssueStore` keeps `<data>/issues.json` (`next`, `seq`, `statuses`, `issues`).
  - One change at a time in a queue, with atomic temp-file + rename writes (the `FavoritesStore` pattern).
  - Every write bumps `seq`.
  - Numbers are never reused.
- **API**, behind the existing token / session check:
  - `GET /api/issues` (board summaries with `noteCount`/`lastNote`; filters `status`, `label`, `q`), `GET /api/issues/seq`
  - `POST /api/issues`, `GET|PATCH|DELETE /api/issues/:n`, `POST /api/issues/:n/move` (`status`, `before`), `POST /api/issues/:n/notes`
  - `PATCH` honours an optional `If-Match` version and returns 409 when it is stale.
  - Moves and notes need no version: they cannot lose another writer's change.
  - The author comes from `X-Lotion-Author` (default `me`).
- **Web** (`apps/web/issues/`):
  - `#/issues` board and `#/issues/:n` side panel, reached from the sidebar.
  - HTML5 drag and drop with an optimistic local move.
  - The board polls `seq` every 5 s while visible, so CLI changes appear.
  - The panel saves fields on blur with `If-Match`.
- **CLI** (`apps/cli/lotion.ts`, `bin/lotion`):
  - Commands: `lotion issue ls|show|new|move|note`, `--json`, `--as`.
  - Configured with `LOTION_URL` and `LOTION_TOKEN` / `LOTION_TOKEN_FILE`.
  - `run()` takes its I/O explicitly, so tests drive it against a real server.

## Stages

1. **MVP (0.45.0):** store, API, board with drag, issue panel, status notes, live refresh, CLI basics.
2. **Keyboard:**
   - Hints, `j/k/h/l` navigation, `⇧H/⇧L` card moves, `o`, `m`, `e`, `x`, `/`, `?` and `g i`.
   - Issue search and creation in the ⌘K palette.
   - Label and priority filters.
3. **Agents:**
   - An MCP server.
   - More CLI commands: `edit`, `close`, `label`, `search`, `claim`, `watch`.
   - Author badges.
   - Notifications for agent changes.
   - Conflict prompts in an open panel.
4. **Lotion integration:**
   - Issue ↔ page links, and "make issue" from a block or meeting action item.
   - Promotion of a long body to a page.
   - Archive of done issues, status and label settings, export.
   - A mobile board and simple statistics.

## Consequences

- Issue data lives outside the document repository: it is not part of page revisions, search, Markdown export or trash. Stage 4 adds links and export.
- A JSON file is adequate for a personal tracker (thousands of issues). The store has a small interface, so it could move to SQLite without changing the API.
- Polling adds a tiny request every 5 s per open board tab. A push channel is not needed at this scale.
