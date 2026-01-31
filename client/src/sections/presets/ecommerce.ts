import type { AppBlueprint, ThemePresetId } from "@shared/blueprints";

type EcommerceVariant = "default" | "streetwear";

function detectEcommerceVariant(prompt: string): EcommerceVariant {
  const p = String(prompt || "").toLowerCase();
  const has = (needle: string) => p.includes(needle);
  const streetwearSignals = [
    "streetwear",
    "street wear",
    "fashion",
    "clothing",
    "apparel",
    "hoodie",
    "hoodies",
    "tee",
    "t-shirt",
    "tshirt",
    "sneaker",
    "sneakers",
    "jacket",
    "denim",
    "cap",
    "caps",
    "hat",
    "urban",
  ];
  if (streetwearSignals.some((k) => has(k))) return "streetwear";
  return "default";
}

export function buildEcommerceBlueprint(args: { appName: string; prompt?: string }): AppBlueprint {
  const variant = detectEcommerceVariant(args.prompt || "");
  const appName = args.appName || "Store";

  const theme: ThemePresetId = variant === "streetwear" ? "streetwear" : "default";

  const products =
    variant === "streetwear"
      ? [
          {
            id: "1",
            name: "UrbanFit Oversized Hoodie",
            price: "$79.00",
            image: { kind: "keyword" as const, keyword: "oversized hoodie streetwear", w: 600, orientation: "squarish" as const },
            rating: 4.8,
            badge: "Drop",
            category: "Hoodies",
            desc: "Heavyweight fleece, boxy fit",
            action: "product:1",
          },
          {
            id: "2",
            name: "Graphic Tee — Night City",
            price: "$39.00",
            image: { kind: "keyword" as const, keyword: "graphic tshirt streetwear", w: 600, orientation: "squarish" as const },
            rating: 4.7,
            category: "Tees",
            desc: "Soft cotton, oversized print",
            action: "product:2",
          },
          {
            id: "3",
            name: "Tech Joggers",
            price: "$69.00",
            image: { kind: "keyword" as const, keyword: "techwear joggers pants", w: 600, orientation: "squarish" as const },
            rating: 4.6,
            badge: "Best Seller",
            category: "New Drops",
            desc: "Tapered fit with utility pockets",
            action: "product:3",
          },
          {
            id: "4",
            name: "High-Top Sneakers",
            price: "$119.00",
            image: { kind: "keyword" as const, keyword: "high top sneakers", w: 600, orientation: "squarish" as const },
            rating: 4.9,
            category: "Sneakers",
            desc: "Cushioned sole, premium suede",
            action: "product:4",
          },
          {
            id: "5",
            name: "Denim Jacket — Washed",
            price: "$109.00",
            image: { kind: "keyword" as const, keyword: "washed denim jacket streetwear", w: 600, orientation: "squarish" as const },
            rating: 4.5,
            category: "New Drops",
            desc: "Classic cut, modern wash",
            action: "product:5",
          },
          {
            id: "6",
            name: "Beanie — Minimal",
            price: "$24.00",
            image: { kind: "keyword" as const, keyword: "minimal black beanie", w: 600, orientation: "squarish" as const },
            rating: 4.4,
            category: "Accessories",
            desc: "Ribbed knit, one size",
            action: "product:6",
          },
          {
            id: "7",
            name: "Cargo Pants",
            price: "$89.00",
            image: { kind: "keyword" as const, keyword: "cargo pants streetwear", w: 600, orientation: "squarish" as const },
            rating: 4.6,
            category: "New Drops",
            desc: "Relaxed fit, heavy canvas",
            action: "product:7",
          },
          {
            id: "8",
            name: "Cap — Logo",
            price: "$29.00",
            image: { kind: "keyword" as const, keyword: "black cap streetwear", w: 600, orientation: "squarish" as const },
            rating: 4.5,
            category: "Accessories",
            desc: "Structured crown, embroidered logo",
            action: "product:8",
          },
        ]
      : [
          {
            id: "1",
            name: "Organic Tomatoes",
            price: "$4.99",
            image: { kind: "keyword" as const, keyword: "organic tomatoes", w: 600, orientation: "squarish" as const },
            rating: 4.5,
            action: "product:1",
          },
          {
            id: "2",
            name: "Fresh Spinach",
            price: "$3.49",
            image: { kind: "keyword" as const, keyword: "fresh spinach", w: 600, orientation: "squarish" as const },
            rating: 4.8,
            action: "product:2",
          },
          {
            id: "3",
            name: "Free Range Eggs",
            price: "$6.99",
            image: { kind: "keyword" as const, keyword: "free range eggs", w: 600, orientation: "squarish" as const },
            rating: 4.9,
            action: "product:3",
          },
          {
            id: "4",
            name: "Artisan Cheese",
            price: "$8.99",
            image: { kind: "keyword" as const, keyword: "artisan cheese", w: 600, orientation: "squarish" as const },
            rating: 4.7,
            action: "product:4",
          },
        ];

  const categories =
    variant === "streetwear"
      ? [
          { id: "hoodies", title: "Hoodies", icon: "🧥", action: "navigate:products" },
          { id: "tees", title: "Tees", icon: "👕", action: "navigate:products" },
          { id: "sneakers", title: "Sneakers", icon: "👟", action: "navigate:products" },
        ]
      : [
          { id: "veg", title: "Vegetables", icon: "🥬", action: "navigate:products" },
          { id: "fruit", title: "Fruits", icon: "🍎", action: "navigate:products" },
          { id: "dairy", title: "Dairy", icon: "🥛", action: "navigate:products" },
        ];

  const blueprint: AppBlueprint = {
    version: "1",
    appName,
    businessType: "ecommerce",
    theme,
    screens: [
      {
        id: "home",
        name: "Home",
        icon: "🏠",
        isHome: true,
        sections: [
          {
            id: "hero",
            type: "hero",
            title: appName,
            subtitle: variant === "streetwear" ? "Streetwear essentials & new drops" : "Delivered to your door",
            ctaText: variant === "streetwear" ? "Shop New Drops" : "Shop Now",
            ctaAction: "navigate:products",
            background: {
              kind: "keyword",
              keyword: variant === "streetwear" ? "streetwear lookbook banner" : "fresh groceries hero banner",
              w: 1200,
              orientation: "landscape",
            },
            overlay: variant === "streetwear" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.4)",
          },
          {
            id: "categories",
            type: "categoryGrid",
            title: "Featured Categories",
            columns: 3,
            categories,
          },
          {
            id: "popular",
            type: "productGrid",
            title: "Popular Products",
            showMoreAction: "navigate:products",
            columns: 2,
            products: products.slice(0, 4),
          },
          {
            id: "offers",
            type: "promoCarousel",
            title: "Special Offers",
            items:
              variant === "streetwear"
                ? [
                    {
                      title: "Winter Drop",
                      subtitle: "Limited quantities",
                      image: { kind: "keyword", keyword: "streetwear winter collection", w: 900, orientation: "landscape" },
                      ctaText: "Shop",
                      ctaAction: "navigate:products",
                    },
                    {
                      title: "Free Shipping",
                      subtitle: "On orders over $75",
                      image: { kind: "keyword", keyword: "streetwear package shipping", w: 900, orientation: "landscape" },
                      ctaText: "Details",
                      ctaAction: "navigate:cart",
                    },
                  ]
                : [
                    {
                      title: "20% Off Fresh Produce",
                      subtitle: "This weekend only",
                      image: { kind: "keyword", keyword: "fresh produce sale banner", w: 900, orientation: "landscape" },
                      ctaText: "Shop Now",
                      ctaAction: "navigate:products",
                    },
                    {
                      title: "Free Delivery",
                      subtitle: "On orders over $50",
                      image: { kind: "keyword", keyword: "delivery groceries", w: 900, orientation: "landscape" },
                      ctaText: "Learn More",
                      ctaAction: "navigate:cart",
                    },
                  ],
          },
        ],
      },
      {
        id: "products",
        name: "Products",
        icon: "📦",
        sections: [
          { id: "search", type: "searchBar", placeholder: "Search products…" },
          {
            id: "filters",
            type: "filterChips",
            chips: variant === "streetwear" ? ["All", "New Drops", "Hoodies", "Sneakers"] : ["All", "Vegetables", "Fruits", "Dairy"],
          },
          { id: "grid", type: "productGrid", title: "All Products", columns: 2, products },
        ],
      },
      {
        id: "cart",
        name: "Cart",
        icon: "🛍️",
        sections: [
          {
            id: "items",
            type: "cartList",
            items: [
              {
                id: products[0]?.id || "1",
                name: products[0]?.name || "Item",
                price: products[0]?.price || "$0.00",
                quantity: 1,
                image: products[0]?.image,
              },
              {
                id: products[1]?.id || "2",
                name: products[1]?.name || "Item",
                price: products[1]?.price || "$0.00",
                quantity: 2,
                image: products[1]?.image,
              },
            ],
          },
          { id: "sp1", type: "spacer", size: "md" },
          {
            id: "checkout",
            type: "promoCarousel",
            title: "Checkout",
            items: [
              {
                title: "Ready to checkout?",
                subtitle: "Secure payment & fast delivery",
                image: { kind: "keyword", keyword: variant === "streetwear" ? "streetwear checkout bag" : "grocery checkout", w: 900, orientation: "landscape" },
                ctaText: "Checkout",
                ctaAction: "navigate:checkout",
              },
            ],
          },
        ],
      },
      {
        id: "orders",
        name: "Orders",
        icon: "📬",
        sections: [
          {
            id: "ordersList",
            type: "orderList",
            items: [
              { id: "A1024", title: "Order #A1024", subtitle: "2 items", total: "$118.00", status: "Processing" },
              { id: "A1019", title: "Order #A1019", subtitle: "1 item", total: "$39.00", status: "Delivered" },
            ],
          },
        ],
      },
      {
        id: "account",
        name: "Account",
        icon: "👤",
        sections: [
          {
            id: "menu",
            type: "accountMenu",
            items: [
              { id: "profile", label: "Profile", icon: "👤", action: "navigate:account" },
              { id: "addresses", label: "Addresses", icon: "🏠", action: "navigate:account" },
              { id: "payments", label: "Payment Methods", icon: "💳", action: "navigate:account" },
              { id: "support", label: "Support", icon: "🧑‍💻", action: "navigate:account" },
              { id: "logout", label: "Logout", icon: "🚪", action: "logout" },
            ],
          },
        ],
      },
    ],
  };

  return blueprint;
}
