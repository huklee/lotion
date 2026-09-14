# ADR-014: Browser favorites and page navigation

Recorded: 2026-09-14. Release: 0.3.0.

## Decisions

- Favorites are a personal browser preference stored as page IDs in `lotion-favorites` localStorage. Use current tree/coordinator titles and icons rather than copying metadata. Listen for storage events to synchronize tabs. Catch unavailable/corrupt storage, and report failed writes instead of claiming persistence. Preferences are scoped to the application origin and are not included in workspace ZIP exports or shared across browsers/devices.
- Render favorite entries only for visible pages. Keep IDs when a page is trashed so restore retains the preference. The star on the current page and the removal control in Favorites toggle the same list.
- Sidebar page links and favorite links use anchors with real hash hrefs. Intercept only unmodified primary clicks; let the browser handle Meta/Ctrl/Shift clicks, middle clicks and link context menus. Preserve row dragging by disabling native link dragging.
- Successful explicit page changes push a history entry only when the route differs. Initial resolution replaces the current entry. Browser hash navigation reads the route without writing history, preventing Back/Forward loops. Keep current save coordinators/drafts during navigation.
- Home has an explicit `#/home` route, adds a history entry and remains Home after reload. Opening Home or traversing to a non-page route invalidates pending page loads so a late response cannot reopen a page unexpectedly. Trashing the active page replaces its entry with Home rather than creating a new visit to a removed document.

## Validation

Browser tests cover favorite persistence/title updates/cross-tab removal, real modified-click new tabs with the original tab unchanged, A/B/Home Back/Forward navigation, same-page deduplication and pending drafts. Existing sidebar nesting/reordering and navigation-during-save regressions remain part of the full gate. Exact executed results and any remote CI evidence are in [test results](../test-results.md).
