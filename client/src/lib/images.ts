import { isHttpUrl } from "@/lib/utils";

const DEFAULT_IMAGE_HOST_ALLOWLIST = [
  "images.unsplash.com",
  "plus.unsplash.com",
  "source.unsplash.com",
  "picsum.photos",
] as const;

export type ResolveImageOptions = {
  allowlist?: readonly string[];
  /** If true, routes allowlisted https hosts through the same-origin proxy to avoid client-side blocking. */
  useProxyForAllowlistedHttps?: boolean;
  /** The proxy endpoint path (same-origin). */
  proxyPath?: string;
};

export function resolveImageSrc(
  src: string | null | undefined,
  opts: ResolveImageOptions = {},
) {
  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  if (!normalizedSrc) return "";

  const {
    allowlist = DEFAULT_IMAGE_HOST_ALLOWLIST,
    useProxyForAllowlistedHttps = true,
    proxyPath = "/api/image-proxy",
  } = opts;

  // If it's not an absolute URL, leave as-is (could be data:, blob:, or same-origin path).
  if (!isHttpUrl(normalizedSrc)) return normalizedSrc;

  if (!useProxyForAllowlistedHttps) return normalizedSrc;

  try {
    const u = new URL(normalizedSrc);
    if (u.protocol === "https:" && allowlist.includes(u.hostname)) {
      return `${proxyPath}?url=${encodeURIComponent(normalizedSrc)}`;
    }
  } catch {
    // ignore
  }

  return normalizedSrc;
}
