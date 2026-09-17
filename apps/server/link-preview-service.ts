import type { LinkPreview } from "../../packages/document-schema/index";
import {
  LINK_PREVIEW_CACHE_MAX_ENTRIES,
  LINK_PREVIEW_CACHE_TTL_MS,
} from "../../packages/link-preview/constants";
import { fetchPublic, parsePreview, previewUrl } from "./link-preview";

type AssetStore = {
  putAsset(
    bytes: Buffer,
    name: string,
  ): Promise<{ image: boolean; url: string }>;
};

type PreviewFetcher = typeof fetchPublic;

export class LinkPreviewService {
  private readonly cache = new Map<
    string,
    { expiresAt: number; preview: LinkPreview }
  >();

  constructor(
    private readonly assets: AssetStore,
    private readonly options: {
      clock?: () => number;
      fetcher?: PreviewFetcher;
      maxEntries?: number;
      ttlMs?: number;
    } = {},
  ) {}

  async get(raw: string, signal: AbortSignal): Promise<LinkPreview> {
    const key = previewUrl(raw).href;
    const now = (this.options.clock ?? Date.now)();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.preview;
    }
    if (cached) this.cache.delete(key);

    const fetcher = this.options.fetcher ?? fetchPublic;
    const page = await fetcher(key, "html", signal);
    const metadata = parsePreview(page.bytes.toString("utf8"), page.url);
    let image: string | undefined;
    if (metadata.image) {
      try {
        const result = await fetcher(metadata.image, "image", signal);
        const asset = await this.assets.putAsset(result.bytes, "preview");
        if (asset.image) image = asset.url;
      } catch {
        // A missing image must not prevent usable title metadata.
      }
    }
    const preview: LinkPreview = {
      title: metadata.title,
      description: metadata.description,
      image,
      fetchedAt: new Date(now).toISOString(),
    };
    this.cache.set(key, {
      expiresAt: now + (this.options.ttlMs ?? LINK_PREVIEW_CACHE_TTL_MS),
      preview,
    });
    this.prune(now);
    return preview;
  }

  private prune(now: number) {
    for (const [key, value] of this.cache)
      if (value.expiresAt <= now) this.cache.delete(key);
    const maximum = this.options.maxEntries ?? LINK_PREVIEW_CACHE_MAX_ENTRIES;
    while (this.cache.size > maximum) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
