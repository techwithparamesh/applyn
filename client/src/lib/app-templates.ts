/**
 * Pre-built Industry App Templates
 * 
 * These templates provide complete, ready-to-use screen designs
 * for different industry types. Each template includes:
 * - Multiple screens with real layouts
 * - Pre-configured components (hero, products, cards, etc.)
 * - Professional design patterns
 * - Placeholder content that's easy to customize
 */

// Component types matching visual editor
export type ComponentType = 
  | "text" 
  | "heading" 
  | "image" 
  | "button" 
  | "container" 
  | "grid"
  | "gallery"
  | "section"
  | "divider"
  | "spacer"
  | "icon"
  | "card"
  | "list"
  | "form"
  | "input"
  | "video"
  | "map"
  | "hero"
  | "productGrid"
  | "productCard"
  | "carousel"
  | "testimonial"
  | "pricingCard"
  | "contactForm"
  | "socialLinks"
  | "featureList"
  | "stats"
  | "team"
  | "faq";

export interface TemplateComponent {
  id: string;
  type: ComponentType;
  props: Record<string, any>;
  children?: TemplateComponent[];
}

export interface TemplateScreen {
  id: string;
  name: string;
  icon: string;
  isHome?: boolean;
  components: TemplateComponent[];
}

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  icon: string;
  screens: TemplateScreen[];
  features: string[];
}

// Helper to generate unique IDs
const uid = () => `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// E-COMMERCE TEMPLATE
// ============================================
export const ecommerceTemplate: IndustryTemplate = {
  id: "ecommerce",
  name: "E-Commerce Store",
  description: "Complete online shopping experience",
  primaryColor: "#F97316",
  secondaryColor: "#FCD34D",
  icon: "🛒",
  features: ["bottomNav", "pushNotifications", "offlineScreen", "deepLinking"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "hero",
          props: {
            title: "Fresh Products",
            subtitle: "Delivered to your door",
            buttonText: "Shop Now",
            buttonAction: "navigate:products",
            backgroundImage: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
            overlayColor: "rgba(0,0,0,0.4)",
            height: 280,
          }
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Featured Categories", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 3, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Vegetables", icon: "🥬", backgroundColor: "#E8F5E9", compact: true } },
                { id: uid(), type: "card", props: { title: "Fruits", icon: "🍎", backgroundColor: "#FFEBEE", compact: true } },
                { id: uid(), type: "card", props: { title: "Dairy", icon: "🥛", backgroundColor: "#FFF8E1", compact: true } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Popular Products", padding: 16, showMore: true, showMoreAction: "navigate:products" },
          children: [
            {
              id: uid(),
              type: "productGrid",
              props: {
                columns: 2,
                products: [
                  { id: "1", name: "Organic Tomatoes", price: "$4.99", image: "https://images.unsplash.com/photo-1546470427-227c7369a9b8?w=400", rating: 4.5 },
                  { id: "2", name: "Fresh Spinach", price: "$3.49", image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400", rating: 4.8 },
                  { id: "3", name: "Free Range Eggs", price: "$6.99", image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400", rating: 4.9 },
                  { id: "4", name: "Artisan Cheese", price: "$8.99", image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400", rating: 4.7 },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Special Offers", padding: 16, backgroundColor: "#FFF3E0" },
          children: [
            {
              id: uid(),
              type: "carousel",
              props: {
                items: [
                  { title: "20% Off Fresh Produce", subtitle: "This weekend only", image: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600", buttonText: "Shop Now" },
                  { title: "Free Delivery", subtitle: "On orders over $50", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600", buttonText: "Learn More" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "products",
      name: "Products",
      icon: "📦",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16, backgroundColor: "#f5f5f5" },
          children: [
            {
              id: uid(),
              type: "input",
              props: { placeholder: "Search products...", type: "search", icon: "search" }
            }
          ]
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 4, gap: 8, scrollable: true },
              children: [
                { id: uid(), type: "button", props: { text: "All", variant: "primary", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Vegetables", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Fruits", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Dairy", variant: "outline", size: "sm" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "productGrid",
          props: {
            columns: 2,
            products: [
              { id: "1", name: "Organic Tomatoes", price: "$4.99", originalPrice: "$5.99", image: "https://images.unsplash.com/photo-1546470427-227c7369a9b8?w=400", rating: 4.5, badge: "Sale", category: "Vegetables" },
              { id: "2", name: "Fresh Spinach", price: "$3.49", image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400", rating: 4.8, category: "Vegetables" },
              { id: "3", name: "Free Range Eggs", price: "$6.99", image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400", rating: 4.9, badge: "Best Seller", category: "Dairy" },
              { id: "4", name: "Artisan Cheese", price: "$8.99", image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400", rating: 4.7, category: "Dairy" },
              { id: "5", name: "Fresh Carrots", price: "$2.99", image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400", rating: 4.6, category: "Vegetables" },
              { id: "6", name: "Organic Milk", price: "$5.49", image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400", rating: 4.8, category: "Dairy" },
              { id: "7", name: "Fresh Apples", price: "$3.99", image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400", rating: 4.7, category: "Fruits" },
              { id: "8", name: "Sweet Bananas", price: "$2.49", image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400", rating: 4.6, category: "Fruits" },
            ]
          }
        }
      ]
    },
    {
      id: "cart",
      name: "Cart",
      icon: "🛒",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Your Cart", subtitle: "3 items", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "cart",
                items: [
                  { id: "1", name: "Organic Tomatoes", price: "$4.99", quantity: 2, image: "https://images.unsplash.com/photo-1546470427-227c7369a9b8?w=200" },
                  { id: "2", name: "Fresh Spinach", price: "$3.49", quantity: 1, image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=200" },
                  { id: "3", name: "Free Range Eggs", price: "$6.99", quantity: 1, image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=200" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "divider",
          props: { color: "#e5e7eb", thickness: 1 }
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 16 },
          children: [
            { id: uid(), type: "text", props: { text: "Subtotal", fontSize: 14, color: "#666", align: "left" } },
            { id: uid(), type: "heading", props: { text: "$20.46", level: 3, color: "#000", align: "right" } },
            { id: uid(), type: "text", props: { text: "Delivery: $3.99", fontSize: 14, color: "#666" } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "button", props: { text: "Proceed to Checkout - $24.45", variant: "primary", fullWidth: true, size: "lg" } },
          ]
        }
      ]
    },
    {
      id: "orders",
      name: "Orders",
      icon: "📋",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Your Orders", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "orders",
                items: [
                  { id: "ORD001", date: "Jan 25, 2026", status: "Delivered", total: "$45.99", itemCount: 5 },
                  { id: "ORD002", date: "Jan 20, 2026", status: "In Transit", total: "$32.50", itemCount: 3 },
                  { id: "ORD003", date: "Jan 15, 2026", status: "Delivered", total: "$67.25", itemCount: 8 },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "account",
      name: "Account",
      icon: "👤",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, backgroundColor: "#F97316", align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200", width: 80, height: 80, borderRadius: 40 } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "heading", props: { text: "John Doe", level: 3, color: "#fff" } },
            { id: uid(), type: "text", props: { text: "john@example.com", fontSize: 14, color: "#fff", opacity: 0.8 } },
          ]
        },
        {
          id: uid(),
          type: "list",
          props: {
            variant: "menu",
            items: [
              { icon: "📦", label: "My Orders", action: "navigate:orders" },
              { icon: "📍", label: "Delivery Addresses", action: "navigate:addresses" },
              { icon: "💳", label: "Payment Methods", action: "navigate:payments" },
              { icon: "❤️", label: "Wishlist", action: "navigate:wishlist" },
              { icon: "🔔", label: "Notifications", action: "navigate:notifications" },
              { icon: "⚙️", label: "Settings", action: "navigate:settings" },
              { icon: "❓", label: "Help & Support", action: "navigate:support" },
              { icon: "🚪", label: "Logout", action: "logout", color: "#EF4444" },
            ]
          }
        }
      ]
    }
  ]
};

// ============================================
// SALON & SPA TEMPLATE
// ============================================
export const salonTemplate: IndustryTemplate = {
  id: "salon",
  name: "Salon & Spa",
  description: "Booking and services for beauty business",
  primaryColor: "#EC4899",
  secondaryColor: "#F472B6",
  icon: "💇",
  features: ["bottomNav", "pushNotifications", "whatsappButton"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "hero",
          props: {
            title: "Glow Beauty Salon",
            subtitle: "Where beauty meets excellence",
            buttonText: "Book Now",
            buttonAction: "navigate:booking",
            backgroundImage: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800",
            overlayColor: "rgba(236,72,153,0.7)",
            height: 300,
          }
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Our Services", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Haircut & Styling", subtitle: "From $45", icon: "✂️", backgroundColor: "#FDF2F8" } },
                { id: uid(), type: "card", props: { title: "Hair Color", subtitle: "From $85", icon: "🎨", backgroundColor: "#FDF2F8" } },
                { id: uid(), type: "card", props: { title: "Facial Treatment", subtitle: "From $65", icon: "✨", backgroundColor: "#FDF2F8" } },
                { id: uid(), type: "card", props: { title: "Nail Art", subtitle: "From $35", icon: "💅", backgroundColor: "#FDF2F8" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Meet Our Stylists", padding: 16 },
          children: [
            {
              id: uid(),
              type: "team",
              props: {
                members: [
                  { name: "Sarah Johnson", role: "Senior Stylist", image: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=300", rating: 4.9 },
                  { name: "Emma Wilson", role: "Color Specialist", image: "https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?w=300", rating: 4.8 },
                  { name: "Mia Davis", role: "Nail Artist", image: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=300", rating: 4.9 },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Client Reviews", padding: 16, backgroundColor: "#FDF2F8" },
          children: [
            {
              id: uid(),
              type: "testimonial",
              props: {
                reviews: [
                  { name: "Jessica M.", text: "Best salon experience ever! Sarah is amazing with highlights.", rating: 5, avatar: "https://i.pravatar.cc/100?img=1" },
                  { name: "Amanda K.", text: "Love my new look! Will definitely be coming back.", rating: 5, avatar: "https://i.pravatar.cc/100?img=2" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "services",
      name: "Services",
      icon: "💇",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Hair Services", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "service",
                items: [
                  { name: "Women's Haircut", duration: "45 min", price: "$55", icon: "✂️" },
                  { name: "Men's Haircut", duration: "30 min", price: "$35", icon: "✂️" },
                  { name: "Blowout & Styling", duration: "45 min", price: "$45", icon: "💨" },
                  { name: "Full Color", duration: "2 hrs", price: "$120", icon: "🎨" },
                  { name: "Highlights", duration: "2.5 hrs", price: "$150", icon: "✨" },
                  { name: "Balayage", duration: "3 hrs", price: "$200", icon: "🌟" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Spa & Facial", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "service",
                items: [
                  { name: "Classic Facial", duration: "60 min", price: "$75", icon: "🧖" },
                  { name: "Deep Cleansing", duration: "75 min", price: "$95", icon: "✨" },
                  { name: "Anti-Aging Treatment", duration: "90 min", price: "$125", icon: "🌸" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "booking",
      name: "Book Now",
      icon: "📅",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Book Appointment", padding: 16 },
          children: [
            {
              id: uid(),
              type: "form",
              props: {
                fields: [
                  { type: "select", label: "Service", placeholder: "Select a service", options: ["Haircut", "Color", "Facial", "Nails"] },
                  { type: "select", label: "Stylist", placeholder: "Select stylist", options: ["Any Available", "Sarah Johnson", "Emma Wilson", "Mia Davis"] },
                  { type: "date", label: "Date", placeholder: "Select date" },
                  { type: "select", label: "Time", placeholder: "Select time", options: ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"] },
                ],
                submitText: "Book Appointment",
                submitColor: "#EC4899"
              }
            }
          ]
        }
      ]
    },
    {
      id: "gallery",
      name: "Gallery",
      icon: "🖼️",
      components: [
        {
          id: uid(),
          type: "gallery",
          props: {
            columns: 2,
            images: [
              "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400",
              "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400",
              "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400",
              "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400",
              "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400",
              "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=400",
            ]
          }
        }
      ]
    },
    {
      id: "profile",
      name: "Profile",
      icon: "👤",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, backgroundColor: "#EC4899", align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://i.pravatar.cc/200?img=5", width: 80, height: 80, borderRadius: 40 } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "heading", props: { text: "Jessica Miller", level: 3, color: "#fff" } },
            { id: uid(), type: "text", props: { text: "Member since 2024", fontSize: 14, color: "#fff", opacity: 0.8 } },
          ]
        },
        {
          id: uid(),
          type: "list",
          props: {
            variant: "menu",
            items: [
              { icon: "📅", label: "My Appointments", action: "navigate:appointments" },
              { icon: "⭐", label: "Favorite Services", action: "navigate:favorites" },
              { icon: "🎁", label: "Rewards & Points", action: "navigate:rewards", badge: "250 pts" },
              { icon: "🔔", label: "Notifications", action: "navigate:notifications" },
              { icon: "⚙️", label: "Settings", action: "navigate:settings" },
            ]
          }
        }
      ]
    }
  ]
};

// ============================================
// RESTAURANT TEMPLATE
// ============================================
export const restaurantTemplate: IndustryTemplate = {
  id: "restaurant",
  name: "Restaurant",
  description: "Menu, ordering, and reservations",
  primaryColor: "#EF4444",
  secondaryColor: "#FBBF24",
  icon: "🍽️",
  features: ["bottomNav", "pushNotifications", "whatsappButton", "deepLinking"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "hero",
          props: {
            title: "Taste of Italy",
            subtitle: "Authentic Italian cuisine",
            buttonText: "View Menu",
            buttonAction: "navigate:menu",
            backgroundImage: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
            overlayColor: "rgba(239,68,68,0.7)",
            height: 280,
          }
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Today's Specials", padding: 16 },
          children: [
            {
              id: uid(),
              type: "carousel",
              props: {
                items: [
                  { title: "Truffle Risotto", subtitle: "$24.99", image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600", badge: "Chef's Pick" },
                  { title: "Lobster Pasta", subtitle: "$32.99", image: "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600", badge: "New" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Menu Categories", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Appetizers", subtitle: "12 items", icon: "🥗", backgroundColor: "#FEF2F2" } },
                { id: uid(), type: "card", props: { title: "Pasta", subtitle: "15 items", icon: "🍝", backgroundColor: "#FEF2F2" } },
                { id: uid(), type: "card", props: { title: "Pizza", subtitle: "10 items", icon: "🍕", backgroundColor: "#FEF2F2" } },
                { id: uid(), type: "card", props: { title: "Desserts", subtitle: "8 items", icon: "🍰", backgroundColor: "#FEF2F2" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 16 },
          children: [
            {
              id: uid(),
              type: "card",
              props: {
                title: "Reserve a Table",
                subtitle: "Book your dining experience",
                icon: "📅",
                backgroundColor: "#EF4444",
                textColor: "#fff",
                action: "navigate:reservations"
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Location & Hours", padding: 16 },
          children: [
            { id: uid(), type: "text", props: { text: "📍 123 Main Street, Downtown", fontSize: 14, color: "#666" } },
            { id: uid(), type: "text", props: { text: "🕐 Mon-Sat: 11AM - 10PM | Sun: 12PM - 9PM", fontSize: 14, color: "#666" } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "map", props: { latitude: 40.7128, longitude: -74.006, zoom: 15, height: 150 } },
          ]
        }
      ]
    },
    {
      id: "menu",
      name: "Menu",
      icon: "📋",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 12 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 4, gap: 8, scrollable: true },
              children: [
                { id: uid(), type: "button", props: { text: "All", variant: "primary", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Appetizers", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Pasta", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Pizza", variant: "outline", size: "sm" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Appetizers", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "menu-item",
                items: [
                  { name: "Bruschetta", description: "Grilled bread with tomatoes & basil", price: "$12.99", image: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=200" },
                  { name: "Calamari Fritti", description: "Crispy fried calamari with marinara", price: "$14.99", image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=200" },
                  { name: "Caprese Salad", description: "Fresh mozzarella, tomatoes, basil", price: "$13.99", image: "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=200" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Pasta", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "menu-item",
                items: [
                  { name: "Spaghetti Carbonara", description: "Pancetta, egg, parmesan, black pepper", price: "$18.99", image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=200" },
                  { name: "Fettuccine Alfredo", description: "Creamy parmesan sauce", price: "$17.99", image: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=200" },
                  { name: "Penne Arrabbiata", description: "Spicy tomato sauce with garlic", price: "$16.99", image: "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=200", badge: "Spicy 🌶️" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "cart",
      name: "Order",
      icon: "🛒",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Your Order", subtitle: "Dine-in • Table 5", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "cart",
                items: [
                  { name: "Bruschetta", price: "$12.99", quantity: 1 },
                  { name: "Spaghetti Carbonara", price: "$18.99", quantity: 2 },
                  { name: "Tiramisu", price: "$9.99", quantity: 1 },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 16 },
          children: [
            { id: uid(), type: "text", props: { text: "Add special instructions...", fontSize: 14, color: "#666" } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "divider", props: { color: "#e5e7eb" } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "text", props: { text: "Subtotal: $60.96", fontSize: 14 } },
            { id: uid(), type: "text", props: { text: "Tax: $5.18", fontSize: 14, color: "#666" } },
            { id: uid(), type: "heading", props: { text: "Total: $66.14", level: 3 } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "button", props: { text: "Place Order", variant: "primary", fullWidth: true, size: "lg" } },
          ]
        }
      ]
    },
    {
      id: "reservations",
      name: "Reserve",
      icon: "📅",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Table Reservation", padding: 16 },
          children: [
            {
              id: uid(),
              type: "form",
              props: {
                fields: [
                  { type: "date", label: "Date", placeholder: "Select date" },
                  { type: "select", label: "Time", placeholder: "Select time", options: ["6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"] },
                  { type: "select", label: "Party Size", placeholder: "Number of guests", options: ["1 Guest", "2 Guests", "3 Guests", "4 Guests", "5 Guests", "6+ Guests"] },
                  { type: "textarea", label: "Special Requests", placeholder: "Any dietary restrictions or special occasions?" },
                ],
                submitText: "Reserve Table",
                submitColor: "#EF4444"
              }
            }
          ]
        }
      ]
    },
    {
      id: "account",
      name: "Account",
      icon: "👤",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, backgroundColor: "#EF4444", align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://i.pravatar.cc/200?img=8", width: 80, height: 80, borderRadius: 40 } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "heading", props: { text: "Mike Johnson", level: 3, color: "#fff" } },
            { id: uid(), type: "text", props: { text: "Gold Member • 1,250 points", fontSize: 14, color: "#fff", opacity: 0.8 } },
          ]
        },
        {
          id: uid(),
          type: "list",
          props: {
            variant: "menu",
            items: [
              { icon: "📋", label: "Order History", action: "navigate:orders" },
              { icon: "📅", label: "My Reservations", action: "navigate:my-reservations" },
              { icon: "⭐", label: "Favorite Dishes", action: "navigate:favorites" },
              { icon: "🎁", label: "Rewards", action: "navigate:rewards" },
              { icon: "⚙️", label: "Settings", action: "navigate:settings" },
            ]
          }
        }
      ]
    }
  ]
};

// ============================================
// CHURCH TEMPLATE
// ============================================
export const churchTemplate: IndustryTemplate = {
  id: "church",
  name: "Church & Ministry",
  description: "Sermons, events, and community",
  primaryColor: "#8B5CF6",
  secondaryColor: "#A78BFA",
  icon: "⛪",
  features: ["pushNotifications", "offlineScreen"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "hero",
          props: {
            title: "Grace Community Church",
            subtitle: "Welcome home",
            buttonText: "Watch Live",
            buttonAction: "navigate:live",
            backgroundImage: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=800",
            overlayColor: "rgba(139,92,246,0.8)",
            height: 300,
          }
        },
        {
          id: uid(),
          type: "section",
          props: { title: "This Week", padding: 16 },
          children: [
            {
              id: uid(),
              type: "card",
              props: {
                title: "Sunday Service",
                subtitle: "9:00 AM & 11:00 AM",
                description: "Join us for worship and the Word",
                icon: "🙏",
                backgroundColor: "#F5F3FF"
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Latest Sermon", padding: 16 },
          children: [
            {
              id: uid(),
              type: "card",
              props: {
                title: "Finding Peace in Uncertain Times",
                subtitle: "Pastor John Smith • Jan 21, 2026",
                image: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=600",
                action: "navigate:sermon:1",
                playButton: true
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Quick Links", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Give", icon: "💝", backgroundColor: "#F5F3FF", action: "navigate:give" } },
                { id: uid(), type: "card", props: { title: "Events", icon: "📅", backgroundColor: "#F5F3FF", action: "navigate:events" } },
                { id: uid(), type: "card", props: { title: "Groups", icon: "👥", backgroundColor: "#F5F3FF", action: "navigate:groups" } },
                { id: uid(), type: "card", props: { title: "Prayer", icon: "🙏", backgroundColor: "#F5F3FF", action: "navigate:prayer" } },
              ]
            }
          ]
        }
      ]
    },
    {
      id: "sermons",
      name: "Sermons",
      icon: "🎬",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16, backgroundColor: "#f5f5f5" },
          children: [
            { id: uid(), type: "input", props: { placeholder: "Search sermons...", type: "search" } }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Recent Sermons", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "media",
                items: [
                  { title: "Finding Peace in Uncertain Times", speaker: "Pastor John Smith", date: "Jan 21, 2026", duration: "42 min", image: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=300" },
                  { title: "The Power of Prayer", speaker: "Pastor John Smith", date: "Jan 14, 2026", duration: "38 min", image: "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=300" },
                  { title: "Walking in Faith", speaker: "Guest Speaker", date: "Jan 7, 2026", duration: "45 min", image: "https://images.unsplash.com/photo-1492176273113-2d51f47b23b0?w=300" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "events",
      name: "Events",
      icon: "📅",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Upcoming Events", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "event",
                items: [
                  { title: "Sunday Service", date: "Jan 26", time: "9:00 AM", location: "Main Sanctuary", recurring: true },
                  { title: "Youth Night", date: "Jan 28", time: "7:00 PM", location: "Youth Center" },
                  { title: "Bible Study", date: "Jan 29", time: "6:30 PM", location: "Fellowship Hall", recurring: true },
                  { title: "Community Outreach", date: "Feb 1", time: "10:00 AM", location: "Downtown" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "give",
      name: "Give",
      icon: "💝",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, align: "center" },
          children: [
            { id: uid(), type: "icon", props: { icon: "💝", size: 64 } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "heading", props: { text: "Give Online", level: 2, align: "center" } },
            { id: uid(), type: "text", props: { text: "Thank you for your generosity. Your giving supports our ministry and community.", fontSize: 14, color: "#666", align: "center" } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Select Amount", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 3, gap: 12 },
              children: [
                { id: uid(), type: "button", props: { text: "$25", variant: "outline", size: "lg" } },
                { id: uid(), type: "button", props: { text: "$50", variant: "outline", size: "lg" } },
                { id: uid(), type: "button", props: { text: "$100", variant: "primary", size: "lg" } },
                { id: uid(), type: "button", props: { text: "$250", variant: "outline", size: "lg" } },
                { id: uid(), type: "button", props: { text: "$500", variant: "outline", size: "lg" } },
                { id: uid(), type: "button", props: { text: "Custom", variant: "outline", size: "lg" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 16 },
          children: [
            { id: uid(), type: "button", props: { text: "Continue to Payment", variant: "primary", fullWidth: true, size: "lg" } },
          ]
        }
      ]
    },
    {
      id: "connect",
      name: "Connect",
      icon: "👥",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Get Connected", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "menu",
                items: [
                  { icon: "👋", label: "I'm New Here", action: "navigate:new-here" },
                  { icon: "👥", label: "Join a Group", action: "navigate:groups" },
                  { icon: "🙌", label: "Serve", action: "navigate:serve" },
                  { icon: "🙏", label: "Prayer Request", action: "navigate:prayer" },
                  { icon: "📞", label: "Contact Us", action: "navigate:contact" },
                ]
              }
            }
          ]
        }
      ]
    }
  ]
};

// ============================================
// FITNESS TEMPLATE
// ============================================
export const fitnessTemplate: IndustryTemplate = {
  id: "fitness",
  name: "Fitness & Gym",
  description: "Workouts, classes, and progress tracking",
  primaryColor: "#10B981",
  secondaryColor: "#34D399",
  icon: "💪",
  features: ["bottomNav", "pushNotifications", "deepLinking"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16, backgroundColor: "#10B981" },
          children: [
            { id: uid(), type: "text", props: { text: "Good morning, Alex! 💪", fontSize: 14, color: "#fff", opacity: 0.8 } },
            { id: uid(), type: "heading", props: { text: "Ready to crush it?", level: 2, color: "#fff" } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Today's Stats", padding: 16 },
          children: [
            {
              id: uid(),
              type: "stats",
              props: {
                items: [
                  { label: "Calories", value: "1,250", icon: "🔥", target: "2,000" },
                  { label: "Workouts", value: "3", icon: "💪", target: "5" },
                  { label: "Steps", value: "8,432", icon: "👟", target: "10,000" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Today's Workout", padding: 16 },
          children: [
            {
              id: uid(),
              type: "card",
              props: {
                title: "Upper Body Strength",
                subtitle: "45 min • Intermediate",
                description: "Chest, shoulders, and arms workout",
                image: "https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=600",
                action: "navigate:workout:1",
                badge: "Recommended"
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Upcoming Classes", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "schedule",
                items: [
                  { title: "HIIT Blast", time: "6:00 AM", instructor: "Coach Mike", spots: "5 spots left", color: "#EF4444" },
                  { title: "Yoga Flow", time: "8:00 AM", instructor: "Sarah", spots: "12 spots left", color: "#8B5CF6" },
                  { title: "Spin Class", time: "5:30 PM", instructor: "Coach Dave", spots: "3 spots left", color: "#F97316" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "workouts",
      name: "Workouts",
      icon: "🏋️",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 12 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 4, gap: 8, scrollable: true },
              children: [
                { id: uid(), type: "button", props: { text: "All", variant: "primary", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Strength", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Cardio", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Yoga", variant: "outline", size: "sm" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Popular Workouts", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 1, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Full Body Burn", subtitle: "30 min • Beginner", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600", horizontal: true } },
                { id: uid(), type: "card", props: { title: "Core Crusher", subtitle: "20 min • Intermediate", image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600", horizontal: true } },
                { id: uid(), type: "card", props: { title: "Leg Day", subtitle: "45 min • Advanced", image: "https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=600", horizontal: true } },
              ]
            }
          ]
        }
      ]
    },
    {
      id: "classes",
      name: "Classes",
      icon: "📅",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Today's Schedule", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "class-schedule",
                items: [
                  { title: "Morning HIIT", time: "6:00 AM - 6:45 AM", instructor: "Coach Mike", room: "Studio A", spots: "5/20", bookable: true },
                  { title: "Power Yoga", time: "8:00 AM - 9:00 AM", instructor: "Sarah Lee", room: "Studio B", spots: "12/15", bookable: true },
                  { title: "Spin Class", time: "12:00 PM - 12:45 PM", instructor: "Coach Dave", room: "Cycling Room", spots: "0/25", bookable: false },
                  { title: "Boxing Basics", time: "5:30 PM - 6:30 PM", instructor: "Jake", room: "Boxing Ring", spots: "8/12", bookable: true },
                  { title: "Evening Flow", time: "7:00 PM - 8:00 PM", instructor: "Sarah Lee", room: "Studio B", spots: "10/15", bookable: true },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "progress",
      name: "Progress",
      icon: "📊",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "This Week", padding: 16 },
          children: [
            {
              id: uid(),
              type: "stats",
              props: {
                items: [
                  { label: "Workouts", value: "4", change: "+1", positive: true },
                  { label: "Calories", value: "5,230", change: "+12%", positive: true },
                  { label: "Time", value: "3h 25m", change: "+30m", positive: true },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Weight Progress", padding: 16 },
          children: [
            {
              id: uid(),
              type: "card",
              props: {
                title: "Current: 175 lbs",
                subtitle: "Goal: 170 lbs • 5 lbs to go",
                progress: 75,
                progressColor: "#10B981"
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Achievements", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 3, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { icon: "🔥", title: "7 Day Streak", compact: true, backgroundColor: "#FEF3C7" } },
                { id: uid(), type: "card", props: { icon: "💪", title: "50 Workouts", compact: true, backgroundColor: "#D1FAE5" } },
                { id: uid(), type: "card", props: { icon: "🏃", title: "Marathon", compact: true, backgroundColor: "#DBEAFE" } },
              ]
            }
          ]
        }
      ]
    },
    {
      id: "profile",
      name: "Profile",
      icon: "👤",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, backgroundColor: "#10B981", align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200", width: 80, height: 80, borderRadius: 40 } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "heading", props: { text: "Alex Thompson", level: 3, color: "#fff" } },
            { id: uid(), type: "text", props: { text: "Pro Member • 127 workouts", fontSize: 14, color: "#fff", opacity: 0.8 } },
          ]
        },
        {
          id: uid(),
          type: "list",
          props: {
            variant: "menu",
            items: [
              { icon: "📊", label: "My Progress", action: "navigate:progress" },
              { icon: "🏆", label: "Achievements", action: "navigate:achievements" },
              { icon: "📋", label: "Workout History", action: "navigate:history" },
              { icon: "🎯", label: "Goals", action: "navigate:goals" },
              { icon: "💳", label: "Membership", action: "navigate:membership" },
              { icon: "⚙️", label: "Settings", action: "navigate:settings" },
            ]
          }
        }
      ]
    }
  ]
};

// ============================================
// EDUCATION TEMPLATE
// ============================================
export const educationTemplate: IndustryTemplate = {
  id: "education",
  name: "Education & Courses",
  description: "Online learning platform",
  primaryColor: "#3B82F6",
  secondaryColor: "#60A5FA",
  icon: "📚",
  features: ["bottomNav", "pushNotifications", "offlineScreen"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16, backgroundColor: "#3B82F6" },
          children: [
            { id: uid(), type: "text", props: { text: "Welcome back, Student! 📖", fontSize: 14, color: "#fff", opacity: 0.8 } },
            { id: uid(), type: "heading", props: { text: "Continue Learning", level: 2, color: "#fff" } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "In Progress", padding: 16 },
          children: [
            {
              id: uid(),
              type: "card",
              props: {
                title: "Web Development Bootcamp",
                subtitle: "Lesson 24 of 50",
                progress: 48,
                progressColor: "#3B82F6",
                image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600",
                action: "navigate:course:1"
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Categories", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Programming", subtitle: "45 courses", icon: "💻", backgroundColor: "#EFF6FF" } },
                { id: uid(), type: "card", props: { title: "Design", subtitle: "32 courses", icon: "🎨", backgroundColor: "#EFF6FF" } },
                { id: uid(), type: "card", props: { title: "Business", subtitle: "28 courses", icon: "📈", backgroundColor: "#EFF6FF" } },
                { id: uid(), type: "card", props: { title: "Marketing", subtitle: "24 courses", icon: "📣", backgroundColor: "#EFF6FF" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Popular Courses", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "course",
                items: [
                  { title: "Complete Python Course", instructor: "Dr. Sarah Chen", rating: 4.9, students: "12.5k", price: "$49.99", image: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=300" },
                  { title: "UI/UX Design Mastery", instructor: "Alex Johnson", rating: 4.8, students: "8.2k", price: "$59.99", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=300" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "courses",
      name: "Courses",
      icon: "📚",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16, backgroundColor: "#f5f5f5" },
          children: [
            { id: uid(), type: "input", props: { placeholder: "Search courses...", type: "search" } }
          ]
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 12 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 4, gap: 8, scrollable: true },
              children: [
                { id: uid(), type: "button", props: { text: "All", variant: "primary", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Programming", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Design", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Business", variant: "outline", size: "sm" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "All Courses", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "course",
                items: [
                  { title: "JavaScript Fundamentals", instructor: "John Doe", rating: 4.7, students: "15k", price: "$39.99", image: "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=300" },
                  { title: "React for Beginners", instructor: "Jane Smith", rating: 4.9, students: "20k", price: "$49.99", image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=300" },
                  { title: "Digital Marketing 101", instructor: "Mike Brown", rating: 4.6, students: "8k", price: "$29.99", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "my-learning",
      name: "My Learning",
      icon: "📖",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Continue Watching", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "learning",
                items: [
                  { title: "Web Development Bootcamp", lesson: "Lesson 24: CSS Flexbox", progress: 48, image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=300" },
                  { title: "Python for Data Science", lesson: "Lesson 12: Pandas Basics", progress: 30, image: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=300" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Completed", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "learning",
                items: [
                  { title: "HTML & CSS Basics", lesson: "Completed ✓", progress: 100, image: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=300" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "profile",
      name: "Profile",
      icon: "👤",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, backgroundColor: "#3B82F6", align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://i.pravatar.cc/200?img=12", width: 80, height: 80, borderRadius: 40 } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "heading", props: { text: "Student Name", level: 3, color: "#fff" } },
            { id: uid(), type: "text", props: { text: "3 courses in progress", fontSize: 14, color: "#fff", opacity: 0.8 } },
          ]
        },
        {
          id: uid(),
          type: "stats",
          props: {
            items: [
              { label: "Courses", value: "5", icon: "📚" },
              { label: "Hours", value: "48", icon: "⏱️" },
              { label: "Certificates", value: "2", icon: "🏆" },
            ]
          }
        },
        {
          id: uid(),
          type: "list",
          props: {
            variant: "menu",
            items: [
              { icon: "📖", label: "My Learning", action: "navigate:my-learning" },
              { icon: "🏆", label: "Certificates", action: "navigate:certificates" },
              { icon: "❤️", label: "Wishlist", action: "navigate:wishlist" },
              { icon: "⚙️", label: "Settings", action: "navigate:settings" },
            ]
          }
        }
      ]
    }
  ]
};

// ============================================
// RADIO TEMPLATE
// ============================================
export const radioTemplate: IndustryTemplate = {
  id: "radio",
  name: "Online Radio",
  description: "Live streaming and podcasts",
  primaryColor: "#06B6D4",
  secondaryColor: "#22D3EE",
  icon: "📻",
  features: ["pushNotifications", "offlineScreen"],
  screens: [
    {
      id: "home",
      name: "Live",
      icon: "📻",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, backgroundColor: "linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%)", align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300", width: 200, height: 200, borderRadius: 16 } },
            { id: uid(), type: "spacer", props: { height: 20 } },
            { id: uid(), type: "heading", props: { text: "Wave FM", level: 2, color: "#fff" } },
            { id: uid(), type: "text", props: { text: "🔴 LIVE NOW", fontSize: 14, color: "#fff", badge: true } },
            { id: uid(), type: "spacer", props: { height: 8 } },
            { id: uid(), type: "text", props: { text: "Morning Show with DJ Alex", fontSize: 16, color: "#fff" } },
            { id: uid(), type: "spacer", props: { height: 24 } },
            {
              id: uid(),
              type: "grid",
              props: { columns: 3, gap: 20 },
              children: [
                { id: uid(), type: "button", props: { icon: "⏮️", variant: "ghost", circular: true } },
                { id: uid(), type: "button", props: { icon: "⏸️", variant: "primary", circular: true, size: "lg" } },
                { id: uid(), type: "button", props: { icon: "⏭️", variant: "ghost", circular: true } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Up Next", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "schedule",
                items: [
                  { title: "Midday Mix", time: "12:00 PM", host: "DJ Sarah" },
                  { title: "Afternoon Drive", time: "3:00 PM", host: "Mike T" },
                  { title: "Evening Chill", time: "7:00 PM", host: "DJ Luna" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "podcasts",
      name: "Podcasts",
      icon: "🎙️",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Featured Podcasts", padding: 16 },
          children: [
            {
              id: uid(),
              type: "carousel",
              props: {
                items: [
                  { title: "Tech Talk Weekly", subtitle: "Episode 145", image: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400" },
                  { title: "Music & Culture", subtitle: "Episode 89", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "All Podcasts", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "media",
                items: [
                  { title: "Tech Talk Weekly", subtitle: "45 episodes", image: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200" },
                  { title: "Music & Culture", subtitle: "89 episodes", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200" },
                  { title: "Local Stories", subtitle: "32 episodes", image: "https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=200" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "schedule",
      name: "Schedule",
      icon: "📅",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Today's Schedule", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "schedule-detailed",
                items: [
                  { title: "Morning Show", time: "6:00 AM - 10:00 AM", host: "DJ Alex", status: "live" },
                  { title: "Midday Mix", time: "10:00 AM - 2:00 PM", host: "DJ Sarah", status: "upcoming" },
                  { title: "Afternoon Drive", time: "2:00 PM - 6:00 PM", host: "Mike T", status: "upcoming" },
                  { title: "Evening Chill", time: "6:00 PM - 10:00 PM", host: "DJ Luna", status: "upcoming" },
                  { title: "Night Vibes", time: "10:00 PM - 2:00 AM", host: "DJ Nova", status: "upcoming" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "about",
      name: "About",
      icon: "ℹ️",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400", width: 120, height: 120, borderRadius: 60 } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "heading", props: { text: "Wave FM", level: 2 } },
            { id: uid(), type: "text", props: { text: "Your favorite online radio station broadcasting 24/7 with the best music mix.", fontSize: 14, color: "#666", align: "center" } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Connect With Us", padding: 16 },
          children: [
            {
              id: uid(),
              type: "socialLinks",
              props: {
                links: [
                  { platform: "instagram", url: "https://instagram.com" },
                  { platform: "twitter", url: "https://twitter.com" },
                  { platform: "facebook", url: "https://facebook.com" },
                  { platform: "youtube", url: "https://youtube.com" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Contact", padding: 16 },
          children: [
            {
              id: uid(),
              type: "contactForm",
              props: {
                fields: ["name", "email", "message"],
                submitText: "Send Message"
              }
            }
          ]
        }
      ]
    }
  ]
};

// ============================================
// HEALTHCARE TEMPLATE
// ============================================
export const healthcareTemplate: IndustryTemplate = {
  id: "healthcare",
  name: "Healthcare & Clinic",
  description: "Appointments and health services",
  primaryColor: "#F43F5E",
  secondaryColor: "#FB7185",
  icon: "🏥",
  features: ["bottomNav", "pushNotifications"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16, backgroundColor: "#F43F5E" },
          children: [
            { id: uid(), type: "text", props: { text: "Welcome back!", fontSize: 14, color: "#fff", opacity: 0.8 } },
            { id: uid(), type: "heading", props: { text: "How can we help you today?", level: 3, color: "#fff" } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Quick Actions", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Book Appointment", icon: "📅", backgroundColor: "#FFF1F2", action: "navigate:book" } },
                { id: uid(), type: "card", props: { title: "Find Doctor", icon: "👨‍⚕️", backgroundColor: "#FFF1F2", action: "navigate:doctors" } },
                { id: uid(), type: "card", props: { title: "Lab Results", icon: "🔬", backgroundColor: "#FFF1F2", action: "navigate:results" } },
                { id: uid(), type: "card", props: { title: "Prescriptions", icon: "💊", backgroundColor: "#FFF1F2", action: "navigate:prescriptions" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Upcoming Appointments", padding: 16 },
          children: [
            {
              id: uid(),
              type: "card",
              props: {
                title: "Dr. Sarah Johnson",
                subtitle: "General Checkup",
                description: "Tomorrow, 10:00 AM",
                icon: "👩‍⚕️",
                backgroundColor: "#F5F5F5",
                action: "navigate:appointment:1"
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Health Tips", padding: 16 },
          children: [
            {
              id: uid(),
              type: "carousel",
              props: {
                items: [
                  { title: "Stay Hydrated", subtitle: "Drink 8 glasses of water daily", image: "https://images.unsplash.com/photo-1559839914-17aae19cec71?w=400" },
                  { title: "Regular Exercise", subtitle: "30 minutes a day keeps you healthy", image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "doctors",
      name: "Doctors",
      icon: "👨‍⚕️",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16, backgroundColor: "#f5f5f5" },
          children: [
            { id: uid(), type: "input", props: { placeholder: "Search doctors...", type: "search" } }
          ]
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 12 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 4, gap: 8, scrollable: true },
              children: [
                { id: uid(), type: "button", props: { text: "All", variant: "primary", size: "sm" } },
                { id: uid(), type: "button", props: { text: "General", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Dental", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Cardio", variant: "outline", size: "sm" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Available Doctors", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "doctor",
                items: [
                  { name: "Dr. Sarah Johnson", specialty: "General Medicine", rating: 4.9, experience: "15 years", image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200", available: true },
                  { name: "Dr. Michael Chen", specialty: "Cardiology", rating: 4.8, experience: "12 years", image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200", available: true },
                  { name: "Dr. Emily Davis", specialty: "Pediatrics", rating: 4.9, experience: "10 years", image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200", available: false },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "book",
      name: "Book",
      icon: "📅",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Book Appointment", padding: 16 },
          children: [
            {
              id: uid(),
              type: "form",
              props: {
                fields: [
                  { type: "select", label: "Department", options: ["General Medicine", "Cardiology", "Pediatrics", "Dental", "Dermatology"] },
                  { type: "select", label: "Doctor", options: ["Dr. Sarah Johnson", "Dr. Michael Chen", "Dr. Emily Davis"] },
                  { type: "date", label: "Preferred Date" },
                  { type: "select", label: "Time Slot", options: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"] },
                  { type: "textarea", label: "Reason for Visit" },
                ],
                submitText: "Book Appointment",
                submitColor: "#F43F5E"
              }
            }
          ]
        }
      ]
    },
    {
      id: "records",
      name: "Records",
      icon: "📋",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Medical Records", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "records",
                items: [
                  { title: "Blood Test Results", date: "Jan 15, 2026", type: "Lab Report", icon: "🔬" },
                  { title: "X-Ray Report", date: "Jan 10, 2026", type: "Imaging", icon: "🩻" },
                  { title: "Prescription", date: "Jan 5, 2026", type: "Medication", icon: "💊" },
                  { title: "Consultation Notes", date: "Dec 28, 2025", type: "Visit Summary", icon: "📝" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "profile",
      name: "Profile",
      icon: "👤",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, backgroundColor: "#F43F5E", align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://i.pravatar.cc/200?img=3", width: 80, height: 80, borderRadius: 40 } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "heading", props: { text: "John Doe", level: 3, color: "#fff" } },
            { id: uid(), type: "text", props: { text: "Patient ID: #12345", fontSize: 14, color: "#fff", opacity: 0.8 } },
          ]
        },
        {
          id: uid(),
          type: "list",
          props: {
            variant: "menu",
            items: [
              { icon: "📅", label: "My Appointments", action: "navigate:appointments" },
              { icon: "📋", label: "Medical Records", action: "navigate:records" },
              { icon: "💊", label: "Prescriptions", action: "navigate:prescriptions" },
              { icon: "👨‍👩‍👧", label: "Family Members", action: "navigate:family" },
              { icon: "💳", label: "Insurance", action: "navigate:insurance" },
              { icon: "⚙️", label: "Settings", action: "navigate:settings" },
            ]
          }
        }
      ]
    }
  ]
};

// ============================================
// REAL ESTATE TEMPLATE
// ============================================
export const realEstateTemplate: IndustryTemplate = {
  id: "realestate",
  name: "Real Estate",
  description: "Property listings and tours",
  primaryColor: "#64748B",
  secondaryColor: "#94A3B8",
  icon: "🏠",
  features: ["bottomNav", "deepLinking", "whatsappButton"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16, backgroundColor: "#1E293B" },
          children: [
            { id: uid(), type: "heading", props: { text: "Find Your Dream Home", level: 2, color: "#fff" } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "input", props: { placeholder: "Search location, city, or ZIP...", type: "search", backgroundColor: "#fff" } },
          ]
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 12 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 4, gap: 8, scrollable: true },
              children: [
                { id: uid(), type: "button", props: { text: "Buy", variant: "primary", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Rent", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "New", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Sold", variant: "outline", size: "sm" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Featured Properties", padding: 16 },
          children: [
            {
              id: uid(),
              type: "carousel",
              props: {
                items: [
                  { title: "Modern Villa", subtitle: "$850,000 • 4 bed, 3 bath", image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600", badge: "Featured" },
                  { title: "Downtown Condo", subtitle: "$425,000 • 2 bed, 2 bath", image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600", badge: "New" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Nearby Properties", padding: 16, showMore: true },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "property",
                items: [
                  { title: "Cozy Family Home", price: "$675,000", beds: 3, baths: 2, sqft: "2,100", address: "123 Oak Street", image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400" },
                  { title: "Luxury Penthouse", price: "$1,200,000", beds: 3, baths: 3, sqft: "2,800", address: "456 High Rise Ave", image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "search",
      name: "Search",
      icon: "🔍",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16 },
          children: [
            { id: uid(), type: "input", props: { placeholder: "Location, city, or ZIP", type: "search" } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "input", props: { label: "Min Price", placeholder: "$0", type: "number" } },
                { id: uid(), type: "input", props: { label: "Max Price", placeholder: "No max", type: "number" } },
              ]
            },
            { id: uid(), type: "spacer", props: { height: 12 } },
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "button", props: { text: "Beds: Any", variant: "outline", fullWidth: true } },
                { id: uid(), type: "button", props: { text: "Baths: Any", variant: "outline", fullWidth: true } },
              ]
            },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "button", props: { text: "Search Properties", variant: "primary", fullWidth: true } },
          ]
        }
      ]
    },
    {
      id: "saved",
      name: "Saved",
      icon: "❤️",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Saved Properties", subtitle: "3 properties", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "property",
                items: [
                  { title: "Modern Villa", price: "$850,000", beds: 4, baths: 3, sqft: "3,200", address: "789 Palm Drive", image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400", saved: true },
                  { title: "Cozy Family Home", price: "$675,000", beds: 3, baths: 2, sqft: "2,100", address: "123 Oak Street", image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400", saved: true },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "contact",
      name: "Contact",
      icon: "📞",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200", width: 100, height: 100, borderRadius: 50 } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "heading", props: { text: "John Smith", level: 3 } },
            { id: uid(), type: "text", props: { text: "Senior Real Estate Agent", fontSize: 14, color: "#666" } },
            { id: uid(), type: "text", props: { text: "⭐ 4.9 • 150+ properties sold", fontSize: 14, color: "#666" } },
          ]
        },
        {
          id: uid(),
          type: "container",
          props: { padding: 16 },
          children: [
            { id: uid(), type: "button", props: { text: "📞 Call Now", variant: "primary", fullWidth: true } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "button", props: { text: "💬 WhatsApp", variant: "outline", fullWidth: true } },
            { id: uid(), type: "spacer", props: { height: 12 } },
            { id: uid(), type: "button", props: { text: "✉️ Send Email", variant: "outline", fullWidth: true } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Schedule a Viewing", padding: 16 },
          children: [
            {
              id: uid(),
              type: "form",
              props: {
                fields: [
                  { type: "text", label: "Your Name", placeholder: "Full name" },
                  { type: "email", label: "Email", placeholder: "your@email.com" },
                  { type: "tel", label: "Phone", placeholder: "+1 (555) 000-0000" },
                  { type: "date", label: "Preferred Date" },
                  { type: "textarea", label: "Message", placeholder: "I'm interested in..." },
                ],
                submitText: "Request Viewing"
              }
            }
          ]
        }
      ]
    }
  ]
};

// ============================================
// PHOTOGRAPHY TEMPLATE
// ============================================
export const photographyTemplate: IndustryTemplate = {
  id: "photography",
  name: "Photography Portfolio",
  description: "Portfolio, booking, and client galleries",
  primaryColor: "#6366F1",
  secondaryColor: "#818CF8",
  icon: "📷",
  features: ["bottomNav", "whatsappButton"],
  screens: [
    {
      id: "home",
      name: "Portfolio",
      icon: "🖼️",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "hero",
          props: {
            title: "Capture Your Moments",
            subtitle: "Professional Photography Services",
            buttonText: "View Portfolio",
            backgroundImage: "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800",
            overlayColor: "rgba(99,102,241,0.7)",
            height: 280,
          }
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Featured Work", padding: 16 },
          children: [
            {
              id: uid(),
              type: "gallery",
              props: {
                columns: 2,
                images: [
                  "https://images.unsplash.com/photo-1519741497674-611481863552?w=400",
                  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400",
                  "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=400",
                  "https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?w=400",
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Services", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Weddings", icon: "💒", backgroundColor: "#EEF2FF" } },
                { id: uid(), type: "card", props: { title: "Portraits", icon: "👤", backgroundColor: "#EEF2FF" } },
                { id: uid(), type: "card", props: { title: "Events", icon: "🎉", backgroundColor: "#EEF2FF" } },
                { id: uid(), type: "card", props: { title: "Products", icon: "📦", backgroundColor: "#EEF2FF" } },
              ]
            }
          ]
        }
      ]
    },
    {
      id: "gallery",
      name: "Gallery",
      icon: "🖼️",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 12 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 4, gap: 8, scrollable: true },
              children: [
                { id: uid(), type: "button", props: { text: "All", variant: "primary", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Weddings", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Portraits", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "Events", variant: "outline", size: "sm" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "gallery",
          props: {
            columns: 2,
            images: [
              "https://images.unsplash.com/photo-1519741497674-611481863552?w=400",
              "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400",
              "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=400",
              "https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?w=400",
              "https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=400",
              "https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=400",
            ]
          }
        }
      ]
    },
    {
      id: "packages",
      name: "Packages",
      icon: "📦",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Photography Packages", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "service",
                items: [
                  { name: "Basic Package", duration: "2 hours", price: "$299", icon: "📷", description: "50 edited photos" },
                  { name: "Standard Package", duration: "4 hours", price: "$499", icon: "⭐", description: "100 edited photos + album" },
                  { name: "Premium Package", duration: "8 hours", price: "$899", icon: "💎", description: "200 photos + album + prints" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "book",
      name: "Book Now",
      icon: "📅",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Book a Session", padding: 16 },
          children: [
            {
              id: uid(),
              type: "form",
              props: {
                fields: [
                  { type: "select", label: "Session Type", options: ["Wedding", "Portrait", "Event", "Product"] },
                  { type: "date", label: "Preferred Date" },
                  { type: "text", label: "Your Name" },
                  { type: "email", label: "Email" },
                  { type: "tel", label: "Phone" },
                  { type: "textarea", label: "Tell us about your project" },
                ],
                submitText: "Request Quote",
                submitColor: "#6366F1"
              }
            }
          ]
        }
      ]
    },
    {
      id: "about",
      name: "About",
      icon: "👤",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300", width: 120, height: 120, borderRadius: 60 } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "heading", props: { text: "John Smith", level: 2 } },
            { id: uid(), type: "text", props: { text: "Professional Photographer", fontSize: 14, color: "#666" } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "About Me", padding: 16 },
          children: [
            { id: uid(), type: "text", props: { text: "With over 10 years of experience capturing life's most precious moments, I specialize in creating timeless photographs that tell your unique story.", fontSize: 14, color: "#666" } }
          ]
        },
        {
          id: uid(),
          type: "socialLinks",
          props: {
            links: [
              { platform: "instagram", url: "https://instagram.com" },
              { platform: "facebook", url: "https://facebook.com" },
            ]
          }
        }
      ]
    }
  ]
};

// ============================================
// MUSIC & BAND TEMPLATE
// ============================================
export const musicTemplate: IndustryTemplate = {
  id: "music",
  name: "Music & Band",
  description: "Music, tours, and merchandise",
  primaryColor: "#EC4899",
  secondaryColor: "#F472B6",
  icon: "🎵",
  features: ["bottomNav", "pushNotifications", "deepLinking"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "hero",
          props: {
            title: "The Midnight Echo",
            subtitle: "New Album Out Now",
            buttonText: "Listen Now",
            backgroundImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
            overlayColor: "rgba(236,72,153,0.8)",
            height: 300,
          }
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Latest Release", padding: 16 },
          children: [
            {
              id: uid(),
              type: "card",
              props: {
                title: "Neon Dreams",
                subtitle: "Full Album • 12 Tracks",
                image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400",
                playButton: true
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Upcoming Shows", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "event",
                items: [
                  { title: "Madison Square Garden", date: "Feb 15", time: "8:00 PM", location: "New York, NY" },
                  { title: "The Forum", date: "Feb 22", time: "7:30 PM", location: "Los Angeles, CA" },
                  { title: "United Center", date: "Mar 1", time: "8:00 PM", location: "Chicago, IL" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "music",
      name: "Music",
      icon: "🎵",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Discography", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "media",
                items: [
                  { title: "Neon Dreams", subtitle: "2026 • 12 tracks", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200" },
                  { title: "Electric Hearts", subtitle: "2024 • 10 tracks", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200" },
                  { title: "Midnight Sky", subtitle: "2022 • 11 tracks", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "tour",
      name: "Tour",
      icon: "📅",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "World Tour 2026", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "event",
                items: [
                  { title: "Madison Square Garden", date: "Feb 15", time: "8:00 PM", location: "New York, NY", ticketsAvailable: true },
                  { title: "The Forum", date: "Feb 22", time: "7:30 PM", location: "Los Angeles, CA", ticketsAvailable: true },
                  { title: "United Center", date: "Mar 1", time: "8:00 PM", location: "Chicago, IL", soldOut: true },
                  { title: "Wembley Stadium", date: "Mar 15", time: "7:00 PM", location: "London, UK", ticketsAvailable: true },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "merch",
      name: "Merch",
      icon: "🛍️",
      components: [
        {
          id: uid(),
          type: "productGrid",
          props: {
            columns: 2,
            products: [
              { id: "1", name: "Tour T-Shirt", price: "$35", image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400" },
              { id: "2", name: "Hoodie", price: "$65", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400" },
              { id: "3", name: "Vinyl LP", price: "$30", image: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=400" },
              { id: "4", name: "Poster Set", price: "$20", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400" },
            ]
          }
        }
      ]
    },
    {
      id: "about",
      name: "About",
      icon: "ℹ️",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 24, align: "center" },
          children: [
            { id: uid(), type: "image", props: { src: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400", width: 150, height: 150, borderRadius: 16 } },
            { id: uid(), type: "spacer", props: { height: 16 } },
            { id: uid(), type: "heading", props: { text: "The Midnight Echo", level: 2 } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Bio", padding: 16 },
          children: [
            { id: uid(), type: "text", props: { text: "Formed in 2020, The Midnight Echo has been electrifying audiences worldwide with their unique blend of synth-pop and indie rock.", fontSize: 14, color: "#666" } }
          ]
        },
        {
          id: uid(),
          type: "socialLinks",
          props: {
            links: [
              { platform: "instagram", url: "https://instagram.com" },
              { platform: "twitter", url: "https://twitter.com" },
              { platform: "youtube", url: "https://youtube.com" },
            ]
          }
        }
      ]
    }
  ]
};

// ============================================
// BUSINESS SERVICES TEMPLATE
// ============================================
export const businessTemplate: IndustryTemplate = {
  id: "business",
  name: "Business Services",
  description: "Professional services and consulting",
  primaryColor: "#1E40AF",
  secondaryColor: "#3B82F6",
  icon: "💼",
  features: ["whatsappButton", "deepLinking"],
  screens: [
    {
      id: "home",
      name: "Home",
      icon: "🏠",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "hero",
          props: {
            title: "Expert Business Solutions",
            subtitle: "Transform your business with our expertise",
            buttonText: "Get Started",
            backgroundImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
            overlayColor: "rgba(30,64,175,0.85)",
            height: 280,
          }
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Our Services", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 2, gap: 12 },
              children: [
                { id: uid(), type: "card", props: { title: "Consulting", subtitle: "Strategic planning", icon: "📊", backgroundColor: "#EFF6FF" } },
                { id: uid(), type: "card", props: { title: "Marketing", subtitle: "Digital solutions", icon: "📣", backgroundColor: "#EFF6FF" } },
                { id: uid(), type: "card", props: { title: "Development", subtitle: "Custom software", icon: "💻", backgroundColor: "#EFF6FF" } },
                { id: uid(), type: "card", props: { title: "Support", subtitle: "24/7 assistance", icon: "🤝", backgroundColor: "#EFF6FF" } },
              ]
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Why Choose Us", padding: 16 },
          children: [
            {
              id: uid(),
              type: "stats",
              props: {
                items: [
                  { label: "Clients", value: "500+", icon: "👥" },
                  { label: "Projects", value: "1.2K", icon: "📁" },
                  { label: "Years", value: "15+", icon: "🏆" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Client Testimonials", padding: 16, backgroundColor: "#F3F4F6" },
          children: [
            {
              id: uid(),
              type: "testimonial",
              props: {
                reviews: [
                  { name: "Sarah CEO", text: "Their expertise transformed our operations. Highly recommend!", rating: 5, avatar: "https://i.pravatar.cc/100?img=1" },
                  { name: "Mike Director", text: "Professional, efficient, and results-driven team.", rating: 5, avatar: "https://i.pravatar.cc/100?img=2" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "services",
      name: "Services",
      icon: "📋",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Our Services", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "service",
                items: [
                  { name: "Business Consulting", duration: "Custom", price: "Contact", icon: "📊", description: "Strategic planning and optimization" },
                  { name: "Digital Marketing", duration: "Monthly", price: "From $1,500", icon: "📣", description: "SEO, PPC, Social Media" },
                  { name: "Web Development", duration: "Project", price: "From $5,000", icon: "💻", description: "Custom web applications" },
                  { name: "IT Support", duration: "Monthly", price: "From $500", icon: "🛠️", description: "24/7 technical assistance" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "team",
      name: "Team",
      icon: "👥",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Our Team", padding: 16 },
          children: [
            {
              id: uid(),
              type: "team",
              props: {
                members: [
                  { name: "John Smith", role: "CEO & Founder", image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300" },
                  { name: "Sarah Johnson", role: "COO", image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300" },
                  { name: "Michael Chen", role: "CTO", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "contact",
      name: "Contact",
      icon: "📞",
      components: [
        {
          id: uid(),
          type: "container",
          props: { padding: 16 },
          children: [
            { id: uid(), type: "text", props: { text: "📍 123 Business Ave, Suite 100", fontSize: 14, color: "#666" } },
            { id: uid(), type: "text", props: { text: "📞 +1 (555) 123-4567", fontSize: 14, color: "#666" } },
            { id: uid(), type: "text", props: { text: "✉️ contact@business.com", fontSize: 14, color: "#666" } },
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Get In Touch", padding: 16 },
          children: [
            {
              id: uid(),
              type: "form",
              props: {
                fields: [
                  { type: "text", label: "Name" },
                  { type: "text", label: "Company" },
                  { type: "email", label: "Email" },
                  { type: "tel", label: "Phone" },
                  { type: "textarea", label: "How can we help?" },
                ],
                submitText: "Send Message",
                submitColor: "#1E40AF"
              }
            }
          ]
        }
      ]
    }
  ]
};

// ============================================
// NEWS & BLOG TEMPLATE
// ============================================
export const newsTemplate: IndustryTemplate = {
  id: "news",
  name: "News & Blog",
  description: "Articles, categories, and notifications",
  primaryColor: "#DC2626",
  secondaryColor: "#EF4444",
  icon: "📰",
  features: ["bottomNav", "pushNotifications", "offlineScreen", "deepLinking"],
  screens: [
    {
      id: "home",
      name: "Feed",
      icon: "📰",
      isHome: true,
      components: [
        {
          id: uid(),
          type: "carousel",
          props: {
            items: [
              { title: "Breaking: Major Tech Announcement", subtitle: "Read full story", image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600", badge: "Breaking" },
              { title: "Markets Hit Record High", subtitle: "Financial update", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600" },
            ]
          }
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Top Stories", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "media",
                items: [
                  { title: "New Climate Report Released", subtitle: "Environment • 2h ago", image: "https://images.unsplash.com/photo-1569163139599-0f4517e36f31?w=200" },
                  { title: "Sports Championship Finals", subtitle: "Sports • 4h ago", image: "https://images.unsplash.com/photo-1461896836934- voices-of-the-void?w=200" },
                  { title: "Economic Outlook 2026", subtitle: "Business • 5h ago", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200" },
                ]
              }
            }
          ]
        },
        {
          id: uid(),
          type: "section",
          props: { title: "Categories", padding: 16 },
          children: [
            {
              id: uid(),
              type: "grid",
              props: { columns: 4, gap: 8, scrollable: true },
              children: [
                { id: uid(), type: "button", props: { text: "🌍 World", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "💼 Business", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "⚽ Sports", variant: "outline", size: "sm" } },
                { id: uid(), type: "button", props: { text: "🎬 Entertainment", variant: "outline", size: "sm" } },
              ]
            }
          ]
        }
      ]
    },
    {
      id: "categories",
      name: "Categories",
      icon: "📁",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Browse by Category", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "menu",
                items: [
                  { icon: "🌍", label: "World News", badge: "125" },
                  { icon: "💼", label: "Business & Finance", badge: "89" },
                  { icon: "🔬", label: "Science & Technology", badge: "67" },
                  { icon: "⚽", label: "Sports", badge: "54" },
                  { icon: "🎬", label: "Entertainment", badge: "43" },
                  { icon: "🏥", label: "Health", badge: "38" },
                  { icon: "🌱", label: "Environment", badge: "29" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "saved",
      name: "Saved",
      icon: "🔖",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Saved Articles", subtitle: "5 articles", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "media",
                items: [
                  { title: "How AI is Changing Healthcare", subtitle: "Tech • Saved yesterday", image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200" },
                  { title: "Investment Guide 2026", subtitle: "Finance • Saved 2 days ago", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200" },
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: "settings",
      name: "Settings",
      icon: "⚙️",
      components: [
        {
          id: uid(),
          type: "section",
          props: { title: "Preferences", padding: 16 },
          children: [
            {
              id: uid(),
              type: "list",
              props: {
                variant: "menu",
                items: [
                  { icon: "🔔", label: "Notifications", action: "navigate:notifications" },
                  { icon: "📱", label: "Display", action: "navigate:display" },
                  { icon: "📥", label: "Offline Reading", action: "navigate:offline" },
                  { icon: "🌙", label: "Dark Mode", action: "toggle:darkmode" },
                  { icon: "📧", label: "Newsletter", action: "navigate:newsletter" },
                  { icon: "❓", label: "Help & Support", action: "navigate:help" },
                  { icon: "📄", label: "Terms of Service", action: "navigate:terms" },
                ]
              }
            }
          ]
        }
      ]
    }
  ]
};

// ============================================
// EXPORT ALL TEMPLATES
// ============================================
export const ALL_TEMPLATES: Record<string, IndustryTemplate> = {
  ecommerce: ecommerceTemplate,
  salon: salonTemplate,
  restaurant: restaurantTemplate,
  church: churchTemplate,
  fitness: fitnessTemplate,
  education: educationTemplate,
  radio: radioTemplate,
  healthcare: healthcareTemplate,
  realestate: realEstateTemplate,
  photography: photographyTemplate,
  music: musicTemplate,
  business: businessTemplate,
  news: newsTemplate,
};

// Get template by ID
export function getTemplateById(id: string): IndustryTemplate | null {
  return ALL_TEMPLATES[id] || null;
}

// Build initial editor screens payload (personalized) from a template id.
// Returns a JSON-serializable structure compatible with the visual editor.
export function buildEditorScreensFromTemplate(templateId: string, appName: string): any[] | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  const clonedTemplate = cloneTemplate(template);

  const subtitles: Record<string, string> = {
    ecommerce: "Shop the best products online",
    salon: "Book your perfect appointment",
    restaurant: "Delicious food, delivered fresh",
    church: "Join our community of faith",
    fitness: "Transform your body and mind",
    education: "Learn something new today",
    healthcare: "Your health, our priority",
    realestate: "Find your dream home",
    photography: "Capturing moments that matter",
    music: "Feel the rhythm",
    business: "Professional services for you",
    news: "Stay informed, stay ahead",
    radio: "Tune in to great music",
  };

  const personalizeComponent = (comp: any): any => {
    const newComp = { ...comp };

    if (comp?.type === "hero" && comp?.props) {
      if (typeof comp.props.title === "string" && (comp.props.title.includes("Fresh Products") || comp.props.title.includes("Welcome"))) {
        newComp.props = { ...comp.props, title: appName };
      }
      if (comp.props.subtitle) {
        newComp.props = { ...(newComp.props || comp.props), subtitle: subtitles[templateId] || comp.props.subtitle };
      }
    }

    if (comp?.type === "heading" && comp?.props?.text) {
      if (comp.props.text === "About Us") {
        newComp.props = { ...comp.props, text: `About ${appName}` };
      }
      if (comp.props.text === "Contact Us") {
        newComp.props = { ...comp.props, text: `Contact ${appName}` };
      }
    }

    if (comp?.type === "text" && comp?.props?.text) {
      if (comp.props.text === "About Us") {
        newComp.props = { ...comp.props, text: `About ${appName}` };
      }
      if (comp.props.text === "Contact Us") {
        newComp.props = { ...comp.props, text: `Contact ${appName}` };
      }
    }

    if (comp?.children && Array.isArray(comp.children)) {
      newComp.children = comp.children.map(personalizeComponent);
    }

    return newComp;
  };

  return clonedTemplate.screens.map((screen: TemplateScreen) => ({
    id: screen.id,
    name: screen.name,
    icon: screen.icon,
    isHome: screen.isHome,
    components: (screen.components || []).map(personalizeComponent),
  }));
}

// Get all template IDs
export function getTemplateIds(): string[] {
  return Object.keys(ALL_TEMPLATES);
}

// Clone template with new IDs (for creating app instances)
export function cloneTemplate(template: IndustryTemplate): IndustryTemplate {
  const cloneComponents = (components: TemplateComponent[]): TemplateComponent[] => {
    return components.map(comp => ({
      ...comp,
      id: uid(),
      children: comp.children ? cloneComponents(comp.children) : undefined,
    }));
  };

  return {
    ...template,
    screens: template.screens.map(screen => ({
      ...screen,
      id: `screen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      components: cloneComponents(screen.components),
    })),
  };
}
