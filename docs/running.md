# Running Yestion

## Editor additions

Type `/page` for a subpage, `/toc` for a live heading index, `/callout` for a note, `/database` for an editable table, and `/mermaid` for a diagram with editable source. Mermaid previews are non-interactive, support source up to 20,000 characters, and export/import as fenced `mermaid` Markdown, including whole-folder workflows.

Use `@` or `[[` to mention workspace pages. Pasting a URL offers a chooser beside the cursor block; Paste as mention requests public OpenGraph metadata and caches an available preview image locally. Failed lookups fall back to a hostname. Links navigate in the same tab. Exact bundles retain page icons and cached preview metadata; portable Markdown retains link text but not preview cards.

Code blocks support JSON, HTML, Python, Go and C++ syntax colors on a fixed beige surface in both themes. Reload an already-open browser tab after rebuilding to load updated styles.

## Development

Use Node >=22.12 and npm. Node 24 LTS is the deployment baseline to qualify; see the test report for the actual runtime used.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the backend at port 3001. The backend writes to `data/` by default. The directory is created automatically and excluded from version control. A second backend writer using the same directory is refused.

## Production on a local machine

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:3001`. This single server serves the built web UI and API. Stop with Ctrl+C so the writer lock is released. After a killed process, its heartbeat lock becomes eligible for stale recovery after approximately ten seconds.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `YESTION_DATA_DIR` | `data` | Backend-owned workspace directory |
| `PORT` | `3001` | Backend HTTP port |
| `HOST` | `127.0.0.1` | Bind address; non-loopback requires token |
| `YESTION_TOKEN` | unset | Optional local / required remote bearer token |

Set configuration in the process environment. Do not commit tokens. For remote access, configure a strong token and HTTPS reverse proxy; keep the proxy's Host/Origin handling consistent. Authenticate in the browser token dialog. All `/api` routes, including assets, require the configured token. Core document editing has no AI or external service dependency.

## Import/export

Use Import -> Choose folder, drag a directory onto the import dialog, or choose Markdown/ZIP files. Whole-folder intake retains nested pages and resolves local assets. Directory-drop support is feature-dependent; folder picker and ZIP are alternatives. Empty directories are represented by container pages when the intake API exposes them. Browser folder pickers may omit empty directories.

Export downloads a complete directory tree as ZIP. Exact bundles contain JSON snapshots; portable exports contain Markdown and assets with a manifest. If Markdown was changed outside the app, select the desired source in the import dialog before retrying. Import creates new page IDs and remaps internal links; it does not overwrite existing pages.

## Verification commands

```sh
npm run lint
npm run build
npm run test:unit
npm run test:integration
npx playwright install chromium firefox webkit
npm run test:e2e
```

`npm run check` runs lint, type/build, unit/integration tests, and the browser suite. Browser tests use a separate temporary workspace and port 3101. They do not touch `data/`. Failure traces are in `test-results/` and the HTML report in `playwright-report/`; Markdown execution summaries belong in `docs/test-results.md`.

## Backup and recovery

For a full backup including trash and history, stop the backend and copy the entire workspace directory to a separate destination/device. Copy `workspace.json`, all referenced `documents/` revisions, and `assets/` together. Do not copy a live mutating directory without a filesystem snapshot. Application ZIP export is for active-page portability, not a full historical backup.

Restore into an empty directory, set `YESTION_DATA_DIR` to that path, and start one backend. Do not restore over a live workspace. The server validates committed references and fails startup on corrupt/unsupported data rather than replacing it with an empty workspace. After a disk-full or permission failure, correct the environment and retry the retained browser draft.

No schema upgrade beyond version 1 is currently defined. Never edit the canonical files while the backend runs. For future migrations, stop, back up, run a versioned migration, and test rollback against a copy before upgrading real data.
