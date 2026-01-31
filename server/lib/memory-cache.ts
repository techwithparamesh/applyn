import crypto from "crypto";

export type CachedImage = {
  body: Buffer;
  contentType: string;
  etag: string;
  expiresAt: number;
};

export type MemoryCacheOptions = {
  maxEntries: number;
  defaultTtlMs: number;
};

export class MemoryCache {
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private readonly map = new Map<string, CachedImage>();

  constructor(opts: MemoryCacheOptions) {
    this.maxEntries = Math.max(10, Math.floor(opts.maxEntries));
    this.defaultTtlMs = Math.max(1000, Math.floor(opts.defaultTtlMs));
  }

  get(key: string): CachedImage | null {
    const hit = this.map.get(key);
    if (!hit) return null;

    if (Date.now() > hit.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // LRU-ish: refresh insertion order
    this.map.delete(key);
    this.map.set(key, hit);
    return hit;
  }

  set(key: string, value: Omit<CachedImage, "etag" | "expiresAt"> & { ttlMs?: number; etag?: string }) {
    const ttlMs = Math.max(0, Math.floor(value.ttlMs ?? this.defaultTtlMs));
    const etag = value.etag || strongEtag(value.body);

    const entry: CachedImage = {
      body: value.body,
      contentType: value.contentType,
      etag,
      expiresAt: Date.now() + ttlMs,
    };

    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, entry);

    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.map.delete(oldestKey);
    }

    return entry;
  }
}

export function strongEtag(buf: Buffer) {
  const hash = crypto.createHash("sha256").update(buf).digest("base64url");
  return `\"${hash}\"`;
}
