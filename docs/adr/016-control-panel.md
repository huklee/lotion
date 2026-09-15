# ADR-016: Browser-local control panel

- **Status:** Validated
- **Date:** 2026-09-15

## Context

Display preferences were split between a theme-cycling sidebar button and fixed CSS values. More configurable shortcuts are planned, so the application needs one discoverable settings surface without coupling personal UI choices to portable document data.

## Decision

Add a sidebar **Control panel** modal for theme mode, editor text size, page width and sidebar startup visibility. Store the choices under canonical `lotion-*` local-storage keys, validate every stored value before use, apply visual choices through root data attributes, and provide one reset action. Keep the existing quick appearance button for fast theme cycling.

## Alternatives

- Put settings in document JSON: rejected because display choices are browser/user preferences and would create irrelevant document revisions.
- Add separate controls throughout the interface: rejected because planned settings would become difficult to discover and reset consistently.
- Add a server-side user profile now: deferred because Lotion has no user-account model and remains primarily single-user/self-hosted.

## Consequences

Settings persist per browser rather than following a workspace to another device. Invalid or obsolete values fall back safely. The preference helpers and panel provide an extension point for later configurable formatting shortcuts without adding those shortcuts to this release.

## Revisit when

Multi-user identity, cross-device preference sync or workspace-admin policy becomes a product requirement.
