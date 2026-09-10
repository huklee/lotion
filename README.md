# Lotion

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
