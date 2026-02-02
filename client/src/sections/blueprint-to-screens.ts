import type {
  AppBlueprint,
  ScreenBlueprint,
  SectionBlueprint,
} from "@shared/blueprints";
import { createIdFactory } from "@/sections/id-factory";
import { hydrateImageRefToUrl, hydrateKeywordToUrl } from "@/sections/image-hydration";

type NativeComponent = {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: NativeComponent[];
};

type NativeScreen = {
  id: string;
  name: string;
  icon?: string;
  isHome?: boolean;
  components: NativeComponent[];
};

function spacerHeight(size: "xs" | "sm" | "md" | "lg") {
  switch (size) {
    case "xs":
      return "var(--space-8)";
    case "sm":
      return "var(--space-16)";
    case "lg":
      return "var(--space-32)";
    default:
      return "var(--space-24)";
  }
}

function buildSectionComponents(
  section: SectionBlueprint,
  nextId: () => string,
  industry: AppBlueprint["businessType"],
): NativeComponent[] {
  switch (section.type) {
    case "hero": {
      const backgroundImage = section.background
        ? section.background.kind === "url"
          ? section.background.url
          : hydrateKeywordToUrl(section.background.keyword, { industry, variant: "hero", ratio: "16:9" })
        : undefined;
      return [
        {
          id: nextId(),
          type: "hero",
          props: {
            title: section.title,
            subtitle: section.subtitle,
            buttonText: section.ctaText,
            buttonAction: section.ctaAction,
            backgroundImage,
            overlayColor: section.overlay,
            height: 280,
          },
        },
      ];
    }
    case "categoryGrid": {
      const children: NativeComponent[] = [
        {
          id: nextId(),
          type: "grid",
          props: { columns: section.columns, gap: "var(--space-grid-gap)" },
          children: section.categories.map((c) => ({
            id: nextId(),
            type: "card",
            props: {
              title: c.title,
              icon: c.icon,
              compact: true,
              action: c.action,
            },
          })),
        },
      ];

      return [
        {
          id: nextId(),
          type: "section",
          props: { title: section.title || "Categories", padding: "var(--space-section-y)" },
          children,
        },
      ];
    }
    case "productGrid": {
      return [
        {
          id: nextId(),
          type: "section",
          props: {
            title: section.title || "Products",
            padding: "var(--space-section-y)",
            showMore: !!section.showMoreAction,
            showMoreAction: section.showMoreAction,
          },
          children: [
            {
              id: nextId(),
              type: "productGrid",
              props: {
                columns: section.columns,
                products: section.products.map((p) => ({
                  id: p.id,
                  name: p.name,
                  price: p.price,
                  image:
                    p.image?.kind === "url"
                      ? p.image.url
                      : p.image?.kind === "keyword"
                        ? hydrateKeywordToUrl(p.image.keyword, { industry, variant: "card", ratio: "1:1" })
                        : undefined,
                  rating: p.rating,
                  badge: p.badge,
                  category: p.category,
                  desc: p.desc,
                  action: p.action,
                })),
              },
            },
          ],
        },
      ];
    }
    case "promoCarousel": {
      return [
        {
          id: nextId(),
          type: "section",
          props: { title: section.title || "Offers", padding: "var(--space-section-y)", backgroundColor: "#FFF3E0" },
          children: [
            {
              id: nextId(),
              type: "carousel",
              props: {
                items: section.items.map((i) => ({
                  title: i.title,
                  subtitle: i.subtitle,
                  image:
                    i.image?.kind === "url"
                      ? i.image.url
                      : i.image?.kind === "keyword"
                        ? hydrateKeywordToUrl(i.image.keyword, { industry, variant: "hero", ratio: "16:9" })
                        : undefined,
                  buttonText: i.ctaText,
                  action: i.ctaAction,
                })),
              },
            },
          ],
        },
      ];
    }
    case "searchBar": {
      return [
        {
          id: nextId(),
          type: "container",
          props: { padding: "var(--space-card)", backgroundColor: "#f5f5f5" },
          children: [
            {
              id: nextId(),
              type: "input",
              props: { placeholder: section.placeholder, type: "search", icon: "search" },
            },
          ],
        },
      ];
    }
    case "filterChips": {
      return [
        {
          id: nextId(),
          type: "container",
          props: { padding: "var(--space-card)" },
          children: [
            {
              id: nextId(),
              type: "grid",
              props: { columns: Math.min(4, Math.max(2, section.chips.length)), gap: "var(--space-8)", scrollable: true },
              children: section.chips.map((text, idx) => ({
                id: nextId(),
                type: "button",
                props: { text, variant: idx === 0 ? "primary" : "outline", size: "sm" },
              })),
            },
          ],
        },
      ];
    }
    case "cartList": {
      return [
        {
          id: nextId(),
          type: "list",
          props: {
            variant: "cart",
            items: section.items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              image:
                i.image?.kind === "url"
                  ? i.image.url
                  : i.image?.kind === "keyword"
                    ? hydrateKeywordToUrl(i.image.keyword, { industry, variant: "card", ratio: "1:1" })
                    : undefined,
            })),
          },
        },
      ];
    }
    case "orderList": {
      return [
        {
          id: nextId(),
          type: "list",
          props: {
            variant: "orders",
            items: section.items.map((i) => ({
              id: i.id,
              name: i.title,
              status: i.status,
              price: i.total,
            })),
          },
        },
      ];
    }
    case "accountMenu": {
      return [
        {
          id: nextId(),
          type: "list",
          props: {
            variant: "menu",
            items: section.items.map((i) => ({
              id: i.id,
              label: i.label,
              icon: i.icon,
              action: i.action,
            })),
          },
        },
      ];
    }
    case "divider": {
      return [{ id: nextId(), type: "divider", props: { thickness: 1 } }];
    }
    case "spacer": {
      return [{ id: nextId(), type: "spacer", props: { height: spacerHeight(section.size) } }];
    }
    default: {
      const exhaustive: never = section;
      return [{ id: nextId(), type: "text", props: { text: `Unsupported section: ${(exhaustive as any)?.type}` } }];
    }
  }
}

function buildScreenComponents(screen: ScreenBlueprint, nextId: () => string, industry: AppBlueprint["businessType"]): NativeComponent[] {
  const out: NativeComponent[] = [];
  for (const section of screen.sections) {
    out.push(...buildSectionComponents(section, nextId, industry));
  }
  return out;
}

export function buildEditorScreensFromBlueprint(blueprint: AppBlueprint): NativeScreen[] {
  const nextId = createIdFactory("bp");
  return blueprint.screens.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    isHome: s.isHome,
    components: buildScreenComponents(s, nextId, blueprint.businessType),
  }));
}
