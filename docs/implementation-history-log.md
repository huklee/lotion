# Implementation history log

## 2026-10-28T10:00:00+09:00 — 0.56.0 focus colours by reason

- **Model:** `focusState` checks the deadline before manual focus, so `reason` is `"due"` whenever the deadline is within 24 h or past, and a new `manual` flag still says whether Focus now was set by hand.
- **Styles:** `.issue-card.focus-now` uses `--focus-color` (renamed from `--focus-red`). It is blue `#1c7ed6` (dark `#4dabf7`) by default and red `#e03131` (dark `#ff6b6b`) for `[data-focus="due"]`; overdue stays `#c92a2a`. The ring, dot and pulse read the same variable.
- **Control panel:** shows a blue and a red sample.

## 2026-10-27T16:00:00+09:00 — 0.55.0 deadline calendar

- **`DatePicker`:** gains optional `initial`, `withTime` / `initialTime` (a time field, Today / Tomorrow / Next week shortcuts, and the time passed to `onInsert` as a second argument), `onClear`, `title` and `confirmLabel`. Its defaults keep the @date mention dialog unchanged.
- **`IssuePanel`:** the deadline `datetime-local` input became a button showing the deadline, which opens the dialog ("Set deadline"). The local date and time are converted to ISO on confirm.

## 2026-10-27T12:30:00+09:00 — 0.54.2 one clock for all Focus now effects

The owner saw a newly focused issue start its lap from the beginning. 0.54.1 aligned per-card CSS animations from JavaScript after each render (`startTime = 0`). That depends on render timing, and on the browser listing pseudo-element animations in `document.getAnimations()`. Now a single animation on the board (`.focus-clock`, also on the Control panel sample) animates inheritable custom properties: `--focus-angle` for orbit, `--focus-glow` for pulse. Each card's ring and glow only read them, so a card that comes into focus shows the board's current angle in its first frame. The animation runs only while the board has a card in focus (`:has(.focus-now)`). `syncFocusAnimations` was removed.

## 2026-10-27T11:30:00+09:00 — 0.54.1 Focus now animations in step

The owner found several dots circling at different angles dizzying. Each card's CSS animation began when the card was rendered. `syncFocusAnimations()` (in `focus-effect.tsx`) sets `startTime = 0` on every `focus-orbit` / `focus-pulse` animation through `document.getAnimations()`, so all run from the document timeline's origin. The board calls it after every render, and the Control panel calls it after changing the effect or speed.

## 2026-10-27T10:30:00+09:00 — 0.54.0 Focus now and deadlines

- **Model:**
  - Issues gain `focusedAt` (set by hand, cleared by any move into the last column, and refused while done) and `due` (an ISO date-time, normalised to UTC).
  - Create, patch and bulk accept `focus` and `due`.
  - Pure helpers: `focusState(issue, statuses, now)` returns manual / due-within-24 h / overdue and never applies to done issues; `dueLabel` formats the time left.
  - Focus from a deadline is derived, not stored, so it follows deadline edits and time without a background job.
- **Board:**
  - A 30-second clock re-evaluates focus as time passes.
  - Cards carry `focus-now` / `overdue` and `data-focus`, plus a deadline badge.
  - `n` toggles focus on the selection or the focused card; the bulk toolbar has a Focus button; the summary line counts issues in focus.
- **Panel:** a `datetime-local` Deadline field with a clear button, and a Focus now toggle (disabled when done) with an "in focus automatically" notice.
- **Effect:** `.issue-card.focus-now::after` draws a conic-gradient ring masked to the border, rotated through an `@property --focus-angle`; `pulse` animates the box-shadow instead.
- **Preferences:** `focus-effect.tsx` stores the effect (orbit / pulse / off) and speed (9 s / 6 s / 3 s) in localStorage and applies them as `data-focus-effect` and `--focus-cycle` on the root. Its Control panel component is self-contained and has a sample card. `prefers-reduced-motion` stops the animation.
- **Clients:** the CLI has `parseDue` (date = 23:59 local, date and time, ISO, +Nd/h/m, none), `focus` / `unfocus`, `--due` / `--focus` / `--unfocus`, `ls --focus` and ⚑ markers. The MCP tools take `due` / `focus`.

## 2026-10-25T23:55:00+09:00 — 0.53.0 description checkboxes, editable notes, Enter for notes

- **Renderer:** `markdownToHtml` adds `task-item` / `checked` classes and wraps each task's own text in `.task-text`, so a strike-through does not reach nested items. With `interactiveTasks` the boxes are enabled and numbered with `data-task`. The Confluence converter's output is unchanged.
- **Toggling:** `toggleTask(markdown, index)` finds the task list items with remark (GFM) and rewrites only that item's marker, using its source position. The panel flips it on click and saves through the usual `save("body")` path, so conflicts still raise the Keep mine / Use theirs prompt.
- **Notes:**
  - The model gains `editNote` and `deleteNote` (written notes only; `editedAt` / `editedBy`), with `PATCH|DELETE /api/issues/:n/notes/:id`.
  - `IssueNoteItem.tsx` renders a note with edit, delete-with-confirm, and an inline editor; Esc stays inside the note.
  - The shared `enterSubmits` helper (Enter submits, Shift+Enter breaks the line, ignored during IME composition) replaces ⌘/Ctrl+Enter for notes.
- **Styles:** the checkbox colour is `--task-done` (#2f9e44, or #51cf66 in dark themes) through `accent-color`.

## 2026-10-23T03:30:00+09:00 — 0.52.0 multi-select and bulk changes

- **Model:**
  - `bulkSchema` takes 1–500 numbers and one change (status, priority, addLabels/removeLabels, archived), or delete alone.
  - `bulkIssues` applies status moves in board order, so cards keep their order, with status notes; it skips issues that would not change and returns the numbers changed (in numeric order) or deleted.
- **Store and API:** `IssueStore.bulk` saves everything as one write. `POST /api/issues/bulk` adds a single bell notification for non-`me` authors.
- **Clients:** `issueClient.bulk` and `parseNumbers` (lists and ranges), the CLI `bulk` command and the MCP `bulk_update` tool.
- **Board:**
  - Selection is a `Set`, kept only for cards still shown. ⌘/Ctrl+click toggles, ⇧+click selects a range in board order from the last toggled card, and each card has a checkbox.
  - Keys: `v` selects, `⇧V` selects all shown, Esc clears.
  - s, p and t open bulk menus (`KeyPicker`, or `BulkLabels` with `+a -b`); x marks all done or back; a archives; Delete asks through a `KeyPicker` whose default is Cancel.
  - `BulkBar` is the bottom toolbar.

## 2026-10-23T02:00:00+09:00 — 0.51.0 keyboard editing of issue fields, hints on every control

- **Keymap:** `issue-keys.ts` adds `d` (description), `s` (status), `p` (priority) and `t` (labels). With no card focused, board keys act on the issue open in the panel.
- **Menus:** `KeyPicker.tsx` is a small menu with number keys, j/k/arrows, Enter and Esc. It listens in the capture phase, and the board's handler stands aside while it is open. Status uses the move endpoint (status note included). Priority uses a new version-less `issuesApi.set`.
- **Panel:** focus requests now cover `description` (opens the editor, cursor at the end) and `labels`. The description editor saves with ⌘/Ctrl+Enter.
- **Hints:** `visibleControls()` collects on-screen buttons, links and fields outside the cards. Their hints are fixed-position labels allocated after the cards'. `activate()` focuses fields, opens selects with `showPicker` where allowed, and clicks everything else.

## 2026-10-22T23:50:00+09:00 — 0.50.0 Markdown in issues, fluid board columns

- **Renderer:** `packages/markdown/render-html.ts` (`markdownToHtml`) reuses the static Markdown → Confluence converter's HTML output, which already escapes raw HTML and neutralises unsafe links. It adds `target="_blank" rel="noopener noreferrer"` to web links.
- **Panel:** `IssuePanel` shows the description as rendered Markdown (a `region` named Description). A click outside links and checkboxes, or the ✎ button, switches to the textarea, and blur switches back. The textarea stays open while a conflict involves unsaved description text. Notes render the same way.
- **Styles:** `.issue-markdown` styles live in `issues.css`; `white-space: pre-line` keeps single newlines.
- **Columns:** `flex: 1 1 0; min-width: 240px`, phones keep one column per screen, and the old panel-open override was removed.
- **Focus fix:** the panel's focus request no longer expires after 3 s. It applies to requests made when that panel opened, so a slow load under test load still focuses the title or note box (a CI-only failure of the keyboard spec).

## 2026-10-22T17:30:00+09:00 — 0.49.0 home, go-to shortcuts, Korean-layout shortcuts

The owner asked for:
- shortcuts that work while the keyboard is in Korean;
- recent changes on Home;
- shortcuts to Home and Issues;
- the logo opening Home.

What changed:
- **Key reading:** `apps/web/keyboard-layout.ts` (`latinKey`) maps non-ASCII, `Process` and `Unidentified` keys to the US-layout character of their physical `code`, with Shift giving upper case and the shifted punctuation. The issue board's handler and hint typing use it.
- **Go-to shortcuts:** `useGoToIssuesShortcut` became `use-go-shortcuts.ts` (`g` + letter, ignoring composition and text fields), with `h` for Home and `i` for Issues.
- **App:** Home and Recent changes became the `showHome` and `showChanges` callbacks, shared by the sidebar, the shortcuts and Home's "See all". Both call `announceRoute()`; without it, `pushState` left the issue route active and the board stayed on screen.
- **Logo:** the sidebar logo is now a button labelled "Lotion home".
- **Home:** `ChangesView` exports `ChangeRow` and `HomeRecentChanges` (the latest 6 from `/api/changes`), and `WorkspaceHome` renders them between the page cards and the import tip.

## 2026-10-22T16:00:00+09:00 — 0.48.0 Lotion integration (stage 4 of ADR-026, last stage)

- **Model:** `links`, `source`, `archivedAt` and their normalisation; `page` and `archived` filters; `setStatuses`, `renameLabel`, `archiveColumn`, `issuesToMarkdown`.
- **Store and API:** `setStatuses`, `renameLabel`, `archiveColumn`, `export`, and routes for config, labels, archive and export.
- **Web:**
  - `block-issue.tsx` holds `BlockIssueContext`, `issueFromBlock` (title from the first line, nested blocks as a list, a "From …" line), `createIssueFromBlock` and `IssueCreatedToast` (success or error).
  - `DragHandleMenu` gains **Create issue**. `PageIssues` sits under the page title. `IssueSettings` is the columns and labels dialog.
  - Board: a menu (settings, show archived, Markdown/JSON export links), Archive on the last column, the summary line, and snap columns at ≤650 px.
  - Panel: linked pages with a picker, source block navigation, move description to a page, and archive/unarchive.
- **App:** passes pages, `openPage` (with block flash) and tree refresh to the board, mounts the toast, and `openPage` dispatches the issues-route event.
- **CLI:** `archive`, `unarchive`, `link`, `unlink`, `export` and `ls --archived`.

## 2026-10-22T14:30:00+09:00 — 0.47.0 agents: MCP server, CLI, badges, notifications, conflicts (stage 3 of ADR-026)

- **Shared client:** `apps/cli/issues-client.ts` holds the HTTP client and the `resolveStatus`, `workingStatus`, `editLabels` and `diffBoards` helpers. The CLI was rewritten on top of it, with `edit`, `label`, `claim`, `close`, `reopen`, `search`, `rm` and `watch` (abortable; Ctrl+C via `main.ts`).
- **MCP:** `apps/mcp/issues-mcp.ts` (`createMcpServer` and `serve`), `apps/mcp/main.ts` and the `bin/lotion-mcp` wrapper.
- **Model:** `updatedBy`, set by every change.
- **Server:** `notifyIssue` in `app.ts` records `issue.changed` notifications for non-`me` authors. Notifications accept an `issue` number.
- **Web:**
  - The bell opens issues through a new `openIssue` prop (App → Topbar → Bell).
  - The board refreshes the bell when it sees an outside change.
  - Cards show an `updatedBy` badge, and agent note authors are marked.
- **Panel:** conflict detection in `show`, a `resolve(keepMine)` choice, and a 409 that now raises the prompt instead of dropping the edit.
- **Development:** to keep the live server's `dist` on `main`, development moved to the git worktree `~/Work/lotion-dev` (with `node_modules` linked); `~/Work/lotion` only checks out `main` for deploys.

## 2026-10-22T13:00:00+09:00 — 0.46.0 keyboard-only Issues board (stage 2 of ADR-026)

The owner asked to continue through stages 1–4, merging each stage after its tests pass.

- **Keymap:** `issue-keys.ts` covers board navigation, card moves (`J`/`K` inside a column; `H`/`L` across columns, including empty ones; `x` done or back), open/edit/note/new/filter/hints/help, Vimium-style hint labels and hint matching.
- **Board:** `IssuesView` uses a capture-phase key handler, a focused-card state with explicit focus requests (a tick counter so closing the panel refocuses the same card), a hint overlay, a filter bar (text, label, priority) and a non-modal shortcuts dialog. `IssuePanel` gains a priority select and `focus` requests for title and note.
- **App:** `useGoToIssuesShortcut` (`g i`), with the sidebar and the shortcut sharing one `showIssues` callback. The ⌘K palette renders `IssueSearchResults` (matching issues and "New issue"). The help panel mentions `g i`.
- **Data, API and CLI:** `priority` in the model (Zod enum, default none, normalised on load) and the `priority` list filter in the API; the CLI accepts `--priority` on `new` and `ls`.

## 2026-10-22T11:30:00+09:00 — 0.45.0 Issues board and CLI (stage 1 of ADR-026)

The owner chose to build a personal issue tracker into Lotion (direction B: a server-side store, not a database block) and approved four stages, MVP first.

- **Domain:** `packages/issues/model.ts`, pure, with Zod schemas. It covers create, move (fractional ranks; a column is renumbered when the gap collapses; a no-op move changes nothing; a status note on every status change; `closedAt` set in the last column), patch (a status change moves the issue to the end of the new column), notes, filters and author parsing.
- **Store:** `apps/server/issues.ts` `IssueStore`. It writes `<data>/issues.json` atomically from a serial queue and bumps `seq` on every write; `If-Match` on PATCH is answered with 409 when stale.
- **API:** routes under `/api/issues` in `app.ts`, wired in `main.ts` and in the e2e server.
- **Web:** `apps/web/issues/`.
  - `IssuesView` is the board: HTML5 drag with a drop line and an optimistic move; `c` and the column **+** open quick-add.
  - `IssuePanel` saves fields on blur with `If-Match`. On 409 it shows a notice and reloads. Deletion is confirmed in the panel.
  - `issues-api` polls `seq` every 5 s while visible. `issues-route` handles `#/issues/:n` (pushState plus an internal event). `board-order` holds the drop-position helpers and label colours.
  - App, sidebar (Issues button) and top bar (breadcrumb) were adjusted. App's start-up no longer opens the first page when the address is an issues route.
- **CLI:** `apps/cli/lotion.ts`, a testable `run(argv, io)` with `apps/cli/main.ts` and `bin/lotion` (a symlink-safe tsx wrapper).

## 2026-10-20T09:30:00+09:00 — 0.44.1 duplicate view switch removed

Owner report: Meeting notes showed two pairs of Table / Feed tabs. The 0.38.0 toolbar layout switch duplicated the view tabs (most visibly in Meeting logs, which starts with a Feed and a Table view); it was removed from `DatabaseViewBar` together with its CSS. Feed views are added through the tab bar's "+" (Add view), as before.

## 2026-10-19T14:30:00+09:00 — 0.44.0 new paste engine by default; phone page/tree views prepared

Owner decisions: the new paste engine is better — make it the default; on phones show the page view and the tree view separately, never both. `engine-choice.ts` now returns v2 unless Classic was chosen. Running the existing paste suites against v2 exposed real gaps, fixed in `paste-v2.ts`: Notion-style merge for multi-line pastes inside or at the end of a line (first line inline before the cursor, Enter split via BlockNote, middle blocks before the tail, last line inline at the tail's start), verbatim insertion of a single plain line (no trimming), Lotion block-selection copies inserted after the current line without splitting, and `safeLinks` turning non-http(s)/mailto/page links from text or Markdown into plain text (the text path could otherwise create `javascript:` links). The Classic-specific test "clipboard lines are saved as plain text…" was replaced by a safety test for both text and HTML pastes. Phone layout: `useMediaQuery("(max-width: 650px)")`, `mobileView` ("page" | "tree") with the app classes `mobile mobile-page|mobile-tree`, a fixed `MobileViewSwitch` tab bar (safe-area aware), tree actions and opening pages switch to the page view, the top-bar ☰ opens the tree, and the desktop rail toggle is hidden on phones.

## 2026-10-19T12:00:00+09:00 — 0.43.0 Confluence export prepared

Owner request: a Markdown → Confluence HTML converter without AI (static only), used to copy from Export, and a Confluence-format preview. `packages/confluence/convert.ts` parses with remark (GFM) and walks the tree with fixed rules into two renderings: storage format (`ac:task-list`/`ac:task`, `ac:structured-macro` code with CDATA split around "]]>", Confluence's language set with aliases and "none" fallback, Mermaid titled, `toc` for Lotion's TOC comment, `ac:image`/`ri:url`, header-row tables with alignment and `<br />` for empty cells) and editor-pasteable HTML (task checkboxes, code panels, `img`). Mixed task/plain Markdown lists are split into runs; unsafe link protocols become "#"; raw HTML is escaped. `use-workspace-transfer.ts` gains `pageConfluence` (current draft → Markdown with title → converter) and `copyPageConfluence` (ClipboardItem with text/html + text/plain storage; storage-only fallback). `ExportPanel` adds Copy for Confluence and Preview; `ConfluencePreview.tsx` renders the HTML in a `sandbox=""` iframe with Confluence-like CSS and shows the storage source.

## 2026-10-19T10:30:00+09:00 — 0.42.0 server favorites and collapsible sidebar prepared

Owner requests: favorites were per browser (localStorage) — manage them on the server; and a minimize option for the left panel with collapse/expand at its top. `apps/server/favorites.ts`: `FavoritesStore` keeps ordered page ids in `<data>/favorites.json` (validated ids, 500 cap, serialised add/remove with atomic writes so concurrent devices do not lose changes); routes `GET /api/favorites`, `PUT|DELETE /api/favorites/:id`. App: favorites load from the server on start and whenever the tab becomes visible; toggling is optimistic with rollback on failure; a browser's old `lotion-favorites` are uploaded once and removed. Sidebar: a Collapse/Expand button in the workspace row (`aria-expanded`), `sidebar-mini` grid column of 60 px and an icon rail; button labels moved into `.label` spans that stay readable to assistive technology (visually hidden in the rail) with `title` tooltips; a rail-only New page button; state in `lotion-sidebar-mini`.

## 2026-10-19T03:00:00+09:00 — 0.41.0 paste engine v2 (preview) prepared

Owner request: formatting keeps breaking on paste; rebuild paste from scratch, compare old and new, and wait for final approval. Audit of the classic path: it never reads `text/html`; structure is recognised only when pasting into an empty paragraph and every line is a heading or list item; otherwise one paragraph per line with indentation left as spaces; code/list targets receive loose paragraphs. New modules in `apps/web/paste/`: `text-blocks.ts` (line-based plain text → blocks: indentation unit detection and nesting without skipped levels, bullet/number/task/heading/quote markers incl. •·◦▪‣, inline Markdown only where present, fenced code, Markdown tables, blank lines kept once for notes and dropped for Markdown), `html-clean.ts` (Google Docs guid wrapper, inline-style formatting to tags, `aria-level` and Word `mso-list` nesting, Notion checkboxes, loose text split into paragraphs at `<br>`, presentation attributes, unsafe links and non-web images removed; monospace colour-only HTML such as VS Code falls back to text), `paste-v2.ts` (source order, list-type continuation, supported code languages, schema size check, inline vs block placement with BlockNote's own Enter for splitting, cursor at the end of the paste), `engine-choice.ts` (per-browser choice, default Classic). The editor schema gains a "text" code language. `tests/e2e/paste-lab.spec.ts` + `paste-fixtures/cases.ts` hold 13 realistic clipboard payloads; with `PASTE_LAB_OUT` both engines run and write outlines + screenshots (used for the owner's comparison page), otherwise it is the v2 golden regression suite. Firefox blanks script-made `DataTransfer` data, so the suite runs in Chromium and WebKit (identical results).

## 2026-10-19T00:30:00+09:00 — 0.40.0 browser sessions prepared

Owner request: stop asking for authentication repeatedly; once authenticated, a session should be enough. The web client kept the token in `sessionStorage`, i.e. per tab. `apps/server/sessions.ts`: `SessionStore` (random 256-bit ids, only SHA-256 hashes persisted in `<data>/sessions.json` with mode 600, 90-day sliding expiry written at most hourly, expired entries pruned). `createApp` accepts either the Bearer token or a valid `lotion_session` cookie; `POST /api/session` requires the token itself (a session cannot mint sessions) and sets the cookie (HttpOnly, SameSite=Strict, Secure unless the Host is loopback or when forwarded as https); `DELETE /api/session` revokes it. The existing Origin/Sec-Fetch-Site checks remain. Client: the unlock dialog calls `startSession` and no longer stores the token; `upgradeLegacyToken` converts a tab's old token once; Control panel → "Sign out of this browser". Asset URLs now load through the cookie as well.

## 2026-10-18T23:20:00+09:00 — 0.39.1 delete keeps unselected nested blocks prepared

Owner report: deleting one block also deleted its nested blocks although they were not selected. Two paths did that: block-selection Backspace (`removeBlocksPreservingHierarchy` skipped a selected block's whole subtree) and BlockNote's default handle-menu "Delete" (`editor.removeBlocks`). `removeBlocksPreservingHierarchy` now removes only selected ids and splices a removed block's (recursively processed) children into its place; `withDescendants` lets "Select section" select nested blocks explicitly so section deletion is unchanged. `apps/web/DragHandleMenu.tsx` replaces the side menu (`sideMenu={false}` + `SideMenuController`) with the same items, except that "Delete" uses the helper on the block or the selection containing it. The block-selection highlight only ever covered a block's own row, which matches the new rule.

Second owner report in the same release: Backspace kept pushing the next line's indent. Probing eight structures in a real browser showed BlockNote's Backspace at the start of a nested paragraph *lifts* it (ProseMirror lift re-parents the following siblings under it) and that merging a block with children moves the children to the top level. `apps/web/backspace.ts` handles Backspace at the start of a paragraph that is nested or has children, before BlockNote (capture listener on the editor host, only for this editor's own text): an empty line is removed (its children join the line above), a non-empty line's inline content and children are appended to the target — the previous sibling's last visible descendant, or the parent for a first child — inside one `editor.transact` (one undo step), and the cursor is put at the join. Top-level lines without children and list items keep BlockNote's behaviour.

## 2026-10-18T22:30:00+09:00 — 0.39.0 notifications and meeting links prepared

Owner requests: a top-right notification list of events such as newly created meeting notes, in time order, opening the page on click; and a link to each new meeting at the bottom of its parent page. `apps/server/notifications.ts`: `NotificationService` keeps `{items, seenAt}` in `<data>/notifications.json` (newest first, 500 kept, zod-validated kind/title/detail/pageId, serialised atomic writes); routes `GET /api/notifications`, `POST /api/notifications`, `POST /api/notifications/seen`. `SummaryService` reports finished jobs through a new `events` option (`summary.done` → the summary page, `summary.failed` → the first source). Client: `NotificationBell` in the top bar (unread badge, portal panel grouped by day, relative times, click → `openPage`, opening marks read), `recordNotification` for `meeting.created` from Meeting logs, and `refreshNotifications` after summary jobs. New meetings insert a page-mention paragraph at the end of the page through the page's own editor (before a trailing empty paragraph), so it merges with the open draft instead of racing a server-side edit. The two page conversions done on 2026-10-18 are recorded as `meetings.imported` events after deployment.

## 2026-10-16T19:30:00+09:00 — 0.38.0 Meeting logs block and layout switch prepared

Owner requests: make the feed easy to reach from view selection (list/feed); rename the meeting-optimised database to "Meeting logs" and keep a plain database without the meeting features. The database block gains an optional `variant` prop ("" or "meetings", validated); `meeting-logs.ts` builds the preset (title, Date/Type/Attendees, Feed + Table views sorted by date) inserted by the new "/Meeting logs" slash item. `DatabaseBlock` derives `meetings` from the variant: meeting entry creation (today's date, "회의" title, skeleton, prepend) and every summary entry point (feed, row menu, selection bar, toolbar settings) are limited to it, while a template row now applies to both kinds. `DatabaseViewBar` adds a segmented Table | Feed control that changes the active view's type (adding a date-descending sort for a new feed without sorts) and a "Database type" select in the view menu. E2E seeds for meeting scenarios set `variant: "meetings"`.

## 2026-10-16T18:00:00+09:00 — 0.37.0 top-bar wide page toggle prepared

Owner request: a wide page view control at the top right. `WorkspaceTopbar` gains a pressed-state icon button ("Wide page", Maximize2/Minimize2) bound to the existing per-browser `pageWidth` preference (`comfortable` ↔ `wide`), so it stays in sync with Control panel's "Page width" and persists across reloads.

## 2026-10-16T17:00:00+09:00 — 0.36.0 Notion-style database UI prepared

Owner request: "database 사용 UI가 너무 구려 — Notion database를 참고해서 전면 개편". New `apps/web/DatabaseTable.tsx` (typed header buttons → `PropertyMenu`, "+" header → type picker then the new property's menu, gutter checkboxes, title cell with hover ⋯, `Cell` editors: borderless inputs, colored select pills, right-aligned numbers, "+ New" footer and count) and `apps/web/database-ui.tsx` (lucide type icons, option pill colors from the theme-aware `--lotion-<color>-background/text` palette, date formatting). `PropertyMenu` gains a name field and view actions (sort, filter-by — which adds a rule and opens the filter editor through a `filterRequest` counter —, hide). `DatabaseViewBar` gets icon buttons, a quick-search field (client-only, title + text/number values), a primary "New" slot, and chips for active sorts/filters. `DatabaseBlock` now composes header title (new optional `title` prop, validated ≤ 200), view bar, table/feed and a floating selection bar; the bottom "Property type / Add property" bar is gone. CSS: Notion-like rules; `.lotion-database table.ldb-table` must out-rank BlockNote's global `.ProseMirror table { table-layout: fixed; width: 100% }`, which had squeezed columns so the title button slid under the next cell; feed bodies reset BlockNote's nesting margin/guide (their group is inside the page's group); the whole-block selection overlay is replaced by a light outline for databases. Tests moved from header inputs to header menus ("Property name", "Add a property").

## 2026-10-16T15:00:00+09:00 — 0.35.0 Control panel summaries, format editor, Slack channel picker prepared

Owner requests: choose the Slack channel in Control panel; a meeting-note format editor in Control panel whose presets can be used per summary. Server: the fixed styles became `DEFAULT_PRESETS` and settings now hold `presets` (1–30, unique slug ids, label ≤ 60, hint ≤ 200, rules ≤ 8000) with `style` as the default preset id (falls back to the first preset when it disappears); jobs resolve the preset by id (unknown → 400) and record `styleLabel`; `GET /api/summary/default-presets` serves the built-ins for "restore"; `GET /api/summary/slack-channels` lists channels through the local bridge (`bridgeChannels`, derived from the notify URL; 503 when not configured). Client: `summary-styles.ts` keeps one shared preset cache (`useSummaryPresets`, `publishSummaryPresets` after a save) used by the split summary button and the row menu; `SummarySettingsForm` has `compact` (database popover) and `full` (Control panel: prompt + `PresetEditor`) variants; `SlackChannelField` offers the bridge's channel list with a typed-id fallback. `slk-bridge` (outside this repository): its loopback listener gained `GET /channels` (channels the bot joined, plus configured ones), and `/notify` now also accepts channels the bot has joined.

## 2026-10-16T13:30:00+09:00 — 0.34.0 summary condensing styles prepared

Owner request: summaries much more concise and decision-focused, with the condensing selectable from the menu. `apps/server/summaries.ts` adds `STYLES`/`STYLE_RULES` (brief, actions, standard, detailed); the prompt gains a "축약 방식" section stating that its length/structure rules outrank the skill. The structure moved out of `DEFAULT_PROMPT` (now rules only) into the styles; `settingsSchema` upgrades a saved copy of the old default prompt and adds `style` (default `brief`); jobs accept `style` and record it, and the summary header names it. Client: `SummarizeButton` (main action = default style, ▾ = `Condensing` menu) in the feed and selection bar, the four styles in the row menu, and a "Default condensing" select in settings; `summary-styles.ts` is a leaf module so `DatabaseMenus` and `summaries` do not import each other. Verification found that the shared `Floating` menu closed on any document scroll — including layout-shift scrolls when the feed reloads after a summary and scrolling inside the menu — so it now repositions on scroll, closes only when its button leaves the viewport, and opens upwards when space below is short. Real Codex with the brief style on a sample meeting returned 핵심 (2 lines), 결정 사항 (1) and 액션 아이템 (3) only. CI (both runs) then failed the Firefox "new meeting from a template" step (row never appeared; not reproducible locally in 10 loaded repeats): the title-sync effect wrote back the render-time table, which can drop a row added a moment earlier by an async action, so it now applies titles to the block's latest state; `updateLatest` reports whether it applied and a new meeting that could not be added now shows an error instead of vanishing; CI uploads `test-results/` (screenshots, traces) on failure.

## 2026-10-16T12:10:00+09:00 — 0.33.0 meeting summaries prepared

The owner moved summaries ahead of the remaining database steps ("6단계 먼저, 4·5단계는 필요한 것만"); row selection and period presets from step 4 ship here because multi-meeting summaries need them, and the topic-page migration (step 5) is deferred. `apps/server/summaries.ts`: `SummaryService` keeps settings in `<data>/summary-settings.json` (zod-validated; Slack channel must be an id), lists skills from `~/.claude/skills` and `~/.codex/skills` (SKILL.md frontmatter), and runs one job at a time — sources are exported with `toMarkdown` (optionally only selected blocks and their children), the prompt is skill body + editable request + sources, the engine runs headless (`codex exec --sandbox read-only -o` / `claude -p` with write, shell and web tools disallowed) in an empty temp folder with a 15-minute limit, and the Markdown result (a fenced wrapper is removed) becomes a 📝 page under the meeting or database page via `fromMarkdown`, prefixed with engine/skill/date and source links. Notifications go to the local Slack bridge (`LOTION_SLACK_NOTIFY_URL`, default `http://127.0.0.1:47833/notify`); a failed notification is recorded on the job, never fails it. Routes: `GET/PUT /api/summary/settings`, `GET /api/summary/skills`, `GET/POST /api/summary/jobs`, `GET /api/summary/jobs/:id`. Client: `apps/web/summaries.tsx` (job polling, status toasts, settings form) reached through `RowPagesContext.summarize`; entry points in the feed, row menu, selection bar and the editor's block-selection toolbar. E2E servers use a deterministic stand-in engine. Real engines were smoke-tested on a sample (Codex 8 s, Claude 9 s). Separately, `slk-bridge` (not in this repository) gained a loopback-only `/notify` listener that accepts no browser requests and posts only to channels configured in its `config.json`.

## 2026-10-16T10:10:00+09:00 — 0.32.0 version panel prepared

Requested by the owner: a version system visible in the app with a per-PR change log. `vite.config.ts` defines `__LOTION_VERSION__` (package.json), `__LOTION_COMMIT__` (`git rev-parse --short HEAD`, empty when unavailable) and `__LOTION_BUILT_AT__`. `apps/web/VersionPanel.tsx` bundles `docs/changelog.md` (`?raw`) and renders it through `packages/changelog/parse.ts` (release headings with optional PR link, `###` sections, nested items, wrapped lines, inline bold/code/links) as React elements — no HTML injection; links are limited to https and docs-relative paths resolved against the GitHub docs folder. The last opened version is remembered per browser (`lotion-seen-version`) for the unseen dot and "new" tags. Changelog headings for 0.7.0–0.31.0 were linked to their pull requests by reading `package.json` at each first-parent merge commit on main; the versioning guide and AGENTS.md now require the PR link.

## 2026-10-16T09:30:00+09:00 — 0.31.0 database feed view prepared

Step 3 of [ADR-025](adr/025-meeting-databases-and-summaries.md). `apps/web/DatabaseFeed.tsx` renders the view's rows as entries; read-only bodies are BlockNote's own `blocksToFullHTML` output from the validated stored blocks (cheap, no editor per entry), loaded lazily via `IntersectionObserver` and reloaded when the page revision changes. Editing in place mounts `InlineRowEditor`, a full `Editor` bound to the row page's `SaveCoordinator`; `App.tsx` now creates coordinators through `coordinatorFor(doc)` (extracted from `openPage`) and exposes it, the theme, shortcuts and the editor component through `RowPagesContext` (`row-pages.ts`) so the database block never imports `Editor` (import cycle editor-schema → DatabaseBlock → Editor). Nesting findings: the outer ProseMirror ignores keyboard events from the inner editor (tiptap `NodeView.stopEvent` returns true for contenteditable targets) but handled `mousedown` and created a NodeSelection of the whole database block; the block now stops `mousedown` at its section, the inline editor stops pointer/click events at its wrapper, and the selection overlay is hidden while focus is inside the database (DOM selection inside the node view still maps to a node selection). New meetings fill the body (template blocks with fresh ids, or a skeleton) and flush it before the row is inserted, so the feed opens the finished page; feed entries are prepended so same-day meetings also read newest first. The block gains a `template` prop (row href). The "Add view" button now opens a Table/Feed chooser.

## 2026-10-16T02:20:00+09:00 — 0.30.0 saved database views prepared

Step 2 of [ADR-025](adr/025-meeting-databases-and-summaries.md). `packages/database/views.ts` is a pure module: `readViews` parses the block's new `views` prop (missing/empty → one default table view; malformed JSON is rejected by document validation; rules pointing at deleted properties are dropped instead of failing so deleting a property never invalidates a block), `applyView` filters (AND) and sorts (stable, empties last, select by option order, numeric-aware text), `relativeRange` gives local-time ranges for today/this week (Monday start)/last 7/30 days/this month, and `filterDefaults` derives new-row values from equality filters. `apps/web/DatabaseViews.tsx` adds the tab bar and the Filter/Sort/Properties popovers, reusing the floating layer (`Floating`, now exported). The active view id is per-viewer (`localStorage`, guarded); views themselves live in the block. New rows are appended to the block's latest state (`updateLatest`) instead of the state captured at click time. The view type `feed` is already accepted by the parser for step 3.

## 2026-10-16T01:41:01+09:00 — 0.29.0 database properties and rows prepared

First step of [ADR-025](adr/025-meeting-databases-and-summaries.md) (meeting databases and summaries; progress in [meeting-db-progress](meeting-db-progress.md)). `packages/database/model.ts` gains pure, validator-checked operations: `changeColumnType` (value conversion; text→select derives bounded options from distinct values), `setSelectOptions` (renames carry values, removals clear them), `removeColumn`, `moveColumn`, `moveRow`, `removeRow`, `insertRowCopy`. `apps/web/DatabaseMenus.tsx` adds the property and row menus, rendered through a portal (`position: fixed`) because the table's horizontal scroll container clipped absolutely positioned menus and let the actions bar intercept clicks in Firefox and WebKit. Row duplicate uses a new non-navigating `copyPage`; row delete removes the reference immediately, trashes the page and restores the row on failure, and async results apply to the block's latest state (`updateLatest`) instead of the state captured at click time. `mutate` now returns success and only flushes/guards the parent pages for moves: trash and restore do not modify the parent on the server, and guarding them made a delete right after a table edit fail with "Resolve the unsaved draft". `apps/web/Editor.tsx` remains above the 1,000-line review threshold (pre-existing, +6 lines of action plumbing).

## 2026-10-15T10:57:39+09:00 — 0.28.0 recent changes open at the edit prepared

Each revision change records the first added/changed block id (a sitting keeps its newest one); opening an entry waits for that block to render, scrolls it to the centre with the bounded scroll helper and applies a one-shot CSS pulse (`apps/web/block-flash.ts`; static highlight under reduced motion), giving up silently when the block is gone. Shipped separately because 0.27.0 was merged before this follow-up.

## 2026-10-15T09:59:53+09:00 — 0.27.0 recent changes feed prepared

Added a workspace-wide recent-changes feed. `packages/persistence/changes.ts` compares a revision with its predecessor (block identity across nested children: added/removed/changed, title, parent/position, trash state) and groups newest-first revisions into per-page sittings (30-minute window). `packages/persistence/change-feed.ts` walks every page's revision chain backwards with a k-way merge over a max-heap, reading only the snapshots needed for the requested page plus a stop rule that waits until no older revision can extend a returned sitting; results are cached per (page, revision) because snapshots are immutable, and missing snapshots are skipped (bounded). The repository exposes `changes()` and a guarded `readRevision` (manifest head from memory, refuses symlinks, validates the envelope); the server adds `GET /api/changes` with validated `limit`/`before`. The web app adds `ChangesView` (day groups, kind badges, block counts, excerpt, load-more) behind a sidebar button and the `#/changes` address, including direct loads; opening a trashed page's entry shows the Trash and resets the address.

## 2026-10-08T14:09:05+09:00 — 0.26.1 bounded table-of-contents scrolling prepared

Both the right-hand outline and the inline `/toc` block used `scrollIntoView({ behavior: "smooth" })`, whose duration grows with distance and which follows a target that keeps moving while blocks render. `apps/web/scroll-to.ts` replaces it with a requestAnimationFrame animation on `.main-scroll`: duration `min(650, 180 + 9·√distance)` ms, cubic ease-in-out (acceleration then deceleration), the target re-measured each frame and clamped to the scroll range, cancellation on wheel/touch/pointer/key input or a newer jump, and an instant jump for `prefers-reduced-motion`. Measured before/after on 4.7k–54k px jumps: Chromium 1.1–1.5 s → ~0.65 s, Firefox ~0.85–1.0 s → ~0.65 s, WebKit ~0.22 s → ~0.65 s (all browsers now behave the same).

## 2026-10-06T14:49:55+09:00 — 0.26.0 bulk checklist toggle on selections prepared

Ctrl/Cmd+Enter now checks every checklist item inside the current selection. Text selections are resolved from the ProseMirror range (an item counts when the selection covers its inline content, not when it only touches an edge); block selections use the selected subtrees, so nested items are included. The target state is "check all unless all are checked" and is applied in one editor transaction (one undo step). The editor flushes ProseMirror's pending DOM selection before reading it, because a mouse selection is only imported on the asynchronous `selectionchange` event — without it a shortcut pressed immediately after Shift+click acted on the previous collapsed cursor (seen in Chromium tests). Pure helpers live in `packages/editor-adapter/checklist.ts`.

## 2026-09-30T13:41:40+09:00 — 0.25.0 automatic right-hand page outline prepared

Added a right-hand page outline that renders for every page with headings. Heading extraction moved from the inline `/toc` block into the pure `apps/web/document-outline.ts` module, which both the block and the new `DocumentOutline` panel use; the active-document view keeps the live block list from the editor's existing change callback, so the outline follows edits without extra editor coupling. A scroll-position function selects the current heading from the reading line and, once the scroll container reaches its end, promotes the last visible heading. This end-of-page rule was added after the first browser regression showed that a short final section could never become current.

Unit coverage validates nested extraction, mention labels, reading-line and end-of-page selection, and relative indentation. New production-build scenarios cover listing, live updates, click-to-scroll with the current-section marker, and hiding on heading-free pages and narrow windows in Chromium, Firefox, and WebKit. Full verification is recorded in [test results](test-results.md); user data under `data/` was untouched.

## 2026-09-20T06:45:13+09:00 — 0.24.1 modified sidebar click stabilization prepared

Audited PR #40 after its successful pull-request checks and found that the separate post-merge `main` workflow had failed on the existing Chromium modified-sidebar-click scenario. The sidebar previously returned early for `Ctrl/Cmd` clicks and depended entirely on native anchor handling inside a draggable page row. Under GitHub runner load, Chromium intermittently produced no new-page event and exhausted the test timeout.

The sidebar now handles an unshifted primary `Ctrl/Cmd` click as an explicit user-initiated `window.open` with `noopener,noreferrer`, while ordinary clicks keep application navigation and middle/Shift/Alt gestures retain browser-native behavior. During full-gate stress, WebKit also exposed a dropped pointer release on the draggable row's **Duplicate** and **Add child** controls; those actions now execute on the initial primary pointer press while retaining their keyboard click path. The real-browser clipboard regression now verifies removal through the persisted document model instead of counting transient BlockNote wrappers.

The modified-click and row-action production-build scenarios each passed 30/30 across Chromium, Firefox, and WebKit. The final complete gate passed ESLint, strict TypeScript, the production build, all 194 unit/integration tests, and 184 Playwright scenarios with 2 intentional skips. Full verification is recorded in [test results](test-results.md); user data under `data/` was untouched.

## 2026-09-20T00:49:23+09:00 — 0.24.0 hierarchical page-move tree prepared

Replaced the page-move dialog's flat destination list with a recursive, accessible document tree. Every branch starts expanded and provides explicit expand/collapse controls; nested rows retain workspace order, icons, and visible depth. The current page and its complete descendant subtree are removed before rendering, so the UI cannot request a cyclic move. A pure projection boundary keeps hierarchy construction independently testable and uses bounded traversal for malformed orphaned or cyclic input.

Direct unit coverage validates ordering, subtree exclusion, hidden nodes, orphan recovery, and cycle bounds. The production-build move workflow passed 3/3 across Chromium, Firefox, and WebKit, including nested rendering, collapse/expand, descendant omission, move execution, and dialog dismissal. Full verification is recorded in [test results](test-results.md); user data under `data/` was untouched.

## 2026-09-19T16:22:18+09:00 — 0.23.0 upper-right page duplication prepared

Added an accessible **Duplicate page** icon action beside the existing favorite, move, and trash controls in the upper-right page toolbar. It delegates to the repository-backed duplication workflow already used by the sidebar, so content copying, navigation, revision preconditions, and nested-parent links remain one implementation.

The new active-draft regression exposed and fixed the prior ordering gap in that shared workflow: coordinators now flush first, then the client refreshes the source revision used by `If-Match`. This guarantees a toolbar copy includes the latest title and blocks instead of failing after the flush increments the revision. Focused results and the complete gate are recorded in [test results](test-results.md); user data under `data/` was untouched.

## 2026-09-19T15:39:26+09:00 — 0.22.0 parent-page hierarchy links prepared

Added a repository-level managed-link boundary for sidebar hierarchy operations. Child creation can explicitly request a parent link, page moves remove that stable managed block from the former parent and ensure it in the destination, and the new sidebar duplicate action copies one page beside its source and links the copy from their parent. Each multi-document change is exposed through the existing atomic manifest commit, uses retry receipts where applicable, and leaves ordinary user-created links untouched. The `/page` command deliberately keeps its current editor-owned link insertion to prevent duplicates.

The client flushes any loaded source/destination drafts before hierarchy mutations, distinguishes an unloaded page from an unsaved editor, and reloads an affected parent that is currently open so its new revision and link appear immediately. Regression coverage spans repository, HTTP, and all three browser engines, including movement to the root, retries, immediate parent rendering, and `/page` coexistence. Version 0.22.0 is a backward-compatible feature release with no document schema migration. Detailed execution evidence is in [test results](test-results.md); user data under `data/` was untouched.

## 2026-09-19T10:50:57+09:00 — 0.21.2 selected-block keyboard clipboard fix prepared

Reproduced the reported failure with the normal user shortcut: a rectangle-selected mixed group followed by `⌘C / Ctrl+C` never entered the selected-block copy function, leaving only the editor's native plain-text behavior. A capture-phase keyboard boundary now routes unmodified copy and cut shortcuts to the same validated asynchronous operation used by the toolbar; inputs and custom controls retain their native clipboard behavior, and cut still waits for a successful write.

Expanded regression coverage beyond the prior synthetic toolbar case: all three engines exercise keyboard copy/paste into existing content and keyboard cut; Chromium additionally uses the real system clipboard, reloads the page between copy and paste, then restores a nested bullet/checklist group. Unit cases cover standard and custom block types, styles, nesting, fresh IDs, persisted-session recovery, disabled storage, unrelated text, and malformed data. Focused results and the complete gate are recorded in [test results](test-results.md). User data under `data/` was untouched.

## 2026-09-19T10:32:24+09:00 — 0.21.1 exact selected-block paste fix prepared

Fixed the gap between portable Markdown copy and safe literal paste. After a successful selected-block clipboard write, Lotion now keeps a schema-validated copy record in memory and session storage. An exact subsequent clipboard-text match restores the original block structures with fresh IDs, preserving mixed paragraphs, headings, lists, checklist state, nesting, and inline styles. The portable system clipboard remains Markdown, while unrelated external Markdown continues through the established literal/limited-outline paths.

Focused unit coverage passed 23/23 and the new production-build paste regression passed 3/3 across Chromium, Firefox, and WebKit, including save/reload. The complete gate is recorded in [test results](test-results.md). User data under `data/` was untouched.

## 2026-09-19T10:05:00+09:00 — 0.21.0 structured block reconstruction prepared

Added a narrow recognizer before the established line-by-line clipboard path. On an empty paragraph it accepts only input whose every non-empty line is a heading or unordered/ordered/checklist item, parses it through the shared Markdown converter, and rejects warnings plus any inline links or styles. This reconstructs list nesting and checked state while keeping mixed prose, HTML, rich Markdown, and mid-line/checklist/callout paste literal. The selected-block Markdown exporter is covered directly against the recognizer.

Focused unit coverage passed 7/7 for exported blocks, single/multiple structures, nesting, ambiguity, and unsafe/rich inline rejection. The full clipboard browser specification passed 15/15, and a narrower structured-versus-literal rerun passed 6/6 across Chromium, Firefox, and WebKit. The complete gate is recorded in [test results](test-results.md). User data under `data/` was untouched.

## 2026-09-19T09:45:36+09:00 — 0.20.1 selected-block dismissal fix prepared

Closed the missing dismissal path inside the editor host. The window-level pointer guard continues clearing selection for outside/application controls, ordinary editor clicks and completed text selections now clear it locally, and modifier-assisted rectangle extension keeps its previous selection base. The selected-block toolbar carries an explicit ownership marker so its drag, clipboard, movement, and clear controls are not dismissed during pointer capture.

The focused production-build matrix covers selecting two blocks, clicking another editor block, clicking the page-title control, lasso extension, and selected-group clipboard controls. It passed 9/9 across Chromium, Firefox, and WebKit. The complete gate is recorded in [test results](test-results.md). User data under `data/` was untouched.

## 2026-09-19T01:28:05+09:00 — 0.20.0 selected-block group actions prepared

Extended the existing rectangle-selection toolbar instead of creating a second block-action surface. Its left grip now owns the selected-group drag payload, while dedicated copy and cut controls serialize the selected topmost subtrees as structured Markdown in document order. If both an ancestor and descendant are selected, the ancestor's subtree is emitted only once. Cut calls the same hierarchy-preserving deletion path as Backspace, but only after the asynchronous clipboard write succeeds.

Direct unit coverage verifies subtree order and ancestor de-duplication. Production-build browser coverage exercises group drag plus heading/checklist Markdown copy, cut, save, and reload in Chromium, Firefox, and WebKit. The focused matrix passed 6/6 after correcting a strict test locator that matched BlockNote's outer and inner wrappers; this was a test-only failure after the feature assertions had succeeded. The complete gate is recorded in [test results](test-results.md). User data under `data/` was untouched.

## 2026-09-19T01:07:54+09:00 — 0.19.1 checklist terminal-newline fix prepared

Reproduced the remaining paste defect with both a single visible line and multiple visible lines whose clipboard payload ended in a line delimiter. The existing checklist transaction interpreted the delimiter's final empty split element as another requested checklist item, which separated the current suffix and produced an unwanted blank row.

Centralized clipboard line normalization and added an inline-checklist option that removes exactly one terminal delimiter. Internal blank lines and ordinary paragraph paste semantics remain unchanged. Regression coverage first failed with three items instead of two and a displaced suffix, then passed 6/6 across Chromium, Firefox, and WebKit after the fix; direct unit coverage includes CRLF and intentional internal/trailing blanks. The complete gate is recorded in [test results](test-results.md). User data under `data/` was untouched.

## 2026-09-19T00:43:55+09:00 — 0.19.0 combined color presets prepared

Replaced the formatting toolbar's independent text/background menus with exactly ten coordinated presets. A preset applies the same stable portable color key to both inline style dimensions, so existing document serialization remains valid while the menu, configurable shortcuts, and repeat-last action have one consistent meaning. Browser-local shortcut settings migrate from the former `textColors` shape, and either kind of legacy session style migrates to its combined preset.

Adjusted dark and black background values toward their neutral canvases to create softer, low-chroma pastel fills. Direct unit checks enforce a maximum RGB chroma spread of 24 for those backgrounds and 4.5:1 text/background contrast for every named preset in all three schemes. Production-build browser checks exercise the actual computed colors and the full toolbar, shortcut, session, persistence, and reload paths in Chromium, Firefox, and WebKit. The complete local gate is recorded in [test results](test-results.md). User data under `data/` was untouched.

## 2026-09-19T00:27:30+09:00 — 0.18.0 session-wide last color style prepared

Moved the last-applied text/background color from an editor-instance-only ref to a small validated session-storage boundary. Both toolbar application and direct color shortcuts record the same session value; the repeat-last shortcut reads it after page navigation or a reload. Malformed/unknown values are ignored, and storage write failures do not block immediate formatting. The value remains tab-session-local rather than entering document content, workspace storage, or exports.

Unit coverage passed 6/6 for shortcut interaction plus session round-trip, invalid data, and unavailable storage. The new navigation/reload scenario passed 3/3 across Chromium, Firefox, and WebKit. The final release gate passed lint, strict TypeScript/build, 173/173 unit/integration tests, and 156/156 Playwright cases in a 2.4-minute browser phase. Version 0.18.0 is a backward-compatible minor release with no document-schema or user-data migration. Publication evidence follows.

## 2026-09-19T00:16:48+09:00 — 0.17.0 typed arrow substitution prepared

Added one focused Tiptap input-rule extension that converts `<-` and `->` to `←` and `→` as the second character is typed in ordinary rich-text blocks. The rule is undoable and inherits Tiptap's composition and code-node guards. It does not run through Lotion's plain-text paste path, custom Mermaid textarea, or native form controls, so literal technical input is preserved. Tiptap Core is now an explicit dependency rather than an undeclared transitive import.

The requested seven-item editor sequence is recorded in `docs/remained_job.md`; only this first item is complete. A three-browser regression verifies both conversions, literal paste/code behavior, save, and reload. The first focused attempt reached all feature assertions but timed out by clicking Shiki's hidden mirror element; positioning a real selection in the editable code node corrected the test boundary. The focused rerun passed 3/3, and the final release gate passed lint, strict TypeScript/build, 170 unit/integration tests, and 153/153 Playwright cases. Version 0.17.0 is a backward-compatible minor release with no document-schema or user-data migration. Publication evidence follows.

## 2026-09-19T00:02:11+09:00 — 0.16.0 architecture documentation reconciled

Audited the architecture, roadmap, ADR index and foundational interaction/portability records against the version 0.16.0 implementation. Documentation now names the implemented source modules, flat immutable asset/revision paths, recovery archive files, synchronous import/export routes, authenticated asset retrieval, SSRF-bounded link previews, browser-local ownership boundaries, typed database scope, conservative conflict handling, derived search index, current performance measurements, and retention limitations. Removed obsolete proposed cache/history paths and claims that link previews or remote Linux CI were still pending.

The roadmap now separates successful Ubuntu / Node 24 GitHub Actions coverage from filesystem durability that CI does not establish, records the current 170 unit/integration and 150 browser-case release gate, and summarizes post-MVP capabilities. Missing ADR-012 through ADR-014 index entries were restored; ADR-007, ADR-008, ADR-010 and ADR-011 statuses/evidence now point to the implemented suites. This documentation-only correction retains version 0.16.0 and does not change application behavior, storage, or user data. ESLint, strict TypeScript, Prettier, `git diff --check`, and local-link validation passed; remote CI evidence follows after publication.

## 2026-09-18T06:41:50+09:00 — direct-to-main delivery workflow established

Corrected the repository workflow after feature pull requests were stacked on other feature branches, allowing GitHub to mark intermediate PRs merged without integrating their changes into `main`. The root agent instructions and development/version guides now require one branch created from current `origin/main`, one PR whose base is `main`, successful required checks, an actual merge, and ancestry verification before the next backlog item begins. Documentation-only workflow correction; no application version change.

## 2026-09-18T00:05:09+09:00 — 0.16.0 storage diagnosis and reconciliation prepared

Added an offline workspace doctor because storage corruption can prevent the web application from starting. Its read-only inventory distinguishes committed history from future/unknown orphan snapshots and reports missing files, symlinks, malformed JSON, envelope/schema failures, external semantic changes, missing parents, and hierarchy cycles without logging document bodies. Version-1 manifests now record canonical document hashes after legacy workspaces pass existing validation.

Reconciliation requires a reviewed plan bound to the exact report token. It rechecks state under the writer lock, copies only named valid sources into revisions greater than every known/manifest revision, validates the full resulting hierarchy, archives the old manifest/report/plan, and atomically publishes without deleting or overwriting snapshots. Focused repository/doctor coverage passed 24/24 after regressions exposed and fixed revision-number reuse when a manifest-referenced latest file was missing and required complete integrity maps after legacy migration. [ADR-024](adr/024-storage-diagnostics-and-reconciliation.md) records why automatic candidate selection and orphan deletion remain forbidden. The final CI-equivalent gate passed lint/type/build, 170 unit/integration tests, and 150 browser cases in 171.25 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T23:46:39+09:00 — 0.15.0 typed database row pages prepared

Replaced `/database`'s ordinary table alias with a dedicated validated custom block. One table view supports bounded text, number, select, checkbox, and date properties. Every row is created as a normal child document, opens through application navigation, and derives its visible title/icon from the current tree. The shared database model owns parsing, bounds, typed values, search text, and Markdown formatting; the React block owns only editing and page actions. [ADR-023](adr/023-typed-database-rows.md) records the deliberately excluded view/query/formula scope.

Focused model/schema/Markdown/search/portability coverage passed 47/47 and the create/edit/save/reload/navigate/rename browser flow passed 3/3 across Chromium, Firefox, and WebKit. The new exact-bundle test exposed that internal links inside serialized database props initially bypassed generic URL remapping; the bundle mapper now handles typed row links and the regression passes. The final CI-equivalent gate passed lint/type/build, 164 unit/integration tests, and 150 browser cases in 165.67 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T23:26:07+09:00 — 0.14.0 file and date references prepared

Extended the existing custom mention node instead of introducing emoji/text heuristics. `@date` now inserts an ISO-validated semantic time atom, and `@file` opens an accessible picker that uploads through the established 20 MB content-addressed asset boundary. File activation performs an authenticated fetch before starting a named browser download; cancelling the picker aborts an in-flight request. The picker, download behavior, and reference renderer remain separate from the editor composition root, which stays below the project's automatic 1,000-line refactoring threshold.

[ADR-022](adr/022-file-and-date-references.md) defines persistence, keyboard, navigation, and portability behavior. Exact bundles preserve both types. Portable Markdown emits a bundled standard file link and readable date text, and importing that portable form deliberately yields ordinary link/text nodes. Schema/Markdown/portability coverage passed 34/34, and the complete date/mention group passed 18/18 across Chromium, Firefox, and WebKit. The final CI-equivalent gate passed lint/type/build, 154 unit/integration tests, and 150 browser cases in 149.52 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T07:53:11+09:00 — 0.13.0 typed mentions and bounded preview freshness prepared

Replaced text-shape inference with a validated BlockNote `mention` inline type for page and external references. Raw pasted URLs retain native link semantics and underlined presentation, while mention chips render their icon and label separately. Page-tree updates immediately reconcile internal mention titles/icons. Existing internal links and links with saved preview metadata migrate on open; exact bundles preserve the new type, portable Markdown emits visible links, and search/TOC extraction includes mention labels.

Added optional preview fetch timestamps, stale-on-hover refresh with per-URL client de-duplication, and refreshed external chip labels. The refresh lifecycle is isolated in a dedicated hook instead of expanding the editor component. The backend canonicalizes URLs and keeps only successful results in a process-local 15-minute, 256-entry LRU without bypassing existing concurrency, DNS, redirect, MIME, size, or SSRF controls. [ADR-021](adr/021-reference-chips-and-preview-cache.md) records the boundaries. Focused tests passed 57/57 and the three-browser interaction group passed 9/9. After narrowing an existing image assertion away from ProseMirror's hidden cursor separator, the final CI-equivalent gate passed lint/type/build, 149 unit/integration tests, and 147 browser cases in 173.64 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T07:33:51+09:00 — 0.12.1 IPv4/NAT64 link previews prepared

Replaced single-answer DNS pinning with a filtered set of public answers passed to Node's IPv4/IPv6 family selection. Mixed DNS responses discard non-public candidates instead of rejecting a usable public candidate, while every redirect still performs fresh validation and the socket lookup remains pinned to the approved set. Added explicit decoding for RFC 6052's well-known /96 and RFC 8215's local-use /48 NAT64 forms; their embedded IPv4 destination must satisfy the existing public-address policy, preventing translation to loopback, private, link-local, carrier-grade NAT, documentation, or other special-use ranges.

The focused security suite, strict type checking, and lint passed. A live production-mode server with an isolated temporary workspace fetched the supplied Tistory page, parsed its OpenGraph metadata, cached the remote preview image, and served that local JPEG successfully. The final CI-equivalent gate passed lint/type/build, 140 unit/integration tests, and 144 browser cases in 147.26 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-17T07:12:23+09:00 — 0.12.0 backend-indexed workspace search prepared

Selected an adapted unified-search approach after the user requested backend indexing and consideration of OpenSearch. Added a replaceable search-index boundary, an in-process index rebuilt from canonical revisions at startup, commit-time revision replacement, hidden-page filtering, a validated search API, and shared extraction for titles, nested rich text, tables, attachment labels, code, and Mermaid source. The browser debounces/cancels requests, merges the active unsaved draft, reports exact counts, opens matching block deep links, and restores editor focus on close.

OpenSearch remains a future adapter rather than a mandatory service because the current single-workspace 10,000-document fixture searches in 14.22 ms and reconstructs on startup in 2.24 seconds. [ADR-020](adr/020-backend-workspace-search.md) records the operational and consistency tradeoff. Focused unit/integration, three-browser navigation, repeated focus, and performance gates passed. The final CI-equivalent gate passed lint/type/build, 134 unit/integration tests, and 144 browser cases in 143.71 seconds. Publication evidence follows. User data under `data/` was untouched.

## 2026-09-16T23:03:58+09:00 — 0.11.0 integrated system settings prepared

Prepared the sixth and final requested incremental pull request. Reorganized the existing control panel into system appearance, editor/startup, and formatting sections; added five validated workspace-font choices; and applied the selected font immediately to both application chrome and BlockNote's actual theme root. Font state uses the existing browser-local compatibility reader, persists across reloads, and participates in the combined display reset without entering document storage or exports.

Focused preference tests and nine repeated cross-browser settings cases passed. The first browser test correctly identified BlockNote's internal font-variable boundary, which the final implementation now addresses. The final CI-equivalent gate passed lint/type/build, 128 unit/integration tests, and 138 browser cases in 143.37 seconds. Commit, push, pull-request, and remote CI evidence are recorded separately when complete. User data under `data/` was untouched.

## 2026-09-16T22:50:57+09:00 — 0.10.0 accessible pastel color system prepared

Kept BlockNote's portable `default`, gray, brown, red, orange, yellow, green, blue, purple, and pink keys so existing documents and shortcuts remain valid. Centralized the nine hue pairs for light, dark, and black instead of inheriting different library defaults. The preference lifecycle now applies the palette immediately, and a persistent black scheme uses BlockNote's dark component chrome with a true-black application canvas.

Unit tests calculate WCAG contrast for every text/canvas and default-text/background pair. A browser regression measures computed DOM colors in all three schemes and verifies black persistence. It initially demonstrated that BlockNote's more-specific dark selector defeated the application override; the production selector now matches that specificity. Focused palette repetitions passed 9/9 across three engines, and the full settings group passed 12/12. An unrelated stale-caret assumption exposed by the first full gate was aligned with adjacent explicit selection synchronization and passed 12/12 Chromium repetitions. The final CI-equivalent gate passed lint/type/build, 127 unit/integration tests, and 138 browser cases in 142.39 seconds. Prepared backward-compatible minor release 0.10.0 with no schema migration or user-data change. Publication evidence is recorded separately.

## 2026-09-16T22:41:29+09:00 — 0.9.0 page-aware browser favicon prepared

Added a focused favicon module that generates escaped SVG data URLs for existing page-icon metadata and updates one owned `<link rel="icon">` element. The application derives the favicon from the save coordinator's live content, so an icon-picker change appears immediately, while route changes follow the newly active document. Missing page icons use the same `📄` fallback as the editor; non-page routes and the initial HTML use a stable Lotion `L` mark.

Unit tests cover custom/default icons, XML escaping, and the application fallback. A repeated three-browser regression covers immediate edits, page navigation, missing icons, and Home reset. The final CI-equivalent gate passed lint/type/build, 123 unit/integration tests, and 135 browser cases in 140.88 seconds. Prepared backward-compatible minor release 0.9.0 with no schema migration or user-data change. Publication evidence is recorded separately.

## 2026-09-16T22:34:38+09:00 — 0.8.0 precise nested block-lasso hit testing prepared

Found that every `.bn-block-outer` bounding box includes its descendants. The lasso therefore reported the parent as intersecting when a drag touched only a nested child's visible row, and the existing ancestor de-duplication correctly—but undesirably—removed the child. Selection hit testing now measures the direct block content row instead. The parent remains selected, with its complete subtree overlay and existing group actions, when the drag crosses the parent's own row.

Added a direct browser regression that selects only a nested child and proves its parent is absent from both selection state and overlays. The broader lasso group passed 27/27 repeated cases across Chromium, Firefox, and WebKit. The final CI-equivalent gate passed lint/type/build, 120 unit/integration tests, and 132 browser cases in 135.97 seconds. Prepared backward-compatible minor release 0.8.0; no stored document format or user data changed. Publication evidence is recorded separately.

## 2026-09-16T22:27:15+09:00 — 0.7.2 Mermaid editor input isolation prepared

Reproduced the reported Mermaid editor failure as an event-ownership defect. Because a custom Mermaid textarea sits inside the editor shell while the ProseMirror cursor remains on its previous block, Ctrl/Command+Enter could toggle a stale checklist and Alt+Shift+Arrow could move a document block instead of remaining local to source editing. Editor-level capture and bubble shortcuts now ignore native form controls; global application save remains handled separately.

Strengthened the existing Mermaid scenario to type source character by character instead of using an atomic field fill. Added a regression that proves checklist state and surrounding block order remain unchanged while editing Mermaid source. The two scenarios passed 18/18 focused repetitions across the three browser engines, including render, error recovery, persistence, and reload. The final CI-equivalent gate passed lint/type/build, 120 unit/integration tests, and 129 browser cases in 135.36 seconds. Prepared patch version 0.7.2; no document schema or user data changed.

## 2026-09-16T22:21:50+09:00 — 0.7.1 checklist paste fix prepared

Replaced block-node insertion for multi-line text pasted into a checklist with one chained editor transaction that inserts each line through the checklist's normal Enter behavior. This preserves the current item's prefix, moves its suffix onto the final pasted checklist line, retains checklist types, avoids the synthetic empty paragraph produced by inserting closed block nodes at an inline selection, and keeps the paste as one editor transaction. Single-line checklist and callout paste behavior is unchanged.

Cleaned `docs/remained_job.md` so it contains only active work, registered the six newly requested tasks in order, and marked only this first item complete. Prepared patch version 0.7.1 under the version guide; the document schema and stored user data are unchanged. The complete two-worker browser suite passed 126/126 cases, all 120 unit/integration tests passed, and focused checklist coverage passed repeatedly in every browser. A flaky ordinary-text Backspace test now asserts its actual one-character-edit contract without assuming where an automated click places the caret. User data under `data/` was untouched.

## 2026-09-16T20:32:57+09:00 — Repository text standardized in English

Translated the remaining Korean documentation, test fixtures and date-command aliases into English. The document-search proposal keeps its original three alternatives and recommendation, while README links now describe it in English. Test data still covers Unicode through emoji without retaining Korean words. The folder-import browser assertion now targets its semantic imported heading instead of waiting on the complete editor container. A tracked-file content and filename audit found no remaining Hangul outside the protected `data/` directory.

This cleanup does not add product behavior, change storage formats or require a version increment; version 0.7.0 remains correct. Lint, strict type checking, 28 focused unit/integration tests and 36 related cross-browser cases passed. Full-gate attempts exposed the already requested checklist newline regression and a separate WebKit test-process stall, both recorded in the test results rather than folded into this translation change. User data under `data/` was untouched.

## 2026-09-16T20:06:30+09:00 — Large TypeScript candidate refactoring completed

Completed the remaining work in the large-file refactoring plan. `App.tsx` fell from 1,847 to 716 lines after extracting workspace presentation, dialogs, preferences, transfer workflows and conflict actions. `Editor.tsx` fell from 1,695 to 799 lines after extracting suggestion, checklist, paste-link and overlay lifecycles. The 2,144-line workspace browser specification was replaced by ten product-area specifications; all 41 original scenarios remain, and the largest resulting specification is 457 lines.

No TypeScript or TSX file now exceeds the automatic 1,000-line threshold. The two remaining 501–1,000-line files are accepted framework composition roots: each retains stateful library coordination while feature behavior lives behind focused props or hook contracts. This reduces shared-file conflicts and makes feature ownership visible without manufacturing pass-through layers. Version 0.7.0 remains correct because application behavior, public APIs and stored data formats are unchanged. User data under `data/` was untouched.

The final `npm run check` passed ESLint, strict TypeScript, the production build, 120/120 unit and integration tests, and 126/126 Playwright cases across Chromium, Firefox and WebKit in 153.39 seconds. A Chromium native modified-click assertion exposed an intermittent Playwright wait on an already-rendered background tab; the navigation specification now tests its actual contract—correct new-tab URL and unchanged opener—and passed 12/12 focused repetitions before the complete gate. The known non-failing production chunk-size warning remains.

## 2026-09-16T07:09:03+09:00 — First TypeScript module-boundary slice completed

Applied the new structure rules to `Editor.tsx` without changing editor behavior or document formats. The 1,695-line component is now 1,223 lines. Block lasso/selection state and browser lifecycles moved to a 286-line hook; direct block-link reveal and measurement moved to a 79-line hook; the shortcut-aware formatting toolbar moved to a 145-line leaf component; and legacy code-language normalization moved to a 48-line pure module. Six direct unit cases now cover normalization without mounting BlockNote. Direct-link browser coverage moved out of the congested workspace specification, and a 24-line shared E2E seed helper provides the seam for subsequent feature splits.

The result improves testability and conflict isolation while keeping the extracted modules in the preferred 0–500-line ranges. `Editor.tsx`, `App.tsx` and `workspace.spec.ts` remain automatic candidates, so they are recorded as incremental follow-ups rather than being mechanically split in this branch. No version increment was made: this is an internal, backward-compatible refactor with no new feature, fix, API or data-format change. User data under `data/` was untouched.

The final `npm run check` passed lint, strict TypeScript and the production build, 120/120 unit and integration tests, and 126/126 browser cases across Chromium, Firefox and WebKit in 141.67 seconds. Focused selection coverage passed 24/24 browser cases before the full run, and the separated direct-link scenario passed 3/3. Build chunk-size warnings remain the previously tracked non-failing issue.

## 2026-09-16T06:54:18+09:00 — TypeScript structure rules established

Created the mandatory pre-refactoring rules in [TypeScript file and module structure rules](typescript-file-structure.md). The baseline measured 10,103 TypeScript/TSX lines and identified only three automatic candidates: the 2,144-line workspace browser specification, 1,847-line application component and 1,695-line editor component. Recent history also concentrates changes in those files. Persistence and Markdown files in the 200–500-line healthy range are explicitly deferred because they already have cohesive responsibilities.

The first implementation slice is constrained to editor selection/direct-link lifecycles and their browser-test boundary. It must improve isolated testing and conflict locality without changing document persistence or user data. This entry records the rules before any production code is moved; verification evidence follows after implementation.

## 2026-09-15T14:20:47Z — 0.7.0 direct block links prepared

Prepared backward-compatible minor release 0.7.0 as the sixth and final requested incremental item. Added a cursor-aware **Copy block link** action that copies an absolute stable-ID URL. Centralized strict page/block hash construction and parsing, retained deep fragments during initial page loading, and allowed internal deep links to use the existing history-aware router. Target blocks are centered and identified by a React-owned fixed overlay that follows scrolling/resizing without mutating BlockNote-owned DOM. Missing targets keep the requested page and URL open without selecting an unrelated fallback. See [ADR-019](adr/019-direct-block-links.md).

Focused URL unit tests, lint/type/build and the three-browser direct-link scenario passed before the full gate. The final `npm run check` passed lint/type/build, 114 unit/integration tests and 126 browser cases in 143.62 seconds. It covers success, fresh navigation, target reveal, clipboard denial and deleted-target behavior. User data under `data/` was untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T14:09:46Z — 0.6.1 hierarchy-preserving deletion prepared

Prepared patch release 0.6.1 as the fifth requested incremental item. Replaced selected-block deletion's direct multi-node editor removal with an immutable tree transform that drops selected subtrees while retaining unselected parents, siblings and descendants at the same depth. The transformed hierarchy is applied in one replace transaction, retains stable IDs, leaves one editable paragraph when everything is deleted, and remains a single undo step.

Focused unit tests, lint/type checks and nine deletion browser cases passed before the full gate. The final `npm run check` passed lint/type/build, 111 unit/integration tests and 123 browser cases in 139.63 seconds. The three-browser regression checks both persisted `children` relationships and rendered indentation after reload. Existing section deletion/undo and rectangle deletion cases passed. User data under `data/` was untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T14:00:35Z — 0.6.0 Notion-style block lasso prepared

Prepared backward-compatible minor release 0.6.0 as the fourth requested incremental item. Block lasso selection now normalizes every drag direction, extends with Shift/Command/Control, auto-scrolls near vertical editor edges, retains off-screen hits, and removes redundant nested hits when an ancestor is selected. A drag kept within one editable block remains native text selection; crossing into another block transitions to lasso selection. Fixed, pointer-transparent viewport overlays replace selection attributes on editor-owned DOM so BlockNote node replacement no longer removes the visible selection. Existing selected-block Backspace and group dragging continue to use stable block IDs. See [ADR-018](adr/018-block-lasso-selection.md).

Focused geometry unit tests and 15 lasso/selection browser cases passed across all three engines. The final `npm run check` passed lint/type/build, 109 unit/integration tests and 120 browser cases in 141.06 seconds. The release changes transient interaction state only, requires no document migration, and leaves user data under `data/` untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T11:21:54Z — 0.5.0 configurable color shortcuts prepared

Prepared backward-compatible minor release 0.5.0 as the third requested incremental item. Extended the control panel with capture fields for every text color and the repeat-last action. Chords use a platform-neutral `Mod` representation, reject unsafe plain typing, validate persisted JSON, clear duplicates when reassigned and default repeat-last to ⌘ShiftH / Ctrl+Shift+H. Replaced only BlockNote's color toolbar control, preserving the rest of its default formatting UI; assigned text-color shortcuts appear on hover/focus. Direct chords and menu choices both update the last-color state, including background colors. See [ADR-017](adr/017-color-shortcuts.md).

Focused shortcut unit tests and the full three-browser interaction regression passed. The final `npm run check` passed lint/type/build, 106 unit/integration tests and 114 browser cases in 126.87 seconds. Applied styles persisted through the normal save/reload path, shortcut preferences remained browser-local, and user data under `data/` was untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T11:09:08Z — 0.4.0 browser-local control panel prepared

Prepared backward-compatible minor release 0.4.0 as the second requested incremental item. Added a single sidebar control panel for theme mode, editor text size, page width and sidebar startup visibility, with immediate root-attribute application, canonical local-storage persistence, stale-value validation and a full reset. Preferences do not enter document data, revisions or exports. The existing appearance-cycle button remains available, and the panel is intentionally ready for the separately requested shortcut configuration without implementing that next item in this commit. See [ADR-016](adr/016-control-panel.md).

The focused unit tests and three-browser control-panel test passed. The final `npm run check` passed lint/type/build, 103 unit/integration tests and 111 browser cases in 129.57 seconds. User data under `data/` remained untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-15T10:56:21Z — 0.3.1 inline paste and checkbox stability prepared

Prepared patch release 0.3.1. A validated one-line clipboard payload now enters as an inline text node at the exact ProseMirror selection, so an existing checklist or callout retains its ID, type, surrounding text and cursor placement without an added block. Multi-line checklist behavior remains on the typed-block path. Checkbox pointer handling records the intended state and scroll offsets at pointer-down, accepts only the matching low-movement pointer-up, reconciles after the browser's full click/change sequence, and restores editor/window scroll. This removes WebKit event-order double toggles and viewport jumps while retaining Ctrl+Enter/⌘Enter.

Registered the user's six requested tasks in `docs/remained_job.md`; only the first is marked complete. `npm run check` passed lint/type/build, 101 unit/integration tests and 108 browser cases across three engines in 131.96 seconds. User data under `data/` remained untouched. Commit, push and remote CI evidence are recorded separately.

## 2026-09-14T22:53:10Z — parallel harness published and CI verified

Committed and pushed `48f9c9f` (`test: parallelize isolated browser suite`) to `main`. [GitHub verification 34905987686](https://github.com/huklee/lotion/actions/runs/34905987686) passed the complete Ubuntu / Node 24 gate with two workers. Its `npm run check` step took 151 seconds versus 278 seconds in the preceding comparable success, a 45.7% reduction and 1.84× speedup. This documentation-only follow-up records publication evidence; application version remains 0.3.0 and user data remains untouched.

## 2026-09-14T22:45:47Z — parallel harness complete local gate passed

The final `npm run check` passed in 120.96 seconds: lint, type/production build, 101 unit/integration tests and all 105 Chromium, Firefox and WebKit cases with four workers. Documentation and harness changes are ready to publish; this entry does not claim remote CI success.

## 2026-09-14T22:42:20Z — browser-test workers isolated and parallelized

Replaced the shared fixed-port Playwright server/repository with a worker fixture that starts one server on a dynamic localhost port and one temporary repository per worker, and always closes/removes both during teardown. Enabled full test parallelism, using half of logical CPUs locally and two workers in CI. The stable four-worker run passed all 105 browser cases in 90.79 seconds versus the previous 174-second single-worker gate (47.8% less elapsed time, 1.92× speedup). An eight-worker probe produced Firefox timeouts under resource contention and was not selected. See [ADR-015](adr/015-parallel-browser-test-isolation.md).

This is test infrastructure only: it does not change product behavior, stored data or public interfaces, so the application remains at 0.3.0 under the version guide. User data under `data/` was untouched. Final complete gate and publication evidence follow in later entries.

## 2026-09-14T22:27:44Z — 0.3.0 published and CI verified

Published release commit `dbce105` and Linux-portable test follow-up `5ad6cce` to `main`. [GitHub verification 34903723704](https://github.com/huklee/lotion/actions/runs/34903723704) succeeded on Ubuntu / Node 24, including the complete `npm run check`. This documentation-only follow-up records the remote result; application version remains 0.3.0 and no release tag was created. User data remains ignored and untouched.

## 2026-09-14T22:12:57Z — 0.3.0 complete local gate passed

Final `npm run check` passed lint, type/production build, 101 unit/integration tests and 105 browser tests across Chromium, Firefox, and WebKit. The folder-import pagination regression found during the full gate was corrected in the import completion path and passed the complete rerun. Documentation, version metadata, and application changes are ready for commit/push; this entry does not yet claim remote CI success.

Release commit `dbce105` was pushed to `main`. Initial GitHub run [34903052123](https://github.com/huklee/lotion/actions/runs/34903052123) exposed a platform-specific test assumption rather than lost checklist content: Linux removes an empty suffix created by caret splitting, while macOS retained it. The follow-up test asserts the required checklist types, pasted text, absence of paragraphs, and reload persistence without fixing a meaningless empty-block count. Application version remains 0.3.0 for this test/documentation follow-up.

## 2026-09-14T21:50:33Z — 0.3.0 navigation and editor fixes prepared

Prepared the backward-compatible 0.3.0 minor release. Added persistent browser favorites, native sidebar page links with modified-click behavior, and route-aware browser Back/Forward history. Fixed checklist completion by mouse and Ctrl+Enter/⌘Enter, retained checklist types during validated plain-text paste, removed `&#x20;` output for whitespace-only Markdown blocks, made the next calendar Enter accept today, and disabled misleading browser dictionary underlines in document content.

Focused lint/type/unit checks and six cross-browser checklist/date scenarios passed. The complete local release gate is recorded above; commit, push, and GitHub CI status are recorded separately when complete. User data under `data/` remains untouched and untracked.

The full browser gate exposed a deterministic pagination edge: after shared test data exceeded 100 root pages, WebKit's newly imported folder was valid but hidden behind the sidebar's initial render limit. Import now expands that limit to include all current roots, keeping the new folder visible without removing normal incremental rendering.

## 2026-09-13T14:45:53Z — 0.2.0 published and CI verified

Committed and pushed `cd018bc` (`feat: release v0.2.0 clipboard, calendar and block editing improvements`) to `main`. [GitHub verification](https://github.com/huklee/lotion/actions/runs/34763348532) succeeded on Ubuntu / Node 24 with 100 unit/integration tests and 90 browser tests. Updated release/backlog/handover evidence in this documentation-only follow-up; version stays 0.2.0. No release tag was created. User data remains untracked and untouched.

## 2026-09-13T14:39:13Z — 0.2.0 features and release preparation verified

Prepared minor version 0.2.0 from 0.1.0 at the user's direction. Added persistent versioning guidance linked from AGENTS, README and the handover, plus a release changelog. Consolidated Mermaid fenced paste, complete-current-draft Markdown clipboard copy, selected-block Backspace deletion/undo, line-validated plain text pasting, the `@` calendar module, and left-aligned TOC labels. Dates remain portable text; current data formats and user data are preserved.

The initial deletion implementation exposed focus/drag issues; the final handler listens only while a custom selection exists and excludes input fields/outside targets. Rectangle-ending clicks do not clear the selected group. Plain text paste bypasses Markdown paste rules after schema validation. Oversized Mermaid input remains plain text instead of becoming an unsavable diagram.

Created the requested Korean document-search plan with three options: browser find, a current-document panel (recommended), and a workspace-wide search extension. Linked it in README; search implementation awaits choosing an option.

Release verification: `npm run check` passed lint/type/build, 100 unit/integration tests and 90 browser cases across three engines. Earlier focused fixes and failed iterations are recorded in test-results. This checkpoint precedes commit/push and does not claim a remote CI result.

## 2026-09-13T09:13:54Z — Mermaid paste and current-page Markdown copying

Implemented automatic conversion of a complete fenced Mermaid clipboard payload into a diagram using the existing insertion flow. Existing Mermaid source inputs unwrap the same payload and immediately update their diagram. Custom input pastes are handled by their own input, and ordinary clipboard content keeps its existing behavior.

Added **Export → Copy page as Markdown**, using the current save-coordinator draft and the shared Markdown serializer to include the title and entire body, even before auto-save. Success/fidelity feedback follows a successful clipboard write; permission errors preserve retry access. Documented current-page scope and the ZIP alternative for subpages/assets in README and ADR-011. Preserved the pre-existing uncommitted CI regression work and all user data.

Verification: final `npm run check` exited 0, with 98 unit/integration tests and 75 browser tests passing. Actual Chromium clipboard paste/read was verified, alongside event/adapter checks in Firefox and WebKit. No GitHub run or publication is asserted by this checkpoint.

## 2026-09-10T13:55:00Z — Codex memory and history transferred

Copied the two Yestion-specific raw Codex session logs into the local ignored `.codex/yestion-session-history/` directory in Lotion (about 10.3 MB total) without deleting their originals in the global Codex session store. Added root `AGENTS.md` and `docs/codex-handover.md` so future sessions begin with portable project context, current state, workflow, known regressions, paths and documentation references. Raw transcripts remain outside Git; the handover is versioned.

## 2026-09-10T13:52:00Z — Structured decision-log transfer

Transferred the completed decision-log restructuring from `/Users/huklee/Work/yestion` into this repository. Reformatted `docs/decisions.md` as bullet-based status, decision-record links, and Context/Decision/Alternatives/Consequences/Revisit fields without changing decision meaning. Validated all local Markdown links before publication.

## 2026-09-10T13:49:04Z — Installation guide and incremental publication

Exact UTC recording time. Added root README.md with installation/production startup first, followed by development startup, configuration, tests and documentation links. Added the same quick-start at the head of docs/README.md and updated the runbook to Lotion configuration names and upgrade compatibility. Documentation links were validated; no additional application code changed for this documentation unit.

Published and verified separate remote updates for 2ff487e (remaining-work checklist) and 7ed19a5 (Lotion rename with compatibility). This guide and record form the next individual commit/push unit. Outstanding WebKit failures and feature work remain documented rather than being marked finished.

## 2026-09-10T13:48:20Z — Lotion rename and compatibility verified

Exact UTC recording time. Renamed UI/wordmark, titles, slash groups, CSS/MIME namespaces, package/lockfile, exports, markers, environment configuration and current documentation to Lotion. Retained old literals only in compatibility readers/tests for browser session/theme/token settings, draft recovery, environment aliases, directory uploads and exact bundles/TOC imports. No canonical document data or asset IDs were renamed. Decision: [ADR-013](adr/013-lotion-naming-and-compatibility.md).

`npm run check` passed lint, type/build and 96 unit/integration tests; 67/69 browser tests passed. All three new browser migration tests passed. The two WebKit failures reproduce previously recorded paste-scroll positioning and ResizeObserver errors, still open in remained_job.md. This commit publishes the requested rename without claiming that the remaining-jobs backlog or full release gate is complete.

## 2026-09-10T13:45:39Z — Remaining-work checklist prepared for publication

Exact UTC recording time. Added docs/remained_job.md from the request audit, preserving its original audit timestamp, failed local/CI test counts, live-preview findings, missing features and completion gates. This backlog is published as its own documentation unit before the requested Lotion rename and installation guide. No backlog task is marked complete merely because the list has been committed.

## 2026-09-10T05:25:13Z — Incremental GitHub publication completed

Exact UTC recording time after verifying the fifth push. GitHub authentication is now available for huklee. Pushed each existing commit separately to https://github.com/huklee/lotion.git, branch main, verifying the remote SHA with git ls-remote after each operation:

1. f9e935c — persistence and document service foundation.
2. 22063f3 — block editor and workspace interactions.
3. f60984b — browser and persistence verification.
4. 5b0de3e — architecture and implementation history.
5. fe69722 — draft-preserving revision conflict resolution.

Configured local main to track origin/main. All five remote updates succeeded as fast-forwards (the first created main). No application code changed during publication; existing test evidence remains in test-results.md. This completion record is published as a separate documentation commit. Local data, dependencies and generated artifacts remain excluded.

## 2026-09-10T05:23:03Z — Destination verification completed for conflict fix

Exact UTC recording time. Ported the conflict changes and tests to lotion; lint/type/build and 92 unit/integration tests passed. Full browser run: 64/66, then all 6 targeted cases passed after correcting two slash-page test assumptions. All 9 conflict/navigation/offline recovery browser cases passed. Exact scope is recorded in test-results.md. Updated the commit plan to reflect the four existing local commits plus a separate conflict fix. Attempted pushing only the first foundation commit; HTTPS credential lookup failed, and no later push was attempted.

## 2026-09-10T05:17:23Z — Conflict recovery and resolution verified

Exact UTC recording time. Investigated page f63edb5a-4d08-4145-8f55-f41a6bc130df: server revision 47, 13 blocks, schema-valid. A read-only live browser smoke check returned API 200 and rendered the editor with content writes blocked. The user's existing browser draft is inaccessible to the automation browser, so no claim is made that a competing draft has already been selected or discarded.

Fixed invisible recovery controls caused by Conflict without an error message. Checkpoints now carry base content; recovery preserves the original revision. Added conservative three-way merge for independent fields/top-level blocks, latest-version review, explicit local/server choice, archived local drafts, conditional revision-safe resolution, fresh mutation IDs, editor refresh, and error handling for recovery-copy creation. Removed the unarchived discard button. Existing ambiguous drafts remain available for the user's choice after reloading the updated app.

Verification: build/typecheck and ESLint passed; 92 unit/integration tests passed. Nine browser tests passed across Chromium, Firefox and WebKit covering two-tab conflict, reload/resolve/save/reload, navigation during saves and offline draft recovery. Decision: [ADR-012](adr/012-conflict-resolution.md). Port this change into lotion as its own fix commit before completing the pending incremental pushes.

## 2026-09-09T22:09:19Z — Editor follow-ups, previews, Mermaid and contrast

Exact UTC checkpoint recording time (2026-09-10 07:09:19 KST), not reconstructed individual edit times.

Implemented `/page` child creation with failure recovery; removed link-DOM observer feedback loops; same-tab mention navigation; refreshed page titles/icons and tree on opening; searchable native emoji and dismissal; ancestor breadcrumbs; callouts, live TOC and editable table insertion. Added persisted OpenGraph title/image previews with bounded public-network-only fetches, local assets and exact-bundle metadata. Fixed paste chooser caret positioning, scroll tracking and cancellation, retained preceding text, and prevented repeated child creation requests.

Added `/mermaid` with local lazy loading, editable source, debounced non-interactive SVG-image preview, inline syntax errors and fenced Markdown import/export. Fixed unreadable code by overriding BlockNote's default dark token palette on the beige surface; all configured light-palette foregrounds are contrast-adjusted to at least 4.5:1. Kept the five-language selector, red fallback and vertical spacing; legacy language labels no longer crash pages.

Rationale and limitations: [ADR-011](adr/011-editor-previews-and-diagrams.md). Initial three-browser contrast tests caught faint HTML comments (4.09:1); added palette adjustment and regression coverage instead of accepting that failure. Full verification is running at this checkpoint; final counts will be recorded separately. User document files were not deleted.

Append major work entries using exact clock readings and explicit time zones. A recording timestamp is not retroactively asserted to be a completion timestamp. This is the single implementation record, covering history, current progress, and outstanding work. [Test results](test-results.md) records verification.

Preserved baseline design notes: sortable string ranks avoid ordinary numeric rebalancing; backups use separate destinations; mutation digests distinguish safe save retries from creation/bulk receipts. No application features existed at the documentation baseline.

## 2026-09-09T03:27:05+09:00 — Documentation baseline recorded

Timestamp type: recording time, from 2026-09-08 18:27:05 UTC. Exact completion timestamps for preceding file creation were not captured.

Task: user-requested architecture, plans, test coverage, and Markdown tracking. Milestone: pre-M0.

Completed before this recording: inspected the empty workspace; created architecture, roadmap, test plan, workflow, decisions, implementation log, test-results placeholder, and documentation index. No application code was present or implemented.

Rationale/evidence: [architecture](architecture.md), [baseline decisions](decisions.md), [test plan](test-plan.md).

Application verification remains pending; see [test results](test-results.md).

## 2026-09-09T03:29:27.226+09:00 — Requirements and documentation verification checkpoint

Timestamp type: exact validation checkpoint emitted by the executing process; the preceding edits completed before this checkpoint.

Task: incorporate user follow-ups and verify the documentation baseline. Milestone: pre-M0.

Completed work:

- Added image file drop, rectangular multi-block selection, whole-section movement, and related save/undo/browser test cases.
- Made recursive whole-folder import and hierarchical export explicit, including ZIP fallback, relative assets, empty directories, and collision handling.
- Added dedicated technical decisions for interactions, folder portability, and delegated engineering decisions, with reasons and alternatives.
- Added this separate timestamped history and workflow requirements for future major work.
- Ran documentation validation: 12 Markdown files, 36 local links, one JSON example, 65 unique planned test scenarios; exit 0, zero errors.

References: [interaction decision](adr/007-editor-interactions.md), [folder decision](adr/008-folder-portability.md), [ownership decision](adr/009-decision-ownership.md), [executed results](test-results.md).

Limitations: documentation-only checkpoint; no product functionality or application tests executed. Next step remains M0 implementation and test harness.

## 2026-09-08T18:52:54.560Z — First application and test harness checkpoint

Timestamp type: exact recording time from the local runtime. Tasks: M0–M5 implementation baseline; verification in progress.

Implemented React/BlockNote editing, a sidebar/tree, title synchronization, save coordination with draft checkpoints and conflicts, image upload/drop, block selection/section movement, trash/restore, themes, search, filesystem revision storage, API validation, and recursive folder/ZIP Markdown portability.

Added strict TypeScript, ESLint, Vitest, and Playwright harnesses. The initial production build and lint passed after correcting TypeScript header/mock types. The first unit/integration run passed 53 of 56 cases and exposed a JSZip stream compatibility bug in three import tests; replaced unsupported async iteration with bounded event-stream consumption and started a rerun. Browser engines were installed for actual browser validation. These are intermediate results, not milestone completion claims.

Consolidated the two previous implementation records into this file at the user's request. Preserved historical timestamps and design notes, removed the redundant summary, and updated references. The consolidated notes are recoverable here.

Rationale: [ADR-010](adr/010-implementation-foundations.md). Next: resolve test failures, execute browser workflows, verify deployment/restore, and document actual coverage and limitations.

## 2026-09-09T19:58:16+09:00 — Self-hosted MVP implementation verified

Timestamp type: exact recording time from the local clock. Tasks: M0–M6 MVP scope and regression verification.

Completed the browser application and filesystem service: BlockNote editing, slash commands, title/sidebar synchronization, per-document auto-save with IndexedDB drafts and revision conflicts, page hierarchy with nesting and sibling reordering, trash/restore, themes/search, image upload/drop/cancel, block rectangle selection, section movement, recursive folder/ZIP Markdown import/export, exact bundles, stable assets, loopback defaults, optional token authentication, local fonts, and operator documentation.

Storage uses immutable document revisions and an atomic manifest visibility boundary. Added deterministic validation, retry receipts, writer locking, safe path/URL checks, fault injection, startup corruption refusal, and backup restoration tests. Added GitHub Actions for Node 24 and the three-browser suite.

Verification: `npm run check` passed ESLint, strict type/build, 63 unit/integration tests, and 42 browser workflows across Chromium, Firefox, and WebKit. `npm run test:performance` passed the documented budgets on Apple M1. Exact commands, metrics, fixes, and limits are in [test results](test-results.md).

Outstanding hardening: Linux/power-loss qualification, native IME and assistive-technology manual reviews, retention-aware garbage collection, and initial-bundle reduction. These are tracked in [roadmap](roadmap.md); no observed automated-test data-loss or silent-overwrite defect remains open.
