# ADR-011: Editor previews, navigation, code contrast and diagrams

Status: accepted. Recorded 2026-09-10; see implementation-history-log.md for exact checkpoint times.

## Decisions and reasons

- Use BlockNote's supported link configuration, not a DOM MutationObserver. Rewriting link DOM can trigger a ProseMirror reconciliation loop and freeze `/page`. Internal mentions use the existing page router; external mentions navigate in the same tab.
- Keep one subpage creation request in flight, capture its insertion anchor before awaiting I/O, and display failures without locking the editor. Preserve text typed during the request.
- Anchor the paste chooser to the saved editor selection's viewport coordinates. Recompute on scrolling/resizing; clamp to the viewport. Abort metadata lookup on cancellation and retain the insertion selection across asynchronous work.
- Persist external OpenGraph metadata beside blocks and cache raster preview images as local content-addressed assets. Fetch on explicit paste-as-mention, not on every render. DNS and every redirect must resolve only to public addresses; pin validated DNS answers, limit concurrency, elapsed time, MIME types and response bytes. Metadata failure falls back to a hostname chip. No arbitrary authenticated page scraping.
- Refresh internal titles/icons against the current tree when opening a page. Use searchable native emoji (including skin variants) from emojibase; actual glyph availability depends on the operating system. Close the picker on choice, Escape, outside click and navigation.
- Use a live custom table-of-contents block, a callout block, and an editable table for `/database`. The table is not a relational Notion database: views, formulas, relations and queries are not implemented.
- Restrict the code language selector to JSON, HTML, Python, Go and C++. Normalize older unsupported labels on load so legacy documents still render.
- The beige code surface is intentionally identical in light/dark app themes. BlockNote defaults to dark syntax colors; explicitly use Shiki's light-color variables instead. Adapt the GitHub high-contrast light palette so every configured foreground meets at least 4.5:1 contrast on `#efe7d5`. Preserve syntax hues and the red fallback rather than turning all tokens red.
- Add a dedicated `/mermaid` block, separate from the five-language code selector. Store source in `props.code`; export/import standard fenced `mermaid` Markdown, including folder/bundle workflows. Debounce rendering by 300 ms, disregard stale completions, show inline syntax errors, and limit source to 20,000 characters and diagrams to 200 edges.
- Load Mermaid locally on demand. Use strict security, disabled HTML labels, and render the resulting SVG as an image rather than injecting interactive SVG into the editor. Diagrams are deliberately non-interactive; source remains editable. The diagram preview uses a light surface in both themes.

## Alternatives and limitations

Inline SVG would enable diagram callbacks but increases the security and DOM-interference surface. Dark code backgrounds would match default token colors but violate the requested beige appearance. Plain Markdown cannot preserve every custom block's exact visual style: exact bundles preserve structured snapshots and preview metadata; portable callouts become quotes and TOCs use a Lotion marker.

Mermaid renders in the browser, not a worker. Size/edge limits reduce expensive input but do not provide a hard CPU deadline. Browser/OS emoji availability and external sites' metadata availability cannot be guaranteed.

## Evidence and reference

Regression cases are in tests/e2e/workspace.spec.ts, tests/unit/markdown.test.ts and tests/unit/link-preview.test.ts. Executed results belong in [test results](../test-results.md).

Mermaid configuration follows its [official usage and security documentation](https://mermaid.js.org/config/usage.html). BlockNote's installed SyntaxHighlighting/shiki.ts and editor/Block.css establish the dual-color-variable contract and default dark-token behavior.
