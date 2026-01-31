import type { BusinessType, ThemePresetId } from "@shared/blueprints";

export type BusinessPreset = {
  businessType: BusinessType;
  theme: ThemePresetId;
};

export const BUSINESS_PRESETS: Record<BusinessType, BusinessPreset> = {
  ecommerce: { businessType: "ecommerce", theme: "default" },
  restaurant: { businessType: "restaurant", theme: "restaurant-modern" },
  realestate: { businessType: "realestate", theme: "realestate-minimal" },
  healthcare: { businessType: "healthcare", theme: "healthcare-calm" },
  salon: { businessType: "salon", theme: "default" },
  education: { businessType: "education", theme: "default" },
  news: { businessType: "news", theme: "default" },
  music: { businessType: "music", theme: "default" },
  radio: { businessType: "radio", theme: "default" },
  church: { businessType: "church", theme: "default" },
  business: { businessType: "business", theme: "default" },
};

export function themeForBusinessType(businessType: BusinessType): ThemePresetId {
  return BUSINESS_PRESETS[businessType]?.theme ?? "default";
}
