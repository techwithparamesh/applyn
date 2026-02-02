export type ImageVariant = "hero" | "card" | "generic";

function normalizeToken(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasAnyToken(haystack: string, needles: string[]) {
  const h = normalizeToken(haystack);
  return needles.some((n) => h.includes(normalizeToken(n)));
}

export function enrichImageQuery(query: string, industry?: string | null, variant: ImageVariant = "generic"): string {
  const base = String(query || "").trim();
  if (!base) return "";

  const industryId = String(industry || "").trim().toLowerCase();

  const industryHint = (() => {
    if (!industryId) return "";
    if (industryId.includes("health") || industryId.includes("clinic") || industryId.includes("medical")) {
      return "professional medical clinic clean bright high resolution";
    }
    if (industryId.includes("restaurant") || industryId.includes("food") || industryId.includes("cafe")) {
      return "professional food photography warm lighting high resolution";
    }
    if (industryId.includes("ecommerce") || industryId.includes("store") || industryId.includes("shop")) {
      return "studio product photography clean background high resolution";
    }
    if (industryId.includes("real") || industryId.includes("property") || industryId.includes("estate")) {
      return "modern real estate photography bright natural light high resolution";
    }
    if (industryId.includes("salon") || industryId.includes("spa") || industryId.includes("beauty")) {
      return "beauty salon interior lifestyle photography soft lighting high resolution";
    }
    if (industryId.includes("education") || industryId.includes("school") || industryId.includes("course")) {
      return "modern classroom learning environment professional photography high resolution";
    }
    return "professional photography high resolution";
  })();

  const variantHint = (() => {
    switch (variant) {
      case "hero":
        return "wide hero banner landscape";
      case "card":
        return "centered subject minimal background";
      default:
        return "";
    }
  })();

  // Avoid obvious duplication.
  const parts: string[] = [base];
  if (industryHint && !hasAnyToken(base, ["professional", "photography", "high resolution"])) parts.push(industryHint);
  if (variantHint && !hasAnyToken(base, ["banner", "landscape"]) && variant === "hero") parts.push(variantHint);
  if (variantHint && !hasAnyToken(base, ["centered", "minimal", "background"]) && variant === "card") parts.push(variantHint);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
