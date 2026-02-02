import type { ImageRef } from "@shared/blueprints";
import { enrichImageQuery, type ImageVariant } from "@shared/image-query";

function encodeQueryParam(v: string): string {
  return encodeURIComponent(v).replace(/%20/g, "%20");
}

export function hydrateImageRefToUrl(image: ImageRef | undefined): string | undefined {
  if (!image) return undefined;
  if (image.kind === "url") return image.url;

  return hydrateKeywordToUrl(image.keyword, {
    w: image.w,
    orientation: image.orientation,
    ratio: image.ratio,
  });
}

export type HydrateImageOptions = {
  industry?: string | null;
  variant?: ImageVariant;
  w?: number;
  orientation?: "landscape" | "portrait" | "squarish";
  ratio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
};

export function hydrateKeywordToUrl(keyword: string, options?: HydrateImageOptions): string {
  const variant = options?.variant ?? "generic";
  const enriched = enrichImageQuery(keyword, options?.industry, variant);

  const query = encodeQueryParam(enriched);
  const ratio = options?.ratio;

  const orientation =
    options?.orientation ||
    (ratio === "16:9" ? "landscape" : ratio === "9:16" ? "portrait" : ratio === "1:1" ? "squarish" : undefined) ||
    (variant === "hero" ? "landscape" : variant === "card" ? "squarish" : undefined);

  const w =
    (typeof options?.w === "number" ? options.w : undefined) ||
    (variant === "hero" ? 1600 : variant === "card" ? 900 : undefined);

  const params: string[] = [`query=${query}`];
  if (w) params.push(`w=${w}`);
  if (orientation) params.push(`orientation=${encodeQueryParam(orientation)}`);

  return `/api/unsplash/proxy?${params.join("&")}`;
}
