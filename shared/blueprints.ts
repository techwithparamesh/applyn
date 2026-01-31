import { z } from "zod";

// --- Business + theme primitives ---

export const businessTypeSchema = z.enum([
  "ecommerce",
  "restaurant",
  "realestate",
  "healthcare",
  "salon",
  "education",
  "news",
  "music",
  "radio",
  "church",
  "business",
]);
export type BusinessType = z.infer<typeof businessTypeSchema>;

export const themePresetIdSchema = z.enum([
  "streetwear",
  "grocery",
  "restaurant-modern",
  "realestate-minimal",
  "healthcare-calm",
  "default",
]);
export type ThemePresetId = z.infer<typeof themePresetIdSchema>;

export const imageRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("url"),
    url: z.string().min(1).max(4000),
    alt: z.string().max(200).optional(),
    // Rendering hints (used by section templates; not interpreted by the renderer)
    ratio: z.enum(["1:1", "4:3", "3:4", "16:9", "9:16"]).optional(),
    fit: z.enum(["cover", "contain"]).optional(),
  }),
  z.object({
    kind: z.literal("keyword"),
    keyword: z.string().min(2).max(200),
    alt: z.string().max(200).optional(),
    // Optional constraints for upstream search/proxying
    orientation: z.enum(["landscape", "portrait", "squarish"]).optional(),
    w: z.number().int().min(64).max(4000).optional(),
    ratio: z.enum(["1:1", "4:3", "3:4", "16:9", "9:16"]).optional(),
  }),
]);
export type ImageRef = z.infer<typeof imageRefSchema>;

// --- Section blueprints ---

export const sectionTypeSchema = z.enum([
  "hero",
  "categoryGrid",
  "productGrid",
  "promoCarousel",
  "searchBar",
  "filterChips",
  "cartList",
  "orderList",
  "accountMenu",
  "divider",
  "spacer",
]);
export type SectionType = z.infer<typeof sectionTypeSchema>;

const baseSectionSchema = z.object({
  id: z.string().min(1),
  type: sectionTypeSchema,
});

export const heroSectionSchema = baseSectionSchema.extend({
  type: z.literal("hero"),
  title: z.string().min(1).max(80),
  subtitle: z.string().max(140).optional(),
  ctaText: z.string().max(32).optional(),
  ctaAction: z.string().max(200).optional(),
  background: imageRefSchema.optional(),
  overlay: z.string().max(32).optional(),
});

export const categoryGridSectionSchema = baseSectionSchema.extend({
  type: z.literal("categoryGrid"),
  title: z.string().max(60).optional(),
  columns: z.number().int().min(2).max(4).default(3),
  categories: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(40),
        icon: z.string().max(10).optional(),
        action: z.string().max(200).optional(),
      })
    )
    .min(3)
    .max(12),
});

export const productGridSectionSchema = baseSectionSchema.extend({
  type: z.literal("productGrid"),
  title: z.string().max(60).optional(),
  showMoreAction: z.string().max(200).optional(),
  columns: z.number().int().min(1).max(2).default(2),
  products: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(80),
        price: z.string().min(1).max(32),
        image: imageRefSchema.optional(),
        rating: z.number().min(0).max(5).optional(),
        badge: z.string().max(24).optional(),
        category: z.string().max(40).optional(),
        desc: z.string().max(120).optional(),
        action: z.string().max(200).optional(),
      })
    )
    .min(2)
    .max(24),
});

export const promoCarouselSectionSchema = baseSectionSchema.extend({
  type: z.literal("promoCarousel"),
  title: z.string().max(60).optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        subtitle: z.string().max(120).optional(),
        image: imageRefSchema.optional(),
        ctaText: z.string().max(32).optional(),
        ctaAction: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(10),
});

export const searchBarSectionSchema = baseSectionSchema.extend({
  type: z.literal("searchBar"),
  placeholder: z.string().max(80).default("Search…"),
});

export const filterChipsSectionSchema = baseSectionSchema.extend({
  type: z.literal("filterChips"),
  chips: z.array(z.string().min(1).max(24)).min(2).max(12),
});

export const cartListSectionSchema = baseSectionSchema.extend({
  type: z.literal("cartList"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(80),
        price: z.string().min(1).max(32),
        quantity: z.number().int().min(1).max(99),
        image: imageRefSchema.optional(),
      })
    )
    .min(1)
    .max(50),
});

export const orderListSectionSchema = baseSectionSchema.extend({
  type: z.literal("orderList"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(80),
        subtitle: z.string().max(120).optional(),
        total: z.string().max(32).optional(),
        status: z.string().max(24).optional(),
      })
    )
    .min(1)
    .max(50),
});

export const accountMenuSectionSchema = baseSectionSchema.extend({
  type: z.literal("accountMenu"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(40),
        icon: z.string().max(10).optional(),
        action: z.string().max(200).optional(),
      })
    )
    .min(2)
    .max(12),
});

export const spacerSectionSchema = baseSectionSchema.extend({
  type: z.literal("spacer"),
  size: z.enum(["xs", "sm", "md", "lg"]).default("md"),
});

export const dividerSectionSchema = baseSectionSchema.extend({
  type: z.literal("divider"),
});

export const sectionBlueprintSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  categoryGridSectionSchema,
  productGridSectionSchema,
  promoCarouselSectionSchema,
  searchBarSectionSchema,
  filterChipsSectionSchema,
  cartListSectionSchema,
  orderListSectionSchema,
  accountMenuSectionSchema,
  spacerSectionSchema,
  dividerSectionSchema,
]);
export type SectionBlueprint = z.infer<typeof sectionBlueprintSchema>;

export const screenBlueprintSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  icon: z.string().max(10).optional(),
  isHome: z.boolean().optional(),
  sections: z.array(sectionBlueprintSchema).min(1).max(50),
});
export type ScreenBlueprint = z.infer<typeof screenBlueprintSchema>;

export const appBlueprintSchema = z.object({
  version: z.literal("1").default("1"),
  appName: z.string().min(1).max(80),
  businessType: businessTypeSchema.default("business"),
  theme: themePresetIdSchema.default("default"),
  screens: z.array(screenBlueprintSchema).min(1).max(20),
});
export type AppBlueprint = z.infer<typeof appBlueprintSchema>;
