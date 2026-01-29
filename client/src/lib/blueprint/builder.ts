import type { AppBlueprint, BlueprintCategory, BlueprintProduct } from "./types";

export type EditorComponent = {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: EditorComponent[];
};

export type EditorScreen = {
  id: string;
  name: string;
  icon: string;
  components: EditorComponent[];
  isHome?: boolean;
};

export type BuiltFromBlueprint = {
  screens: EditorScreen[];
  patch: {
    name?: string;
    icon?: string;
    primaryColor?: string;
    iconColor?: string;
    isNativeOnly?: boolean;
    url?: string;
    editorScreens: EditorScreen[];
    navigation?: {
      style: "bottom-tabs";
      items: Array<{
        id: string;
        label: string;
        icon?: string;
        kind: "screen";
        screenId: string;
      }>;
    };
    features?: {
      bottomNav?: boolean;
    };
  };
  resolvedImages: {
    categories: Record<string, string>;
    products: Record<string, string>;
    hero?: string;
  };
};

function normalizeHexColor(input: unknown, fallback: string) {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s) return fallback;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^[0-9a-f]{3,8}$/i.test(s)) return `#${s}`;
  return fallback;
}

function newId(prefix: string) {
  const c: any = (globalThis as any).crypto;
  const uuid = typeof c?.randomUUID === "function" ? c.randomUUID() : null;
  return uuid ? `${prefix}_${uuid}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function money(amount: number, currency: string) {
  const n = Number.isFinite(amount) ? amount : 0;
  const c = (currency || "USD").toUpperCase();
  // Keep it simple and consistent with existing preview expectations (string like "$12.99").
  const symbol = c === "USD" ? "$" : c === "EUR" ? "€" : c === "GBP" ? "£" : `${c} `;
  return `${symbol}${n.toFixed(2)}`;
}

function picsumFallback(keyword: string) {
  const seed = encodeURIComponent((keyword || "image").slice(0, 60));
  return `https://picsum.photos/seed/${seed}/800/600`;
}

async function fetchUnsplashImage(keyword: string): Promise<string | null> {
  const q = (keyword || "").trim();
  if (!q) return null;
  try {
    const res = await fetch(`/api/unsplash/image?query=${encodeURIComponent(q)}&w=1200`);
    if (!res.ok) return null;
    const data = await res.json();
    const url = typeof data?.url === "string" ? data.url : "";
    return url || null;
  } catch {
    return null;
  }
}

function createImageResolver() {
  const cache = new Map<string, Promise<string>>();

  const credits = new Map<string, { name: string; url?: string }>();
  const recordCredit = (credit: any) => {
    const name = typeof credit?.name === "string" ? credit.name.trim() : "";
    const url = typeof credit?.url === "string" ? credit.url.trim() : "";
    if (!name) return;
    const key = url || name;
    if (!credits.has(key)) credits.set(key, { name, url: url || undefined });
  };

  const resolve = async (keyword?: string) => {
    const k = (keyword || "").trim();
    if (!k) return picsumFallback("image");

    if (!cache.has(k)) {
      cache.set(
        k,
        (async () => {
          try {
            const res = await fetch(`/api/unsplash/image?query=${encodeURIComponent(k)}&w=1200`);
            if (res.ok) {
              const data: any = await res.json();
              if (typeof data?.url === "string" && data.url.trim()) {
                recordCredit(data?.credit);
                return data.url.trim();
              }
            }
          } catch {
            // ignore
          }
          return picsumFallback(k);
        })(),
      );
    }

    return await cache.get(k)!;
  };

  const getCredits = () => Array.from(credits.values());

  return { resolve, getCredits };
}

function categoryNameById(categories: BlueprintCategory[], id?: string) {
  if (!id) return "";
  return categories.find((c) => c.id === id)?.name || "";
}

function buildHeroComponent(opts: {
  id: string;
  title: string;
  subtitle?: string;
  buttonText?: string;
  backgroundImage?: string;
  primaryColor: string;
}) {
  return {
    id: opts.id,
    type: "hero",
    props: {
      title: opts.title,
      subtitle: opts.subtitle,
      buttonText: opts.buttonText,
      backgroundImage: opts.backgroundImage,
      overlayColor: "rgba(0,0,0,0.35)",
      height: 190,
      // fallback background if image missing
      backgroundColor: opts.primaryColor,
    },
  } satisfies EditorComponent;
}

function buildHeading(text: string, level: number, color?: string): EditorComponent {
  return {
    id: newId("cmp"),
    type: "heading",
    props: {
      text,
      level,
      color,
    },
  };
}

function buildSpacer(height = 12): EditorComponent {
  return { id: newId("cmp"), type: "spacer", props: { height } };
}

function buildCarousel(title: string, items: Array<{ title: string; image?: string; subtitle?: string }>): EditorComponent[] {
  return [
    buildHeading(title, 3),
    {
      id: newId("cmp"),
      type: "carousel",
      props: {
        items,
      },
    },
  ];
}

function buildProductGrid(title: string, products: Array<any>, columns = 2): EditorComponent[] {
  return [
    buildHeading(title, 3),
    {
      id: newId("cmp"),
      type: "productGrid",
      props: {
        products,
        columns,
      },
    },
  ];
}

export async function buildAppFromBlueprint(blueprint: AppBlueprint): Promise<BuiltFromBlueprint> {
  const currency = blueprint.settings?.currency || "USD";
  const primaryColor = normalizeHexColor(blueprint.theme?.primary_color, "#2563EB");
  const iconColor = normalizeHexColor(blueprint.theme?.secondary_color, primaryColor);

  const dataCategories = Array.isArray(blueprint.data?.categories) ? blueprint.data!.categories! : [];
  const dataProducts = Array.isArray(blueprint.data?.products) ? blueprint.data!.products! : [];

  const { resolve, getCredits } = createImageResolver();

  const resolvedCategories: Record<string, string> = {};
  await Promise.all(
    dataCategories.map(async (c) => {
      resolvedCategories[c.id] = await resolve(c.image_keyword || c.name);
    }),
  );

  const resolvedProducts: Record<string, string> = {};
  await Promise.all(
    dataProducts.map(async (p) => {
      resolvedProducts[p.id] = await resolve(p.image_keyword || p.name);
    }),
  );

  const heroKeyword = blueprint.content?.hero?.image_keyword;
  const resolvedHero = heroKeyword ? await resolve(heroKeyword) : undefined;

  const resolved = { categories: resolvedCategories, products: resolvedProducts, hero: resolvedHero };

  const cartItems = blueprint.data?.cart?.items || [];
  const resolvedCartImages = await Promise.all(
    cartItems.map(async (it) => {
      const keyword = String(it.image_keyword || it.name || "").trim();
      if (keyword) return await resolve(keyword);
      const byProduct = it.product_id ? resolved.products[it.product_id] : undefined;
      if (byProduct) return byProduct;
      return undefined;
    }),
  );

  const productsForGrid = dataProducts.map((p: BlueprintProduct) => ({
    id: p.id,
    name: p.name,
    price: money(p.price, p.currency || currency),
    image: resolved.products[p.id],
    category: categoryNameById(dataCategories, p.category_id),
    rating: p.rating,
  }));

  const categoriesForCarousel = dataCategories.map((c: BlueprintCategory) => ({
    title: c.name,
    image: resolved.categories[c.id],
    subtitle: "Browse",
  }));

  const screens: EditorScreen[] = blueprint.screens.map((s, idx) => {
    const components: EditorComponent[] = [];

    for (const c of s.components || []) {
      if (c.type === "hero_section") {
        const hero = blueprint.content?.hero;
        components.push(
          buildHeroComponent({
            id: c.component_id,
            title: hero?.headline || blueprint.app_name,
            subtitle: hero?.subheadline,
            buttonText: hero?.cta_text,
            backgroundImage: resolved.hero,
            primaryColor,
          }),
        );
        components.push(buildSpacer(14));
        continue;
      }

      if (c.type === "featured_categories") {
        components.push(...buildCarousel("Categories", categoriesForCarousel));
        components.push(buildSpacer(14));
        continue;
      }

      if (c.type === "product_grid") {
        components.push(...buildProductGrid("Featured", productsForGrid, 2));
        components.push(buildSpacer(8));
        continue;
      }

      if (c.type === "cart_summary") {
        components.push(buildHeading("Your Cart", 2));
        components.push({
          id: c.component_id,
          type: "list",
          props: {
            variant: "cart",
            items: cartItems.map((it, i) => ({
              name: it.name,
              quantity: it.quantity,
              price: money(it.price, currency),
              image: resolvedCartImages[i] ?? undefined,
            })),
          },
        });
        components.push(buildSpacer(10));
        components.push({
          id: newId("cmp"),
          type: "text",
          props: {
            text: `Total: ${money(blueprint.data?.cart?.total ?? 0, currency)}`,
            fontSize: 14,
            color: "#111827",
          },
        });
        components.push(buildSpacer(10));
        components.push({
          id: newId("cmp"),
          type: "button",
          props: {
            text: "Checkout",
            variant: "primary",
            backgroundColor: primaryColor,
            textColor: "#ffffff",
            size: "md",
          },
        });
        continue;
      }

      if (c.type === "orders_list") {
        const orders = blueprint.data?.orders || [];
        components.push(buildHeading("Orders", 2));
        components.push({
          id: c.component_id,
          type: "list",
          props: {
            variant: "orders",
            items: orders.map((o) => ({
              name: `Order ${o.id}`,
              status: o.status,
              total: money(o.total, currency),
            })),
          },
        });
        continue;
      }

      if (c.type === "account_menu") {
        const menu = blueprint.content?.account?.menu_items || [];
        components.push(buildHeading("Account", 2));
        components.push({
          id: c.component_id,
          type: "list",
          props: {
            variant: "menu",
            items: menu.map((m) => ({
              icon: m.icon || "⚙️",
              label: m.label,
            })),
          },
        });
        const supportEmail = blueprint.settings?.support?.email;
        const supportPhone = blueprint.settings?.support?.phone;
        const supportLine = [supportEmail && `Email: ${supportEmail}`, supportPhone && `Phone: ${supportPhone}`]
          .filter(Boolean)
          .join(" • ");
        if (supportLine) {
          components.push(buildSpacer(12));
          components.push({
            id: newId("cmp"),
            type: "text",
            props: { text: supportLine, fontSize: 12, color: "#6b7280" },
          });
        }
        continue;
      }

      // Fallback: render something visible
      components.push({
        id: c.component_id || newId("cmp"),
        type: "text",
        props: {
          text: `Unsupported blueprint component: ${String((c as any)?.type || "unknown")}`,
          fontSize: 12,
          color: "#6b7280",
        },
      });
    }

    return {
      id: s.screen_id,
      name: s.title,
      icon: s.icon || "📄",
      components,
      isHome: idx === 0,
    };
  });

  // Add a lightweight attribution line if we used Unsplash images.
  const credits = getCredits();
  if (screens.length > 0 && credits.length > 0) {
    const names = credits.map((c) => c.name).filter(Boolean);
    const unique = Array.from(new Set(names));
    const display = unique.slice(0, 3).join(", ");
    const more = unique.length > 3 ? ` +${unique.length - 3} more` : "";
    const text = display ? `Photos by ${display}${more} on Unsplash` : "Photos from Unsplash";
    screens[0] = {
      ...screens[0],
      components: [
        ...screens[0].components,
        buildSpacer(10),
        {
          id: newId("cmp"),
          type: "text",
          props: {
            text,
            fontSize: 11,
            color: "#6b7280",
          },
        },
      ],
    };
  }

  const navigationItems = (blueprint.navigation?.tabs || []).map((t) => ({
    id: newId("nav"),
    label: t.label,
    icon: t.icon,
    kind: "screen" as const,
    screenId: t.screen_id,
  }));

  return {
    screens,
    patch: {
      name: blueprint.app_name,
      icon: blueprint.logo?.icon || "🛍️",
      primaryColor,
      iconColor,
      isNativeOnly: true,
      url: "native://app",
      editorScreens: screens,
      navigation: {
        style: "bottom-tabs",
        items: navigationItems,
      },
      features: {
        bottomNav: true,
      },
    },
    resolvedImages: resolved,
  };
}
