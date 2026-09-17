# ADR-011: Editor previews, navigation, code contrast and diagrams

Status: accepted. Recorded 2026-09-10; see implementation-history-log.md for exact checkpoint times.

## Decisions and reasons

- Use BlockNote's supported link configuration, not a DOM MutationObserver. Rewriting link DOM can trigger a ProseMirror reconciliation loop and freeze `/page`. Internal mentions use the existing page router; external mentions navigate in the same tab.
- Keep one subpage creation request in flight, capture its insertion anchor before awaiting I/O, and display failures without locking the editor. Preserve text typed during the request.
- Anchor the paste chooser to the saved editor selection's viewport coordinates. Recompute on scrolling/resizing; clamp to the viewport. Abort metadata lookup on cancellation and retain the insertion selection across asynchronous work.
- CI regression follow-up (2026-09-10): constrain the main grid panel with `min-height: 0` so its flex scroll area can fit the viewport. The paste regression waits for fonts and the scroll-position update to paint, starts away from the scroll boundary, and checks matching 35-pixel movement of the scroller, insertion block and chooser.
- Disable the slash suggestion menu's fade transition. Installed BlockNote `GenericPopover` retains closing menu DOM during the default 250 ms Floating UI transition, with resize observation still active while command failure feedback changes the editor layout. Observer tracing identified these floating elements; immediate closure eliminated the WebKit notification in repeated regression runs. Keep all browser-error assertions and observers active; do not suppress errors globally.
- Persist external OpenGraph metadata beside blocks and cache raster preview images as local content-addressed assets. Fetch on explicit paste-as-mention, not on every render. DNS and every redirect must resolve only to public addresses; pin validated DNS answers, limit concurrency, elapsed time, MIME types and response bytes. Metadata failure falls back to a hostname chip. No arbitrary authenticated page scraping.
- Link-preview networking retains only validated public DNS candidates and gives that pinned set to Node's IPv4/IPv6 family selection. RFC 6052's well-known NAT64 prefix and RFC 8215's local-use prefix are accepted only after their embedded IPv4 destination passes the same public-address policy. Mixed private/public DNS responses therefore cannot connect to the private candidate, redirects are still re-resolved, and an unreachable first address no longer masks another validated family.
- Refresh internal titles/icons against the current tree when opening a page. Use searchable native emoji (including skin variants) from emojibase; actual glyph availability depends on the operating system. Close the picker on choice, Escape, outside click and navigation.
- Use a live custom table-of-contents block, a callout block, and an editable table for `/database`. The table is not a relational Notion database: views, formulas, relations and queries are not implemented.
- Restrict the code language selector to JSON, HTML, Python, Go and C++. Normalize older unsupported labels on load so legacy documents still render.
- The beige code surface is intentionally identical in light/dark app themes. BlockNote defaults to dark syntax colors; explicitly use Shiki's light-color variables instead. Adapt the GitHub high-contrast light palette so every configured foreground meets at least 4.5:1 contrast on `#efe7d5`. Preserve syntax hues and the red fallback rather than turning all tokens red.
- Add a dedicated `/mermaid` block, separate from the five-language code selector. Store source in `props.code`; export/import standard fenced `mermaid` Markdown, including folder/bundle workflows. Debounce rendering by 300 ms, disregard stale completions, show inline syntax errors, and limit source to 20,000 characters and diagrams to 200 edges.
- Load Mermaid locally on demand. Use strict security, disabled HTML labels, and render the resulting SVG as an image rather than injecting interactive SVG into the editor. Diagrams are deliberately non-interactive; source remains editable. The diagram preview uses a light surface in both themes.

## Alternatives and limitations

### Clipboard additions (2026-09-13)

Ordinary clipboard text is normalized for CRLF and validated per line using the persisted document schema, then inserted as plain paragraph nodes in one editor transaction. Native HTML/Markdown paste rules are bypassed so literal markup remains text. Blank lines and spaces are retained by the stored text. More than 10,000 lines or a prospective document that fails the schema is rejected before insertion with a visible error. A complete Mermaid fence (up to the existing 20,000-character source limit) and the single-URL chooser remain explicit exceptions. Oversized Mermaid fences fall back to plain text. Clipboard files and custom textareas retain their native paste behavior.

When the active block is a checklist item, validated pasted lines are inserted as checklist items instead of paragraph nodes. Portable Markdown serialization treats a whitespace-only editor block as a blank Markdown line, avoiding the serializer's `&#x20;` representation in clipboard output. The `@date` dialog preselects today and captures its next Enter as acceptance, preventing the initially focused previous-month control from changing the month.

The `@` suggestion menu now offers a reusable local calendar dialog with month navigation, day buttons and direct date entry. Dates insert as `📅 YYYY-MM-DD` text at the saved selection; no UTC conversion, new inline schema, remote date service or migration is needed. Native dialog semantics provide focus trapping and Escape cancellation. Date reminders and editable date chips are outside this implementation. TOC buttons explicitly use `justify-content: flex-start` in addition to left text alignment because the generic button style centered flex content.

Recognize a single complete fenced Mermaid source on paste. In the block editor, reuse the existing slash insertion behavior (replace an empty block or insert after a nonempty block, preserving its text). In a Mermaid textarea, replace the source with the unwrapped code. Leave plain source and other clipboard formats to normal input handling. Keep Mermaid syntax validation in the renderer so invalid source remains editable.

The export dialog can copy the current page's title and complete draft through the shared Markdown converter and the browser Clipboard API. Read the save coordinator's current content so pending/offline edits are included, and show success only after the clipboard write succeeds. This operation does not require a server save and does not include subpages or image bytes; links remain workspace links. ZIP export remains the option for bundled assets. Converter fidelity warnings are shown after copying. Clipboard permission failures leave the dialog available for retry.

Inline SVG would enable diagram callbacks but increases the security and DOM-interference surface. Dark code backgrounds would match default token colors but violate the requested beige appearance. Plain Markdown cannot preserve every custom block's exact visual style: exact bundles preserve structured snapshots and preview metadata; portable callouts become quotes and TOCs use a Lotion marker.

Mermaid renders in the browser, not a worker. Size/edge limits reduce expensive input but do not provide a hard CPU deadline. Browser/OS emoji availability and external sites' metadata availability cannot be guaranteed.

## Evidence and reference

Regression cases are in tests/e2e/workspace.spec.ts, tests/unit/markdown.test.ts and tests/unit/link-preview.test.ts. Executed results belong in [test results](../test-results.md).

Mermaid configuration follows its [official usage and security documentation](https://mermaid.js.org/config/usage.html). BlockNote's installed SyntaxHighlighting/shiki.ts and editor/Block.css establish the dual-color-variable contract and default dark-token behavior.

Link-preview NAT64 handling follows [RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html) and [RFC 8215](https://www.rfc-editor.org/rfc/rfc8215.html). Address-family fallback uses Node's documented [`autoSelectFamily`](https://nodejs.org/api/net.html) lookup behavior while retaining only prevalidated, pinned answers.
