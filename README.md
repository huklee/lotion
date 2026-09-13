# Lotion

Current version: **0.2.0**. See the [version history and added features](docs/changelog.md).

Release workflow: [version management guide](docs/versioning.md).

검토할 계획: [문서 내 검색 기능 3가지 안](docs/document-search-plan.md).

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

Use **Export → Copy page as Markdown** to copy the current page's title and full body, including unsaved edits. Mermaid diagrams are copied as fenced source. This copies the current page only; use ZIP export for subpages and image files.

Select blocks by dragging a selection rectangle or choosing **Select section**, then press **Backspace** to delete them. Use **⌘Z / Ctrl+Z** to undo.

Type **@date** (or type **@** and choose **Date**) to open the calendar, choose a day and insert it. Dates are stored as portable `📅 YYYY-MM-DD` text.

Ordinary clipboard text is checked line by line and pasted as plain paragraphs, preserving literal Markdown/HTML text. Complete Mermaid fences retain diagram conversion; a single HTTP(S) URL retains the link chooser. Oversized pastes show an error rather than silently dropping text. Use Markdown import when you want Markdown formatting interpreted.

## Tests

```sh
npx playwright install chromium firefox webkit
npm run check
```

On Linux, use `npx playwright install --with-deps chromium firefox webkit`. Browser tests use isolated temporary data and port 3101.

## Documentation

- [Documentation index](docs/README.md)
- [Remaining jobs and known issues](docs/remained_job.md)
- [Architecture](docs/architecture.md)
- [Test results](docs/test-results.md)
- [Implementation history](docs/implementation-history-log.md)

This is an actively developed application. Consult the remaining-jobs checklist and dated test results for current limitations.
