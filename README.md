# Lotion

Current version: **0.8.0**. See the [version history and added features](docs/changelog.md).

Release workflow: [version management guide](docs/versioning.md).

Plan for review: [three approaches to in-document search](docs/document-search-plan.md).

## Install and run

Use Node.js 24 LTS and npm (minimum supported Node version: 22.12).

```sh
git clone https://github.com/huklee/lotion.git
cd lotion
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Stop with Ctrl+C. Documents and assets are stored in `data/` on the machine running the server.

For an existing checkout, start with `cd ~/work/lotion` and run the npm commands above. Only one backend may use a workspace at a time; stop an existing server before starting another on port 3001.

For development:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**; the development frontend proxies API requests to port 3001.

Optional environment variables: `LOTION_DATA_DIR` (default `data`), `PORT` (default `3001`), `HOST` (default `127.0.0.1`), and `LOTION_TOKEN`. Non-loopback access requires a token and an HTTPS reverse proxy. See the [runbook](docs/running.md) for configuration and backup/restore.

## About

Lotion is a self-hosted document editor without AI. It supports block editing, automatic saving, page hierarchy, image drops, mentions, Markdown folder import/export, and Mermaid diagrams.

## Paste diagrams and copy Markdown

Paste a complete fenced `mermaid` Markdown block into the editor to create a diagram. Pasting it into an existing Mermaid source field replaces that diagram's source and removes the fences.

Use **Export → Copy page as Markdown** to copy the current page's title and full body, including unsaved edits. Mermaid diagrams are copied as fenced source, and blank editor blocks remain blank lines rather than `&#x20;`. This copies the current page only; use ZIP export for subpages and image files.

Select blocks by dragging a selection rectangle in any direction or choosing **Select section**, then press **Backspace** to delete them. Hold Shift, Command, or Control while drawing another rectangle to extend the selection. Dragging within one block still performs native text selection; drag near the editor's top or bottom edge to scroll while selecting. Use **⌘Z / Ctrl+Z** to undo.

Place the cursor in any block and choose **Copy block link** to copy a direct URL to that exact location. Opening the URL loads the page, scrolls the referenced block into view, and highlights it. If the block was later deleted, the page still opens without forcing a fallback block.

Type **@date** (or type **@** and choose **Date**) to open the calendar, choose a day and insert it. Press Enter once more immediately after opening to insert today. Dates are stored as portable `📅 YYYY-MM-DD` text.

Ordinary clipboard text is checked line by line and pasted as plain paragraphs, preserving literal Markdown/HTML text. Complete Mermaid fences retain diagram conversion; a single HTTP(S) URL retains the link chooser. Oversized pastes show an error rather than silently dropping text. Use Markdown import when you want Markdown formatting interpreted.

Checklist items can be completed by clicking their checkbox or pressing **Ctrl+Enter / ⌘Enter** while editing the item. A single pasted line stays at the current cursor inside a checklist or callout instead of creating a new block; multi-line plain-text paste inside a checklist retains checklist blocks. Checkbox clicks preserve the document's scroll position. Browser spellcheck is disabled in the document editor to avoid misleading red dictionary underlines on code, product names, and mixed-language text.

## Favorites and navigation

Mark a page with the top-bar star to add it to **Favorites** in the sidebar. Favorites persist in this browser and sync across its tabs; they are not server-side workspace data. Page navigation supports browser Back/Forward. Use ⌘click on macOS or Ctrl+click on Windows/Linux on sidebar links to open another tab (Shift+click follows the browser's new-window behavior).

## Control panel

Open **Control panel** at the bottom of the sidebar to choose a system/light/dark theme, editor text size, comfortable/wide page width, and whether the sidebar opens on startup. These preferences are stored in this browser and do not change document content. **Reset display settings** restores the defaults.

The same panel lets you record a modifier-key shortcut for every text color. Focus a shortcut field and press the desired combination; Backspace/Delete clears it, and assigning a duplicate moves that combination to the new action. Assigned shortcuts appear when hovering or keyboard-focusing their colors in the editor toolbar. **⌘ShiftH / Ctrl+Shift+H** reapplies the most recently chosen text or background color by default and can also be reassigned.

## Tests

```sh
npx playwright install chromium firefox webkit
npm run check
```

On Linux, use `npx playwright install --with-deps chromium firefox webkit`. Browser tests run fully in parallel with an isolated temporary workspace and dynamic localhost port per worker, so they never touch `data/`. Local runs use half of the available logical CPUs; CI uses two workers.

## Documentation

- [Documentation index](docs/README.md)
- [TypeScript file and module structure rules](docs/typescript-file-structure.md)
- [Remaining jobs and known issues](docs/remained_job.md)
- [Architecture](docs/architecture.md)
- [Test results](docs/test-results.md)
- [Implementation history](docs/implementation-history-log.md)

This is an actively developed application. Consult the remaining-jobs checklist and dated test results for current limitations.
