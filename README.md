<div align="center">

# Lotion

**A self-hosted, block-based workspace for documents, meeting notes and issues. No AI inside.**

[Quick start](#quick-start) · [Features](#features) · [Shortcuts](#keyboard-shortcuts) · [User guide](docs/user-guide.md) · [Changelog](docs/changelog.md) · [Docs](docs/README.md)

![version](https://img.shields.io/badge/version-0.63.0-blue)
![node](https://img.shields.io/badge/node-%E2%89%A522.12-339933?logo=node.js&logoColor=white)
![typescript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-6E9F18)

</div>

Current version: **0.63.0**. See the [changelog](docs/changelog.md) for what changed in each release.

Lotion is a Notion-style editor that runs on your own machine. Pages, databases and an issue board live in a plain `data/` folder that you can back up, export as Markdown and read without Lotion. Nothing is sent to an AI service unless you ask for a meeting summary.

## Features

**Writing**

- Block editor: headings, lists, to-dos, callouts, tables, code, images, file attachments and [Mermaid](https://mermaid.js.org) diagrams.
- Mentions: `@page`, `@file`, `@date`, and links with previews.
- Automatic saving, with a prompt when an edit conflicts with a change from another tab or agent.
- Block selection with a drag rectangle; copy and paste keep structure and styles.
- Copy a link to any block.
- An automatic page outline, ten colour presets with your own shortcuts, and light, dark and black themes.

**Organising**

- A nested page tree with drag to move, favourites, a trash, and a **Recent changes** feed.
- `/database` tables whose rows are real pages, with saved views.
- Meeting logs with a feed view and on-demand summaries.
- **⌘K** search across titles and content, including unsaved drafts.

**Issues**

- A personal board at `#/issues`: statuses, priorities, labels, deadlines, Focus now, status notes and archive with undo.
- Every action has a Vimium-style key (`f`, `j`/`k`, `x`, `?` …); **⌘⇧I** opens the board from anywhere.
- A `lotion issue` CLI and an MCP server, so coding agents can file and update issues.

**Import and export**

- Markdown folder import, Markdown and ZIP export, and copy a page as Markdown.
- **Confluence:** storage-format export, and a wiki-markup view with Expand / Info / Note panels.

See the [user guide](docs/user-guide.md) for details on each feature.

## Quick start

Requires **Node.js 24 LTS** (22.12 at least) and npm.

```sh
git clone https://github.com/huklee/lotion.git
cd lotion
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Documents and assets are stored in `data/` on the machine running the server.

> [!NOTE]
> Only one server may use a workspace at a time. Stop a running server before starting another on the same port or data folder.

### Development

```sh
npm ci
npm run dev   # http://127.0.0.1:5173, API proxied to :3001
```

## Configuration

| Variable          | Default     | Purpose                                                                                                           |
| ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `LOTION_DATA_DIR` | `data`      | Workspace folder (documents, assets, revisions)                                                                   |
| `PORT`            | `3001`      | HTTP port                                                                                                         |
| `HOST`            | `127.0.0.1` | Bind address                                                                                                      |
| `LOTION_TOKEN`    | —           | Access token. Required for anything other than loopback access, which must also go through an HTTPS reverse proxy |

The [runbook](docs/running.md) covers deployment, backup and restore.

If startup reports a missing, malformed or externally changed snapshot, stop every server using that workspace and run:

```sh
npm run doctor -- --data-dir <workspace>
```

The doctor is read-only unless you pass it a reviewed plan with `--apply`. See [diagnosis and reconciliation](docs/running.md#workspace-diagnosis-and-reconciliation).

## Keyboard shortcuts

⌘ is Ctrl on Windows and Linux.

| Shortcut         | Action                                                          |
| ---------------- | --------------------------------------------------------------- |
| ⌘K               | Search pages, content and issues                                |
| ⌘S               | Save now                                                        |
| ⌘Z / ⌘⇧Z         | Undo / redo                                                     |
| ⌘Enter           | Check or uncheck to-dos (in the selection too)                  |
| ⌘⇧H              | Reapply the last colour preset                                  |
| `<-` / `->`      | Typed as ← / →                                                  |
| `g h` / `g i`    | Go to Home / Issues                                             |
| ⌘⇧I              | Open Issues, also while typing (change it in the Control panel) |
| `?` on the board | Every issue-board key                                           |

## Issues from the command line

```sh
ln -s "$PWD/bin/lotion" ~/.local/bin/lotion   # once
export LOTION_URL=http://127.0.0.1:3001 LOTION_TOKEN_FILE=~/.config/lotion/token

lotion issue new "Fix paste in lists" --label bug --as codex
lotion issue ls --json
lotion issue move 12 "in progress"
lotion issue note 12 "found the cause; fixing"
```

More commands: `edit`, `label`, `claim`, `close`, `reopen`, `search`, `rm` and `watch` (`lotion issue --help`).

To give an MCP-capable agent (Claude Code, Codex, …) the issue tools:

```sh
claude mcp add lotion-issues -e LOTION_AUTHOR=claude \
  -e LOTION_TOKEN_FILE=~/.config/lotion/token -- "$PWD/bin/lotion-mcp"
```

The design is described in [ADR-026](docs/adr/026-personal-issue-tracker.md).

## Testing

```sh
npx playwright install chromium firefox webkit   # Linux: add --with-deps
npm run check   # ESLint, strict TypeScript, build, Vitest, Playwright
```

Browser tests run in parallel on Chromium, Firefox and WebKit. Each worker gets its own temporary workspace and port, so the tests never touch `data/`.

## Documentation

|                                                                                      |                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------- |
| [User guide](docs/user-guide.md)                                                     | Every feature in detail                   |
| [Changelog](docs/changelog.md)                                                       | What changed in each version              |
| [Architecture](docs/architecture.md)                                                 | Stack, boundaries, data and APIs          |
| [Runbook](docs/running.md)                                                           | Configuration, deployment, backup         |
| [Versioning](docs/versioning.md)                                                     | Release workflow                          |
| [Remaining jobs](docs/remained_job.md)                                               | Known gaps and limitations                |
| [Test results](docs/test-results.md) · [History](docs/implementation-history-log.md) | Verification and implementation records   |
| [Documentation index](docs/README.md)                                                | Everything else, including ADRs and plans |

## Status

Lotion is under active development as a personal workspace. Check the [remaining jobs](docs/remained_job.md) and the latest [test results](docs/test-results.md) for current limitations.
