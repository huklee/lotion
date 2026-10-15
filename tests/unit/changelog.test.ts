import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  compareVersions,
  parseBody,
  parseChangelog,
  parseInline,
  safeHref,
} from "../../packages/changelog/parse";

const sample = `# Changelog

Intro.

## 0.31.0 — 2026-10-16 · [#49](https://github.com/huklee/lotion/pull/49)

### Added

- **Feed view:** read \`rows\` inline.
  Continued line.
  - nested

## 0.30.0 — 2026-10-16

Plain paragraph.

## 0.1.0 — baseline
`;

describe("changelog", () => {
  it("parses releases with date and PR", () => {
    const releases = parseChangelog(sample);
    expect(releases.map((r) => [r.version, r.date, r.pr])).toEqual([
      ["0.31.0", "2026-10-16", 49],
      ["0.30.0", "2026-10-16", undefined],
      ["0.1.0", "baseline", undefined],
    ]);
    expect(releases[1].body).toBe("Plain paragraph.");
  });

  it("parses bodies and inline markup", () => {
    const [release] = parseChangelog(sample);
    expect(parseBody(release.body)).toEqual([
      { kind: "heading", text: "Added" },
      {
        kind: "item",
        depth: 0,
        text: "**Feed view:** read `rows` inline. Continued line.",
      },
      { kind: "item", depth: 1, text: "nested" },
    ]);
    expect(parseInline("**A:** see `x` and [docs](test-results.md).")).toEqual([
      { kind: "strong", text: "A:" },
      { kind: "text", text: " see " },
      { kind: "code", text: "x" },
      { kind: "text", text: " and " },
      { kind: "link", text: "docs", href: "test-results.md" },
      { kind: "text", text: "." },
    ]);
  });

  it("compares versions and filters links", () => {
    expect(compareVersions("0.31.0", "0.9.9")).toBe(1);
    expect(compareVersions("0.30.0", "0.30.0")).toBe(0);
    expect(compareVersions("0.29.1", "0.30.0")).toBe(-1);
    expect(safeHref("javascript:alert(1)", "https://x/docs/")).toBeNull();
    expect(safeHref("adr/025.md", "https://x/docs/")).toBe(
      "https://x/docs/adr/025.md",
    );
  });

  it("the real changelog lists the package version first, newest first", () => {
    const releases = parseChangelog(readFileSync("docs/changelog.md", "utf8"));
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(releases[0].version).toBe(pkg.version);
    for (let i = 1; i < releases.length; i++)
      expect(
        compareVersions(releases[i - 1].version, releases[i].version),
      ).toBe(1);
  });
});
