import { describe, expect, it } from "vitest";
import { applicationFavicon, pageFavicon } from "../../apps/web/favicon";

const decodeSvg = (href: string) =>
  decodeURIComponent(href.replace("data:image/svg+xml,", ""));

describe("favicon generation", () => {
  it("uses the page icon and the same document fallback shown by the UI", () => {
    expect(decodeSvg(pageFavicon("🧭"))).toContain("🧭");
    expect(decodeSvg(pageFavicon())).toContain("📄");
  });

  it("escapes arbitrary stored icon text before embedding it in SVG", () => {
    const svg = decodeSvg(pageFavicon("<>&\"'"));
    expect(svg).toContain("&lt;&gt;&amp;&quot;&apos;");
    expect(svg).not.toContain("<>&\"'");
  });

  it("provides a stable application fallback", () => {
    const svg = decodeSvg(applicationFavicon);
    expect(svg).toContain("#37352f");
    expect(svg).toContain("<path");
  });
});
