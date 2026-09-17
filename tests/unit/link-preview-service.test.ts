import { describe, expect, it, vi } from "vitest";
import { LinkPreviewService } from "../../apps/server/link-preview-service";

const html = (title: string, image = "/cover.png") =>
  Buffer.from(
    `<meta property="og:title" content="${title}"><meta property="og:image" content="${image}"><meta property="og:description" content="Summary">`,
  );

describe("link preview cache", () => {
  it("reuses canonical cached metadata until its TTL expires", async () => {
    let now = Date.parse("2026-09-17T00:00:00.000Z");
    const fetcher = vi.fn(async (url: string, kind: "html" | "image") => ({
      url,
      bytes: kind === "html" ? html("Cached title") : Buffer.from("image"),
    }));
    const assets = {
      putAsset: vi.fn(async () => ({
        image: true,
        url: "/api/assets/cached.jpg",
      })),
    };
    const service = new LinkPreviewService(assets, {
      clock: () => now,
      fetcher,
      ttlMs: 1_000,
    });
    const signal = AbortSignal.timeout(5_000);

    const first = await service.get("https://example.com/post#one", signal);
    const second = await service.get("https://example.com/post#two", signal);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      title: "Cached title",
      description: "Summary",
      image: "/api/assets/cached.jpg",
      fetchedAt: "2026-09-17T00:00:00.000Z",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(assets.putAsset).toHaveBeenCalledTimes(1);

    now += 1_001;
    await service.get("https://example.com/post", signal);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("evicts the least recently used entry at the configured bound", async () => {
    const fetcher = vi.fn(async (url: string) => ({
      url,
      bytes: html(new URL(url).hostname, ""),
    }));
    const service = new LinkPreviewService(
      { putAsset: vi.fn() },
      { fetcher, maxEntries: 2 },
    );
    const signal = AbortSignal.timeout(5_000);

    await service.get("https://one.example", signal);
    await service.get("https://two.example", signal);
    await service.get("https://one.example", signal);
    await service.get("https://three.example", signal);
    await service.get("https://two.example", signal);

    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("keeps title metadata when the optional image fetch fails", async () => {
    const fetcher = vi.fn(async (url: string, kind: "html" | "image") => {
      if (kind === "image") throw new Error("image unavailable");
      return { url, bytes: html("Text survives") };
    });
    const service = new LinkPreviewService({ putAsset: vi.fn() }, { fetcher });

    await expect(
      service.get("https://example.com", AbortSignal.timeout(5_000)),
    ).resolves.toMatchObject({ title: "Text survives", image: undefined });
  });
});
