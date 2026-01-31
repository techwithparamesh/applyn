import type { AppBlueprint, ThemePresetId } from "@shared/blueprints";

type RealEstateVariant = "default" | "luxury";

function detectRealEstateVariant(prompt: string): RealEstateVariant {
  const p = String(prompt || "").toLowerCase();
  if (p.includes("luxury") || p.includes("premium") || p.includes("penthouse")) return "luxury";
  return "default";
}

export function buildRealEstateBlueprint(args: { appName: string; prompt?: string }): AppBlueprint {
  const variant = detectRealEstateVariant(args.prompt || "");
  const appName = args.appName || "Real Estate";
  const theme: ThemePresetId = "realestate-minimal";

  const listings =
    variant === "luxury"
      ? [
          {
            id: "l1",
            name: "Downtown Penthouse",
            price: "$2.45M",
            image: { kind: "keyword" as const, keyword: "luxury penthouse interior", w: 700, orientation: "squarish" as const },
            rating: 4.9,
            badge: "New",
            desc: "3 bed • Skyline views",
            action: "product:l1",
          },
          {
            id: "l2",
            name: "Modern Villa",
            price: "$3.10M",
            image: { kind: "keyword" as const, keyword: "modern luxury villa exterior", w: 700, orientation: "squarish" as const },
            rating: 4.8,
            badge: "Featured",
            desc: "5 bed • Pool • Garden",
            action: "product:l2",
          },
          {
            id: "l3",
            name: "Waterfront Condo",
            price: "$1.25M",
            image: { kind: "keyword" as const, keyword: "waterfront condo building", w: 700, orientation: "squarish" as const },
            rating: 4.7,
            desc: "2 bed • Marina access",
            action: "product:l3",
          },
          {
            id: "l4",
            name: "Designer Loft",
            price: "$980K",
            image: { kind: "keyword" as const, keyword: "industrial loft apartment", w: 700, orientation: "squarish" as const },
            rating: 4.6,
            desc: "Open-plan • High ceilings",
            action: "product:l4",
          },
        ]
      : [
          {
            id: "l1",
            name: "Family Home",
            price: "$520K",
            image: { kind: "keyword" as const, keyword: "suburban family house exterior", w: 700, orientation: "squarish" as const },
            rating: 4.6,
            badge: "Open House",
            desc: "3 bed • 2 bath • Garage",
            action: "product:l1",
          },
          {
            id: "l2",
            name: "City Apartment",
            price: "$340K",
            image: { kind: "keyword" as const, keyword: "modern city apartment interior", w: 700, orientation: "squarish" as const },
            rating: 4.5,
            desc: "2 bed • Near transit",
            action: "product:l2",
          },
          {
            id: "l3",
            name: "Cozy Cottage",
            price: "$410K",
            image: { kind: "keyword" as const, keyword: "cozy cottage house", w: 700, orientation: "squarish" as const },
            rating: 4.7,
            desc: "2 bed • Quiet neighborhood",
            action: "product:l3",
          },
          {
            id: "l4",
            name: "New Build Townhome",
            price: "$465K",
            image: { kind: "keyword" as const, keyword: "new build townhome exterior", w: 700, orientation: "squarish" as const },
            rating: 4.4,
            desc: "3 bed • Modern finishes",
            action: "product:l4",
          },
        ];

  const agents = [
    {
      id: "a1",
      name: "Ava Patel",
      price: "Top Agent",
      image: { kind: "keyword" as const, keyword: "real estate agent portrait", w: 700, orientation: "squarish" as const },
      rating: 4.9,
      desc: "Residential • 8 yrs",
      action: "action:agent_a1",
    },
    {
      id: "a2",
      name: "Noah Kim",
      price: "Luxury",
      image: { kind: "keyword" as const, keyword: "professional realtor portrait", w: 700, orientation: "squarish" as const },
      rating: 4.8,
      desc: "Luxury • 10 yrs",
      action: "action:agent_a2",
    },
  ];

  return {
    version: "1",
    appName,
    businessType: "realestate",
    theme,
    screens: [
      {
        id: "search",
        name: "Search",
        icon: "🔎",
        isHome: true,
        sections: [
          {
            id: "hero",
            type: "hero",
            title: "Find your next home",
            subtitle: variant === "luxury" ? "Premium listings, curated for you" : "Browse listings and book tours",
            ctaText: "Explore",
            ctaAction: "navigate:listings",
            background: { kind: "keyword", keyword: variant === "luxury" ? "luxury home exterior" : "modern house exterior", w: 1200, orientation: "landscape" },
            overlay: "rgba(0,0,0,0.45)",
          },
          { id: "searchbar", type: "searchBar", placeholder: "City, neighborhood, ZIP…" },
          { id: "filters", type: "filterChips", chips: ["All", "House", "Apartment", "Townhome", "New"] },
          { id: "top", type: "productGrid", title: "Top listings", columns: 2, products: listings.slice(0, 4) },
        ],
      },
      {
        id: "listings",
        name: "Listings",
        icon: "🏘️",
        sections: [
          { id: "searchbar", type: "searchBar", placeholder: "Search listings…" },
          { id: "filters", type: "filterChips", chips: ["All", "Under $500k", "2+ beds", "Open house", "New"] },
          { id: "grid", type: "productGrid", title: "Listings", columns: 2, products: listings },
        ],
      },
      {
        id: "saved",
        name: "Saved",
        icon: "❤️",
        sections: [
          { id: "grid", type: "productGrid", title: "Saved homes", columns: 2, products: listings.slice(0, 2) },
        ],
      },
      {
        id: "agents",
        name: "Agents",
        icon: "🧑‍💼",
        sections: [
          { id: "search", type: "searchBar", placeholder: "Search agents…" },
          { id: "grid", type: "productGrid", title: "Featured agents", columns: 2, products: agents },
        ],
      },
      {
        id: "more",
        name: "More",
        icon: "☰",
        sections: [
          {
            id: "menu",
            type: "accountMenu",
            items: [
              { id: "m1", label: "Mortgage calculator", icon: "🧮", action: "action:mortgage" },
              { id: "m2", label: "Schedule tour", icon: "📅", action: "action:tour" },
              { id: "m3", label: "Contact us", icon: "💬", action: "action:contact" },
              { id: "m4", label: "Settings", icon: "⚙️", action: "action:settings" },
            ],
          },
        ],
      },
    ],
  };
}
