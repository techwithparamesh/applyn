export type BlueprintTheme = {
  primary_color: string;
  secondary_color?: string;
  background_color?: string;
  surface_color?: string;
  text_color?: string;
  muted_text_color?: string;
  border_color?: string;
};

export type BlueprintLogo = {
  icon: string;
  style?: string;
};

export type BlueprintHero = {
  headline: string;
  subheadline?: string;
  cta_text?: string;
  image_keyword?: string;
};

export type BlueprintCategory = {
  id: string;
  name: string;
  image_keyword?: string;
};

export type BlueprintProduct = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  image_keyword?: string;
  category_id?: string;
  rating?: number;
};

export type BlueprintCartItem = {
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
  image_keyword?: string;
};

export type BlueprintCart = {
  items: BlueprintCartItem[];
  subtotal: number;
  shipping_fee?: number;
  tax?: number;
  total: number;
};

export type BlueprintOrder = {
  id: string;
  status: string;
  date: string;
  total: number;
};

export type BlueprintAccountMenuItem = {
  id: string;
  label: string;
  icon?: string;
  action?: string;
};

export type BlueprintScreenComponent = {
  component_id: string;
  type:
    | "hero_section"
    | "featured_categories"
    | "product_grid"
    | "cart_summary"
    | "orders_list"
    | "account_menu";
  data_binding?: string;
  props?: Record<string, any>;
};

export type BlueprintScreen = {
  screen_id: string;
  title: string;
  icon: string;
  components: BlueprintScreenComponent[];
};

export type BlueprintNavigation = {
  type: "bottom_tabs";
  tabs: Array<{ tab_id: string; label: string; icon: string; screen_id: string }>;
};

export type BlueprintData = {
  categories?: BlueprintCategory[];
  products?: BlueprintProduct[];
  cart?: BlueprintCart;
  orders?: BlueprintOrder[];
};

export type BlueprintContent = {
  hero?: BlueprintHero;
  account?: {
    menu_items?: BlueprintAccountMenuItem[];
  };
};

export type BlueprintSettings = {
  currency?: string;
  language?: string;
  support?: {
    email?: string;
    phone?: string;
  };
};

export type AppBlueprint = {
  schema_version: string;
  app_name: string;
  logo: BlueprintLogo;
  theme: BlueprintTheme;
  screens: BlueprintScreen[];
  navigation: BlueprintNavigation;
  data?: BlueprintData;
  content?: BlueprintContent;
  settings?: BlueprintSettings;
};
