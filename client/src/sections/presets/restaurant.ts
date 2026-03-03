import type { AppBlueprint, ThemePresetId } from "@shared/blueprints";

type RestaurantVariant = "default" | "biryani";

function detectRestaurantVariant(prompt: string): RestaurantVariant {
  const p = String(prompt || "").toLowerCase();
  if (p.includes("biryani") || p.includes("hyderabadi") || p.includes("indian")) return "biryani";
  return "default";
}

export function buildRestaurantBlueprint(args: { appName: string; prompt?: string }): AppBlueprint {
  const variant = detectRestaurantVariant(args.prompt || "");
  const appName = args.appName || "Restaurant";

  const theme: ThemePresetId = "restaurant-modern";

  const menuItems =
    variant === "biryani"
      ? [
          {
            id: "m1",
            name: "Hyderabadi Chicken Biryani",
            price: "₹299",
            image: { kind: "keyword" as const, keyword: "hyderabadi chicken biryani", w: 600, orientation: "squarish" as const },
            rating: 4.8,
            badge: "Top",
            desc: "Aromatic basmati, slow-cooked masala",
            action: "product:m1",
          },
          {
            id: "m2",
            name: "Paneer Biryani",
            price: "₹279",
            image: { kind: "keyword" as const, keyword: "paneer biryani", w: 600, orientation: "squarish" as const },
            rating: 4.6,
            desc: "Spiced paneer, fragrant rice",
            action: "product:m2",
          },
          {
            id: "m3",
            name: "Mirchi Ka Salan",
            price: "₹149",
            image: { kind: "keyword" as const, keyword: "mirchi ka salan", w: 600, orientation: "squarish" as const },
            rating: 4.5,
            desc: "Classic peanut-sesame curry",
            action: "product:m3",
          },
          {
            id: "m4",
            name: "Double Ka Meetha",
            price: "₹129",
            image: { kind: "keyword" as const, keyword: "double ka meetha dessert", w: 600, orientation: "squarish" as const },
            rating: 4.4,
            desc: "Hyderabadi bread pudding",
            action: "product:m4",
          },
        ]
      : [
          {
            id: "m1",
            name: "Signature Burger",
            price: "$12.99",
            image: { kind: "keyword" as const, keyword: "gourmet burger", w: 600, orientation: "squarish" as const },
            rating: 4.7,
            badge: "Popular",
            desc: "Juicy patty, house sauce",
            action: "product:m1",
          },
          {
            id: "m2",
            name: "Truffle Fries",
            price: "$6.50",
            image: { kind: "keyword" as const, keyword: "truffle fries", w: 600, orientation: "squarish" as const },
            rating: 4.6,
            desc: "Crispy fries, parmesan",
            action: "product:m2",
          },
          {
            id: "m3",
            name: "Garden Salad",
            price: "$8.00",
            image: { kind: "keyword" as const, keyword: "fresh salad bowl", w: 600, orientation: "squarish" as const },
            rating: 4.4,
            desc: "Seasonal greens, vinaigrette",
            action: "product:m3",
          },
          {
            id: "m4",
            name: "Chocolate Lava Cake",
            price: "$7.50",
            image: { kind: "keyword" as const, keyword: "chocolate lava cake", w: 600, orientation: "squarish" as const },
            rating: 4.8,
            desc: "Warm center, vanilla scoop",
            action: "product:m4",
          },
        ];

  const orderItems = [
    { id: "o101", title: "Order #101", subtitle: "Preparing • ETA 25 min", total: variant === "biryani" ? "₹578" : "$26.49", status: "Preparing" },
    { id: "o097", title: "Order #097", subtitle: "Delivered • Yesterday", total: variant === "biryani" ? "₹428" : "$18.00", status: "Delivered" },
  ];

  return {
    version: "1",
    appName,
    businessType: "restaurant",
    theme,
    screens: [
      {
        id: "home",
        name: "Home",
        icon: "home",
        isHome: true,
        sections: [
          {
            id: "hero",
            type: "hero",
            title: appName,
            subtitle: variant === "biryani" ? "Authentic biryani & Hyderabadi specials" : "Fresh food, fast delivery",
            ctaText: "Order Now",
            ctaAction: "navigate:menu",
            secondaryCtaText: "View Menu",
            secondaryCtaAction: "navigate:menu",
            background: {
              kind: "keyword",
              keyword: variant === "biryani" ? "hyderabadi biryani spread" : "modern restaurant dining table",
              w: 1200,
              orientation: "landscape",
            },
            overlay: "rgba(0,0,0,0.45)",
          },
          {
            id: "brand",
            type: "textBlock",
            title: "Introduce your restaurant",
            body: "Share your story, signature dishes, and what makes your place special. Edit this section in the visual editor to add your own copy and images.",
            primaryCtaText: "View Menu",
            primaryCtaAction: "navigate:menu",
            secondaryCtaText: "Reserve a table",
            secondaryCtaAction: "navigate:reservations",
          },
          {
            id: "popular",
            type: "productGrid",
            title: "Popular dishes",
            subtitle: "Our bestsellers and today's picks",
            showMoreAction: "navigate:menu",
            columns: 2,
            products: menuItems.slice(0, 4),
          },
          {
            id: "promos",
            type: "promoCarousel",
            title: "Offers",
            items: [
              {
                title: variant === "biryani" ? "Family Pack" : "Free Delivery",
                subtitle: variant === "biryani" ? "Perfect for 3–4 people" : "On orders over $25",
                image: { kind: "keyword", keyword: variant === "biryani" ? "biryani family pack" : "food delivery bag", w: 900, orientation: "landscape" },
                ctaText: "View",
                ctaAction: "navigate:menu",
              },
              {
                title: "Member Deals",
                subtitle: "Extra savings in the app",
                image: { kind: "keyword", keyword: "restaurant discount banner", w: 900, orientation: "landscape" },
                ctaText: "Join",
                ctaAction: "navigate:account",
              },
            ],
          },
        ],
      },
      {
        id: "menu",
        name: "Menu",
        icon: "restaurant",
        sections: [
          { id: "search", type: "searchBar", placeholder: "Search menu…" },
          { id: "filters", type: "filterChips", chips: variant === "biryani" ? ["All", "Biryani", "Starters", "Curries", "Desserts"] : ["All", "Burgers", "Sides", "Salads", "Dessert"] },
          { id: "items", type: "productGrid", title: "Recommended", columns: 2, products: menuItems },
        ],
      },
      {
        id: "orders",
        name: "Orders",
        icon: "list",
        sections: [
          { id: "sp1", type: "spacer", size: "sm" },
          { id: "orders", type: "orderList", items: orderItems },
        ],
      },
      {
        id: "reservations",
        name: "Reservations",
        icon: "calendar",
        sections: [
          {
            id: "cta",
            type: "hero",
            title: "Reserve a table",
            subtitle: "Pick a time and we’ll hold your spot",
            ctaText: "Book Now",
            ctaAction: "action:reserve",
            background: { kind: "keyword", keyword: "restaurant table reservation", w: 1200, orientation: "landscape" },
            overlay: "rgba(0,0,0,0.45)",
          },
          {
            id: "actions",
            type: "accountMenu",
            items: [
              { id: "r1", label: "Book a table", icon: "🗓️", action: "action:reserve" },
              { id: "r2", label: "Call restaurant", icon: "📞", action: "action:call" },
              { id: "r3", label: "Get directions", icon: "📍", action: "action:map" },
            ],
          },
        ],
      },
      {
        id: "account",
        name: "Account",
        icon: "user",
        sections: [
          {
            id: "menu",
            type: "accountMenu",
            items: [
              { id: "a1", label: "Profile", icon: "🪪", action: "navigate:account" },
              { id: "a2", label: "Saved addresses", icon: "🏠", action: "action:addresses" },
              { id: "a3", label: "Payments", icon: "💳", action: "action:payments" },
              { id: "a4", label: "Support", icon: "💬", action: "action:support" },
              { id: "a5", label: "Logout", icon: "🚪", action: "logout" },
            ],
          },
        ],
      },
    ],
  };
}
