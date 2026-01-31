import type { ImageRef } from "@shared/blueprints";

function encodeQueryParam(v: string): string {
  return encodeURIComponent(v).replace(/%20/g, "%20");
}

export function hydrateImageRefToUrl(image: ImageRef | undefined): string | undefined {
  if (!image) return undefined;
  if (image.kind === "url") return image.url;

  const query = encodeQueryParam(image.keyword);
  const w = typeof image.w === "number" ? image.w : undefined;
  const orientation = image.orientation;

  const params: string[] = [`query=${query}`];
  if (w) params.push(`w=${w}`);
  if (orientation) params.push(`orientation=${encodeQueryParam(orientation)}`);

  return `/api/unsplash/proxy?${params.join("&")}`;
}
