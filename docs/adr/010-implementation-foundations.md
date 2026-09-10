# ADR-010: Implementation foundations and atomic workspace commits

Status: Implemented; integration/browser validation ongoing.
Recorded: 2026-09-08T18:52:54.560Z.

## Storage commit protocol

Decision: canonical document revisions live at `documents/<id>.<revision>.json`. `workspace.json` is the authoritative mapping from document IDs to committed revisions and contains creation/import mutation receipts. Assets live at `assets/<sha256>.<detected-extension>`.

Reason: a folder import changes many documents. Writing all immutable revision snapshots before one atomically replaced manifest gives the entire tree one visibility boundary, and supports idempotent recovery without a separate multi-file transaction replay subsystem. Readers use only revisions named in the committed manifest. This supersedes the proposed replace-in-place document files and derived-only manifest.

On startup validate all referenced documents and hierarchy. A failed pre-manifest operation can leave unreferenced snapshots; they are never visible. Keep them initially rather than risk destructive cleanup. Revision files retain history; retention/garbage collection is not yet automated. A process lock prevents competing backend writers. Node directory sync and rename behavior is tested on the available macOS local filesystem; Linux/power-loss qualification remains separate.

Tradeoff: manifest serialization grows with page count and receipts; all mutations are queued. This favors simple correctness for a personal workspace. Revisit with measurements before supporting very large workspaces or multiple writers. History consumes disk until explicit retention tooling is implemented.

## Editor integration

Use BlockNote 0.54.0 with React 19 and the bundled Mantine view. Existing slash menus, formatting, block handles, and undo are retained. A small adapter provides gutter selection and coherent section movement via editor transactions. The application owns title, navigation, and save state; the editor owns live blocks. No AI extension is installed.

Section move currently uses a single transactional replacement of the block tree, preserving block IDs and nested content. Verify undo and performance in browsers before claiming parity for very large pages. External file drops create ordered image placeholders; successful upload updates only an existing placeholder. Failed/pending uploads expose retry or re-upload states rather than storing transient URLs.

## Runtime and testing

Use npm with committed lockfile, strict TypeScript, ESLint, Vitest, and Playwright. Node >=22.12 is accepted by the scaffold; the local verification runtime is Node 25.8.2. Recommend Node 24 LTS for deployment, subject to running the same verification in that environment. Do not mislabel the local runtime as LTS.

Tests use synthetic content and isolated OS temporary directories. Failure injection tests cover snapshot-write/flush/rename/pre-manifest boundaries. Real browser tests cover editing, folder intake, assets, conflicts, themes, and section undo.

## Local hosting and authentication

Loopback-only default with optional bearer token. Non-loopback binding requires `LOTION_TOKEN`; TLS is supplied by the operator's reverse proxy. The frontend stores the token in tab session storage and authenticates document, import/export, and asset requests. Cross-origin browser requests are rejected. No remote link-preview fetcher is implemented, avoiding an unnecessary server-fetch surface.

Fonts are bundled with the application so core UI rendering does not depend on an external font CDN. External images/links remain explicit user content.

## Documentation consolidation

Per the user's correction, keep only `docs/implementation-history-log.md`. It retains timestamped history and implementation status. Removed the redundant summary after preserving its useful notes. All future major work goes into that one log.
