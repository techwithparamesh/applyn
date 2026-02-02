import { mysqlTable, int, text, timestamp, varchar, boolean, index, customType, tinyint, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name"),
  username: varchar("username", { length: 200 }).notNull().unique(),
  googleId: varchar("google_id", { length: 255 }).unique(),
  playRefreshTokenEnc: text("play_refresh_token_enc"),
  playConnectedAt: timestamp("play_connected_at", { mode: "date" }),
  role: varchar("role", { length: 16 }).notNull().default("user"),
  // Minimal RBAC: JSON array of permission strings (nullable; treat null as empty array)
  permissions: json("permissions"),
  password: text("password").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(false), // Force password change on first login
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifyToken: varchar("email_verify_token", { length: 128 }),
  resetToken: varchar("reset_token", { length: 128 }),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { mode: "date" }),
  // Account lockout fields
  failedLoginAttempts: int("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until", { mode: "date" }),
  // Subscription fields for yearly renewal model
  plan: varchar("plan", { length: 16 }),  // starter, standard, pro
  planStatus: varchar("plan_status", { length: 16 }),  // active, expired, cancelled
  planStartDate: timestamp("plan_start_date", { mode: "date" }),
  planExpiryDate: timestamp("plan_expiry_date", { mode: "date" }),
  remainingRebuilds: int("remaining_rebuilds").default(0),
  extraAppSlots: int("extra_app_slots").default(0),  // Purchased extra app slots
  subscriptionId: varchar("subscription_id", { length: 128 }),  // Razorpay subscription ID
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  resetTokenIdx: index("users_reset_token_idx").on(table.resetToken),
  planStatusIdx: index("users_plan_status_idx").on(table.planStatus),
  planExpiryIdx: index("users_plan_expiry_idx").on(table.planExpiryDate),
}));

const doubleNumber = customType<{ data: number | null; driverData: number | null }>(
  {
    dataType() {
      return "double";
    },
    toDriver(value) {
      return value;
    },
    fromDriver(value) {
      if (value === null || value === undefined) return null;
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    },
  }
);

export const apps = mysqlTable("apps", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  // MySQL does not allow DEFAULT values for TEXT/BLOB on many versions.
  // Keep these as VARCHAR to match the manual VPS schema.
  icon: varchar("icon", { length: 32 }).notNull().default("🚀"),
  iconUrl: customType<{ data: string; driverData: string }>({
    dataType() { return "mediumtext"; },
    toDriver(value) { return value; },
    fromDriver(value) { return value as string; },
  })("icon_url"), // Custom logo as base64 - needs MEDIUMTEXT for large images
  iconColor: varchar("icon_color", { length: 16 }).default("#2563EB"), // Icon background color
  primaryColor: varchar("primary_color", { length: 16 }).notNull().default("#2563EB"),
  platform: varchar("platform", { length: 16 }).notNull().default("android"),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  plan: varchar("plan", { length: 16 }), // Plan tier: preview, starter, standard, pro, agency
  industry: varchar("industry", { length: 50 }), // Industry template id (e.g. salon, ecommerce)
  isNativeOnly: tinyint("is_native_only").notNull().default(0), // 1 for native-only apps
  generatedPrompt: text("generated_prompt"),
  generatedScreens: text("generated_screens"), // JSON array of strings
  editorScreens: customType<{ data: string; driverData: string }>({
    dataType() { return "mediumtext"; },
    toDriver(value) { return value; },
    fromDriver(value) { return value as string; },
  })("editor_screens"), // JSON for visual editor screens

  modules: customType<{ data: string; driverData: string }>({
    dataType() { return "mediumtext"; },
    toDriver(value) { return value; },
    fromDriver(value) { return value as string; },
  })("modules"), // JSON array of app modules

  navigation: customType<{ data: string; driverData: string }>({
    dataType() { return "mediumtext"; },
    toDriver(value) { return value; },
    fromDriver(value) { return value as string; },
  })("navigation"), // JSON navigation model

  editorScreensHistory: customType<{ data: string; driverData: string }>({
    dataType() { return "mediumtext"; },
    toDriver(value) { return value; },
    fromDriver(value) { return value as string; },
  })("editor_screens_history"), // JSON array of screen snapshots
  // Native enhancement features as JSON: { bottomNav: boolean, pullToRefresh: boolean, offlineScreen: boolean, whatsappButton: boolean, whatsappNumber: string }
  features: text("features"), // JSON string for feature toggles
  packageName: varchar("package_name", { length: 200 }),
  versionCode: int("version_code"),
  artifactPath: text("artifact_path"),
  artifactMime: varchar("artifact_mime", { length: 100 }),
  artifactSize: int("artifact_size"),
  buildLogs: text("build_logs"),
  buildError: text("build_error"),
  lastBuildAt: timestamp("last_build_at", { mode: "date" }),
  apiSecret: varchar("api_secret", { length: 64 }), // For push notification token registration auth

  // Google Play publishing state
  playPublishingMode: varchar("play_publishing_mode", { length: 16 }).notNull().default("central"),
  playProductionStatus: varchar("play_production_status", { length: 16 }).notNull().default("none"),
  playProductionRequestedAt: timestamp("play_production_requested_at", { mode: "date" }),
  playProductionDecisionAt: timestamp("play_production_decision_at", { mode: "date" }),
  playProductionDecisionBy: varchar("play_production_decision_by", { length: 36 }),
  playProductionDecisionReason: text("play_production_decision_reason"),
  lastPlayTrack: varchar("last_play_track", { length: 16 }),
  lastPlayVersionCode: int("last_play_version_code"),
  lastPlayPublishedAt: timestamp("last_play_published_at", { mode: "date" }),
  lastPlayReleaseStatus: varchar("last_play_release_status", { length: 32 }),

  // Health monitoring (aggregated)
  crashRate7d: doubleNumber("crash_rate_7d"),
  lastCrashAt: timestamp("last_crash_at", { mode: "date" }),
  lastHealthSyncAt: timestamp("last_health_sync_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  ownerIdIdx: index("apps_owner_id_idx").on(table.ownerId),
  statusIdx: index("apps_status_idx").on(table.status),
  playProdStatusIdx: index("apps_play_production_status_idx").on(table.playProductionStatus),
  playProdRequestedIdx: index("apps_play_production_requested_at_idx").on(table.playProductionRequestedAt),
  lastPlayPublishedIdx: index("apps_last_play_published_at_idx").on(table.lastPlayPublishedAt),
}));

// --- App Runtime (end-user) tables ---

export const appCustomers = mysqlTable("app_customers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  password: text("password").notNull(),
  role: varchar("role", { length: 16 }).notNull().default("customer"),
  name: varchar("name", { length: 200 }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("app_customers_app_id_idx").on(table.appId),
  appEmailIdx: index("app_customers_app_email_idx").on(table.appId, table.email),
}));

export const appProducts = mysqlTable("app_products", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  sku: varchar("sku", { length: 64 }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  priceCents: int("price_cents").notNull(),
  active: tinyint("active").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("app_products_app_id_idx").on(table.appId),
  activeIdx: index("app_products_active_idx").on(table.appId, table.active),
}));

// --- App Runtime (ecommerce engine) tables ---

export const appEcommerceSettings = mysqlTable(
  "app_ecommerce_settings",
  {
    appId: varchar("app_id", { length: 36 }).primaryKey(),
    taxRateBps: int("tax_rate_bps").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_ecommerce_settings_app_idx").on(table.appId),
  }),
);

export const appProductVariants = mysqlTable(
  "app_product_variants",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    productId: varchar("product_id", { length: 36 }).notNull(),
    sku: varchar("sku", { length: 64 }),
    name: varchar("name", { length: 200 }).notNull(),
    attributes: text("attributes"), // JSON
    priceCents: int("price_cents"), // Optional override
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_product_variants_app_idx").on(table.appId),
    productIdx: index("app_product_variants_product_idx").on(table.appId, table.productId),
    skuIdx: index("app_product_variants_sku_idx").on(table.appId, table.sku),
    activeIdx: index("app_product_variants_active_idx").on(table.appId, table.active),
  }),
);

export const appInventory = mysqlTable(
  "app_inventory",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    productId: varchar("product_id", { length: 36 }).notNull(),
    variantId: varchar("variant_id", { length: 36 }),
    sku: varchar("sku", { length: 64 }),
    stock: int("stock").notNull().default(0),
    lowStockThreshold: int("low_stock_threshold").notNull().default(0),
    backorderAllowed: tinyint("backorder_allowed").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_inventory_app_idx").on(table.appId),
    productIdx: index("app_inventory_product_idx").on(table.appId, table.productId),
    variantIdx: index("app_inventory_variant_idx").on(table.appId, table.variantId),
    skuIdx: index("app_inventory_sku_idx").on(table.appId, table.sku),
  }),
);

export const appInventoryMovements = mysqlTable(
  "app_inventory_movements",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    productId: varchar("product_id", { length: 36 }).notNull(),
    variantId: varchar("variant_id", { length: 36 }),
    delta: int("delta").notNull(),
    reason: varchar("reason", { length: 64 }).notNull(),
    refType: varchar("ref_type", { length: 32 }),
    refId: varchar("ref_id", { length: 36 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_inventory_movements_app_idx").on(table.appId),
    productIdx: index("app_inventory_movements_product_idx").on(table.appId, table.productId),
    createdAtIdx: index("app_inventory_movements_created_at_idx").on(table.createdAt),
  }),
);

export const appCoupons = mysqlTable(
  "app_coupons",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    type: varchar("type", { length: 16 }).notNull().default("percent"), // percent|fixed
    percentBps: int("percent_bps"),
    amountCents: int("amount_cents"),
    active: tinyint("active").notNull().default(1),
    startsAt: timestamp("starts_at", { mode: "date" }),
    endsAt: timestamp("ends_at", { mode: "date" }),
    maxRedemptions: int("max_redemptions"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_coupons_app_idx").on(table.appId),
    codeIdx: index("app_coupons_code_idx").on(table.appId, table.code),
    activeIdx: index("app_coupons_active_idx").on(table.appId, table.active),
  }),
);

export const appShippingMethods = mysqlTable(
  "app_shipping_methods",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    deliveryFeeCents: int("delivery_fee_cents").notNull().default(0),
    active: tinyint("active").notNull().default(1),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_shipping_methods_app_idx").on(table.appId),
    activeIdx: index("app_shipping_methods_active_idx").on(table.appId, table.active),
  }),
);

export const appOrders = mysqlTable("app_orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  customerId: varchar("customer_id", { length: 36 }),
  status: varchar("status", { length: 24 }).notNull().default("created"),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  subtotalCents: int("subtotal_cents").notNull().default(0),
  discountCents: int("discount_cents").notNull().default(0),
  shippingCents: int("shipping_cents").notNull().default(0),
  taxCents: int("tax_cents").notNull().default(0),
  totalCents: int("total_cents").notNull().default(0),
  paymentProvider: varchar("payment_provider", { length: 16 }),
  paymentStatus: varchar("payment_status", { length: 16 }).notNull().default("pending"),
  paymentRef: varchar("payment_ref", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("app_orders_app_id_idx").on(table.appId),
  customerIdx: index("app_orders_customer_idx").on(table.appId, table.customerId),
  statusIdx: index("app_orders_status_idx").on(table.appId, table.status),
}));

export const appOrderItems = mysqlTable("app_order_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 }).notNull(),
  productId: varchar("product_id", { length: 36 }),
  variantId: varchar("variant_id", { length: 36 }),
  name: varchar("name", { length: 200 }).notNull(),
  sku: varchar("sku", { length: 64 }),
  quantity: int("quantity").notNull().default(1),
  unitPriceCents: int("unit_price_cents").notNull(),
  lineTotalCents: int("line_total_cents").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  orderIdx: index("app_order_items_order_idx").on(table.orderId),
}));

export const appOrderAddresses = mysqlTable(
  "app_order_addresses",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull().default("shipping"),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    line1: varchar("line1", { length: 255 }).notNull(),
    line2: varchar("line2", { length: 255 }),
    city: varchar("city", { length: 120 }).notNull(),
    state: varchar("state", { length: 120 }),
    postalCode: varchar("postal_code", { length: 32 }),
    country: varchar("country", { length: 2 }).notNull().default("IN"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: index("app_order_addresses_order_idx").on(table.orderId),
  }),
);

export const appOrderRefunds = mysqlTable(
  "app_order_refunds",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    amountCents: int("amount_cents").notNull(),
    reason: text("reason"),
    status: varchar("status", { length: 24 }).notNull().default("processed"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date" }),
  },
  (table) => ({
    appIdx: index("app_order_refunds_app_idx").on(table.appId),
    orderIdx: index("app_order_refunds_order_idx").on(table.orderId),
    createdAtIdx: index("app_order_refunds_created_at_idx").on(table.createdAt),
  }),
);

export const appEvents = mysqlTable("app_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  customerId: varchar("customer_id", { length: 36 }),
  name: varchar("name", { length: 64 }).notNull(),
  properties: text("properties"), // JSON
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdx: index("app_events_app_idx").on(table.appId),
  nameIdx: index("app_events_name_idx").on(table.appId, table.name),
  createdAtIdx: index("app_events_created_at_idx").on(table.createdAt),
}));

export const appWebhooks = mysqlTable("app_webhooks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 128 }),
  events: text("events"), // JSON array of event names
  enabled: tinyint("enabled").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("app_webhooks_app_id_idx").on(table.appId),
  enabledIdx: index("app_webhooks_enabled_idx").on(table.appId, table.enabled),
}));

// --- App Runtime (booking) tables ---

export const appServices = mysqlTable("app_services", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  priceCents: int("price_cents").notNull().default(0),
  durationMinutes: int("duration_minutes").notNull().default(30),
  active: tinyint("active").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("app_services_app_id_idx").on(table.appId),
  activeIdx: index("app_services_active_idx").on(table.appId, table.active),
}));

export const appAppointments = mysqlTable("app_appointments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  customerId: varchar("customer_id", { length: 36 }).notNull(),
  serviceId: varchar("service_id", { length: 36 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("requested"),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  priceCents: int("price_cents").notNull().default(0),
  startAt: timestamp("start_at", { mode: "date" }).notNull(),
  endAt: timestamp("end_at", { mode: "date" }).notNull(),
  notes: text("notes"),
  paymentProvider: varchar("payment_provider", { length: 16 }),
  paymentStatus: varchar("payment_status", { length: 16 }).notNull().default("pending"),
  paymentRef: varchar("payment_ref", { length: 128 }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("app_appointments_app_id_idx").on(table.appId),
  customerIdx: index("app_appointments_customer_idx").on(table.appId, table.customerId),
  statusIdx: index("app_appointments_status_idx").on(table.appId, table.status),
  startAtIdx: index("app_appointments_start_at_idx").on(table.appId, table.startAt),
}));

// --- App Runtime (content / posts) tables ---

export const appPosts = mysqlTable(
  "app_posts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    type: varchar("type", { length: 24 }).notNull().default("post"), // post|news|sermon|event|offer|podcast
    title: varchar("title", { length: 255 }).notNull(),
    excerpt: text("excerpt"),
    content: text("content"),
    imageUrl: text("image_url"),
    category: varchar("category", { length: 80 }),
    active: tinyint("active").notNull().default(1),
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdIdx: index("app_posts_app_id_idx").on(table.appId),
    typeIdx: index("app_posts_type_idx").on(table.appId, table.type),
    activeIdx: index("app_posts_active_idx").on(table.appId, table.active),
    publishedAtIdx: index("app_posts_published_at_idx").on(table.appId, table.publishedAt),
  }),
);

export const appPostBookmarks = mysqlTable(
  "app_post_bookmarks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }).notNull(),
    postId: varchar("post_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appCustomerIdx: index("app_post_bookmarks_app_customer_idx").on(table.appId, table.customerId),
    appPostIdx: index("app_post_bookmarks_app_post_idx").on(table.appId, table.postId),
  }),
);

// --- App Runtime (restaurant) tables ---

export const appRestaurantReservations = mysqlTable(
  "app_restaurant_reservations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }).notNull(),
    tableId: varchar("table_id", { length: 36 }),
    partySize: int("party_size").notNull().default(2),
    reservedAt: timestamp("reserved_at", { mode: "date" }).notNull(),
    durationMinutes: int("duration_minutes").notNull().default(90),
    notes: text("notes"),
    status: varchar("status", { length: 24 }).notNull().default("requested"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_restaurant_reservations_app_idx").on(table.appId),
    customerIdx: index("app_restaurant_reservations_customer_idx").on(table.appId, table.customerId),
    reservedAtIdx: index("app_restaurant_reservations_reserved_at_idx").on(table.appId, table.reservedAt),
  }),
);

export const appRestaurantTables = mysqlTable(
  "app_restaurant_tables",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    capacity: int("capacity").notNull().default(2),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_restaurant_tables_app_idx").on(table.appId),
    activeIdx: index("app_restaurant_tables_active_idx").on(table.appId, table.active),
  }),
);

export const appRestaurantMenuCategories = mysqlTable(
  "app_restaurant_menu_categories",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_restaurant_menu_categories_app_idx").on(table.appId),
    activeIdx: index("app_restaurant_menu_categories_active_idx").on(table.appId, table.active),
  }),
);

export const appRestaurantMenuItems = mysqlTable(
  "app_restaurant_menu_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    categoryId: varchar("category_id", { length: 36 }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    priceCents: int("price_cents").notNull().default(0),
    prepTimeMinutes: int("prep_time_minutes").notNull().default(15),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_restaurant_menu_items_app_idx").on(table.appId),
    categoryIdx: index("app_restaurant_menu_items_category_idx").on(table.appId, table.categoryId),
    activeIdx: index("app_restaurant_menu_items_active_idx").on(table.appId, table.active),
  }),
);

export const appRestaurantMenuModifiers = mysqlTable(
  "app_restaurant_menu_modifiers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    itemId: varchar("item_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    minSelect: int("min_select").notNull().default(0),
    maxSelect: int("max_select").notNull().default(1),
    required: tinyint("required").notNull().default(0),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_restaurant_menu_modifiers_app_idx").on(table.appId),
    itemIdx: index("app_restaurant_menu_modifiers_item_idx").on(table.appId, table.itemId),
    activeIdx: index("app_restaurant_menu_modifiers_active_idx").on(table.appId, table.active),
  }),
);

export const appRestaurantMenuModifierOptions = mysqlTable(
  "app_restaurant_menu_modifier_options",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    modifierId: varchar("modifier_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    priceDeltaCents: int("price_delta_cents").notNull().default(0),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_restaurant_menu_modifier_options_app_idx").on(table.appId),
    modifierIdx: index("app_restaurant_menu_modifier_options_modifier_idx").on(table.appId, table.modifierId),
    activeIdx: index("app_restaurant_menu_modifier_options_active_idx").on(table.appId, table.active),
  }),
);

export const appRestaurantAvailabilityWindows = mysqlTable(
  "app_restaurant_availability_windows",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull().default("reservation"), // reservation|menu
    dayOfWeek: int("day_of_week").notNull().default(0), // 0=Sunday
    startTime: varchar("start_time", { length: 5 }).notNull(), // HH:MM
    endTime: varchar("end_time", { length: 5 }).notNull(), // HH:MM
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_restaurant_availability_windows_app_idx").on(table.appId),
    kindIdx: index("app_restaurant_availability_windows_kind_idx").on(table.appId, table.kind),
    activeIdx: index("app_restaurant_availability_windows_active_idx").on(table.appId, table.active),
  }),
);

export const appRestaurantOrders = mysqlTable(
  "app_restaurant_orders",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }),
    fulfillmentType: varchar("fulfillment_type", { length: 16 }).notNull().default("dine_in"), // dine_in|pickup|delivery
    status: varchar("status", { length: 24 }).notNull().default("created"),
    kitchenStatus: varchar("kitchen_status", { length: 24 }).notNull().default("queued"),
    scheduledAt: timestamp("scheduled_at", { mode: "date" }),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    totalCents: int("total_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_restaurant_orders_app_idx").on(table.appId),
    customerIdx: index("app_restaurant_orders_customer_idx").on(table.appId, table.customerId),
    kitchenIdx: index("app_restaurant_orders_kitchen_status_idx").on(table.appId, table.kitchenStatus),
    createdAtIdx: index("app_restaurant_orders_created_at_idx").on(table.createdAt),
  }),
);

export const appRestaurantOrderItems = mysqlTable(
  "app_restaurant_order_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    itemId: varchar("item_id", { length: 36 }),
    name: varchar("name", { length: 200 }).notNull(),
    quantity: int("quantity").notNull().default(1),
    unitPriceCents: int("unit_price_cents").notNull(),
    lineTotalCents: int("line_total_cents").notNull(),
    modifiers: text("modifiers"), // JSON
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: index("app_restaurant_order_items_order_idx").on(table.orderId),
  }),
);

// --- App Runtime (fitness) tables ---

export const appFitnessClasses = mysqlTable(
  "app_fitness_classes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date" }).notNull(),
    capacity: int("capacity").notNull().default(20),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_fitness_classes_app_idx").on(table.appId),
    activeIdx: index("app_fitness_classes_active_idx").on(table.appId, table.active),
    startsAtIdx: index("app_fitness_classes_starts_at_idx").on(table.appId, table.startsAt),
  }),
);

export const appFitnessBookings = mysqlTable(
  "app_fitness_bookings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }).notNull(),
    classId: varchar("class_id", { length: 36 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("booked"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appCustomerIdx: index("app_fitness_bookings_app_customer_idx").on(table.appId, table.customerId),
    appClassIdx: index("app_fitness_bookings_app_class_idx").on(table.appId, table.classId),
  }),
);

// --- App Runtime (education) tables ---

export const appCourses = mysqlTable(
  "app_courses",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_courses_app_idx").on(table.appId),
    activeIdx: index("app_courses_active_idx").on(table.appId, table.active),
  }),
);

export const appCourseLessons = mysqlTable(
  "app_course_lessons",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    courseId: varchar("course_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    contentUrl: text("content_url"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    courseIdx: index("app_course_lessons_course_idx").on(table.appId, table.courseId),
  }),
);

export const appCourseEnrollments = mysqlTable(
  "app_course_enrollments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }).notNull(),
    courseId: varchar("course_id", { length: 36 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("enrolled"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appCustomerIdx: index("app_course_enrollments_app_customer_idx").on(table.appId, table.customerId),
    appCourseIdx: index("app_course_enrollments_app_course_idx").on(table.appId, table.courseId),
  }),
);

// --- App Runtime (real estate) tables ---

export const appRealEstateListings = mysqlTable(
  "app_real_estate_listings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    address: text("address"),
    propertyType: varchar("property_type", { length: 32 }),
    latitude: doubleNumber("latitude"),
    longitude: doubleNumber("longitude"),
    amenities: text("amenities"), // JSON
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    priceCents: int("price_cents").notNull().default(0),
    availabilityStatus: varchar("availability_status", { length: 24 }).notNull().default("available"),
    bedrooms: int("bedrooms"),
    bathrooms: int("bathrooms"),
    areaSqft: int("area_sqft"),
    imageUrl: text("image_url"),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_real_estate_listings_app_idx").on(table.appId),
    activeIdx: index("app_real_estate_listings_active_idx").on(table.appId, table.active),
  }),
);

export const appRealEstateListingMedia = mysqlTable(
  "app_real_estate_listing_media",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull().default("image"), // image|video
    url: text("url").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    listingIdx: index("app_real_estate_listing_media_listing_idx").on(table.appId, table.listingId),
  }),
);

export const appRealEstatePriceHistory = mysqlTable(
  "app_real_estate_price_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    priceCents: int("price_cents").notNull(),
    recordedAt: timestamp("recorded_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    listingIdx: index("app_real_estate_price_history_listing_idx").on(table.appId, table.listingId),
    recordedIdx: index("app_real_estate_price_history_recorded_idx").on(table.recordedAt),
  }),
);

export const appRealEstateInquiries = mysqlTable(
  "app_real_estate_inquiries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }),
    name: varchar("name", { length: 200 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 40 }),
    message: text("message"),
    status: varchar("status", { length: 24 }).notNull().default("new"),
    assignedAgentId: varchar("assigned_agent_id", { length: 36 }),
    slaDueAt: timestamp("sla_due_at", { mode: "date" }),
    lastFollowUpAt: timestamp("last_follow_up_at", { mode: "date" }),
    nextFollowUpAt: timestamp("next_follow_up_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appListingIdx: index("app_real_estate_inquiries_app_listing_idx").on(table.appId, table.listingId),
    appCustomerIdx: index("app_real_estate_inquiries_app_customer_idx").on(table.appId, table.customerId),
    statusIdx: index("app_real_estate_inquiries_status_idx").on(table.appId, table.status),
  }),
);

export const appRealEstateInquiryFollowups = mysqlTable(
  "app_real_estate_inquiry_followups",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    inquiryId: varchar("inquiry_id", { length: 36 }).notNull(),
    note: text("note"),
    dueAt: timestamp("due_at", { mode: "date" }),
    doneAt: timestamp("done_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    inquiryIdx: index("app_real_estate_inquiry_followups_inquiry_idx").on(table.appId, table.inquiryId),
    dueIdx: index("app_real_estate_inquiry_followups_due_idx").on(table.dueAt),
  }),
);

export const appRealEstateAgentAvailability = mysqlTable(
  "app_real_estate_agent_availability",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    agentId: varchar("agent_id", { length: 36 }).notNull(),
    startAt: timestamp("start_at", { mode: "date" }).notNull(),
    endAt: timestamp("end_at", { mode: "date" }).notNull(),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    agentIdx: index("app_real_estate_agent_availability_agent_idx").on(table.appId, table.agentId),
    startIdx: index("app_real_estate_agent_availability_start_idx").on(table.startAt),
  }),
);

export const appRealEstateTours = mysqlTable(
  "app_real_estate_tours",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    inquiryId: varchar("inquiry_id", { length: 36 }),
    agentId: varchar("agent_id", { length: 36 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("scheduled"),
    startAt: timestamp("start_at", { mode: "date" }).notNull(),
    endAt: timestamp("end_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    listingIdx: index("app_real_estate_tours_listing_idx").on(table.appId, table.listingId),
    agentIdx: index("app_real_estate_tours_agent_idx").on(table.appId, table.agentId),
    startIdx: index("app_real_estate_tours_start_idx").on(table.startAt),
  }),
);

export const appSavedItems = mysqlTable(
  "app_saved_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull().default("item"),
    itemId: varchar("item_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appCustomerIdx: index("app_saved_items_app_customer_idx").on(table.appId, table.customerId),
    appItemIdx: index("app_saved_items_app_item_idx").on(table.appId, table.kind, table.itemId),
  }),
);

// --- App Runtime (healthcare) tables ---

export const appDoctors = mysqlTable(
  "app_doctors",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    specialty: varchar("specialty", { length: 120 }),
    bio: text("bio"),
    imageUrl: text("image_url"),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_doctors_app_idx").on(table.appId),
    activeIdx: index("app_doctors_active_idx").on(table.appId, table.active),
  }),
);

export const appDoctorAppointments = mysqlTable(
  "app_doctor_appointments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }).notNull(),
    doctorId: varchar("doctor_id", { length: 36 }).notNull(),
    appointmentTypeId: varchar("appointment_type_id", { length: 36 }),
    status: varchar("status", { length: 24 }).notNull().default("requested"),
    startAt: timestamp("start_at", { mode: "date" }).notNull(),
    endAt: timestamp("end_at", { mode: "date" }).notNull(),
    notes: text("notes"),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_doctor_appointments_app_idx").on(table.appId),
    customerIdx: index("app_doctor_appointments_customer_idx").on(table.appId, table.customerId),
    startAtIdx: index("app_doctor_appointments_start_at_idx").on(table.appId, table.startAt),
  }),
);

export const appHealthcareAppointmentTypes = mysqlTable(
  "app_healthcare_appointment_types",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    durationMinutes: int("duration_minutes").notNull().default(15),
    bufferBeforeMinutes: int("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: int("buffer_after_minutes").notNull().default(0),
    cancellationPolicyHours: int("cancellation_policy_hours").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    priceCents: int("price_cents").notNull().default(0),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_healthcare_appointment_types_app_idx").on(table.appId),
    activeIdx: index("app_healthcare_appointment_types_active_idx").on(table.appId, table.active),
  }),
);

export const appHealthcareProviderAvailability = mysqlTable(
  "app_healthcare_provider_availability",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    doctorId: varchar("doctor_id", { length: 36 }).notNull(),
    startAt: timestamp("start_at", { mode: "date" }).notNull(),
    endAt: timestamp("end_at", { mode: "date" }).notNull(),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    doctorIdx: index("app_healthcare_provider_availability_doctor_idx").on(table.appId, table.doctorId),
    startIdx: index("app_healthcare_provider_availability_start_idx").on(table.startAt),
    activeIdx: index("app_healthcare_provider_availability_active_idx").on(table.appId, table.active),
  }),
);

export const appPatients = mysqlTable(
  "app_patients",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    customerId: varchar("customer_id", { length: 36 }),
    name: varchar("name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 40 }),
    dob: timestamp("dob", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_patients_app_idx").on(table.appId),
    customerIdx: index("app_patients_customer_idx").on(table.appId, table.customerId),
    emailIdx: index("app_patients_email_idx").on(table.appId, table.email),
  }),
);

export const appPatientVisits = mysqlTable(
  "app_patient_visits",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    patientId: varchar("patient_id", { length: 36 }).notNull(),
    appointmentId: varchar("appointment_id", { length: 36 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    patientIdx: index("app_patient_visits_patient_idx").on(table.appId, table.patientId),
    createdAtIdx: index("app_patient_visits_created_at_idx").on(table.createdAt),
  }),
);

export const appInvoices = mysqlTable(
  "app_invoices",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    patientId: varchar("patient_id", { length: 36 }).notNull(),
    appointmentId: varchar("appointment_id", { length: 36 }),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    totalCents: int("total_cents").notNull().default(0),
    status: varchar("status", { length: 24 }).notNull().default("issued"),
    dueAt: timestamp("due_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    patientIdx: index("app_invoices_patient_idx").on(table.appId, table.patientId),
    statusIdx: index("app_invoices_status_idx").on(table.appId, table.status),
    createdAtIdx: index("app_invoices_created_at_idx").on(table.createdAt),
  }),
);

export const appInvoicePayments = mysqlTable(
  "app_invoice_payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    invoiceId: varchar("invoice_id", { length: 36 }).notNull(),
    provider: varchar("provider", { length: 24 }).notNull().default("manual"),
    providerRef: varchar("provider_ref", { length: 128 }),
    amountCents: int("amount_cents").notNull().default(0),
    status: varchar("status", { length: 24 }).notNull().default("paid"),
    paidAt: timestamp("paid_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceIdx: index("app_invoice_payments_invoice_idx").on(table.appId, table.invoiceId),
    paidAtIdx: index("app_invoice_payments_paid_at_idx").on(table.paidAt),
  }),
);

// --- App Runtime (radio) tables ---

export const appRadioStations = mysqlTable(
  "app_radio_stations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    streamUrl: text("stream_url").notNull(),
    imageUrl: text("image_url"),
    active: tinyint("active").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_radio_stations_app_idx").on(table.appId),
    activeIdx: index("app_radio_stations_active_idx").on(table.appId, table.active),
  }),
);

export const appPodcastEpisodes = mysqlTable(
  "app_podcast_episodes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    showTitle: varchar("show_title", { length: 200 }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    audioUrl: text("audio_url"),
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_podcast_episodes_app_idx").on(table.appId),
    publishedAtIdx: index("app_podcast_episodes_published_at_idx").on(table.appId, table.publishedAt),
  }),
);

// --- App Runtime (music) tables ---

export const appMusicAlbums = mysqlTable(
  "app_music_albums",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    artist: varchar("artist", { length: 200 }),
    imageUrl: text("image_url"),
    releasedAt: timestamp("released_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_music_albums_app_idx").on(table.appId),
  }),
);

export const appMusicTracks = mysqlTable(
  "app_music_tracks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    albumId: varchar("album_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    trackNumber: int("track_number").notNull().default(1),
    durationSeconds: int("duration_seconds").notNull().default(0),
    audioUrl: text("audio_url"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    albumIdx: index("app_music_tracks_album_idx").on(table.appId, table.albumId),
  }),
);

// --- App Runtime (business leads) tables ---

export const appLeads = mysqlTable(
  "app_leads",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    appId: varchar("app_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 200 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 40 }),
    message: text("message"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_leads_app_idx").on(table.appId),
  }),
);

export const buildJobs = mysqlTable("build_jobs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("queued"),
  attempts: int("attempts").notNull().default(0),
  lockToken: varchar("lock_token", { length: 64 }),
  lockedAt: timestamp("locked_at", { mode: "date" }),
  error: text("error"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("build_jobs_app_id_idx").on(table.appId),
  statusIdx: index("build_jobs_status_idx").on(table.status),
  ownerIdIdx: index("build_jobs_owner_id_idx").on(table.ownerId),
}));

export const supportTickets = mysqlTable("support_tickets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  requesterId: varchar("requester_id", { length: 36 }).notNull(),
  appId: varchar("app_id", { length: 36 }),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  priority: varchar("priority", { length: 10 }).notNull().default("medium"),
  assignedTo: varchar("assigned_to", { length: 36 }), // Staff member ID
  resolutionNotes: text("resolution_notes"), // Internal staff notes
  resolvedAt: timestamp("resolved_at", { mode: "date" }),
  closedAt: timestamp("closed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  requesterIdIdx: index("support_tickets_requester_id_idx").on(table.requesterId),
  statusIdx: index("support_tickets_status_idx").on(table.status),
  assignedToIdx: index("support_tickets_assigned_to_idx").on(table.assignedTo),
  priorityIdx: index("support_tickets_priority_idx").on(table.priority),
}));

// Ticket messages for conversation thread
export const ticketMessages = mysqlTable("ticket_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ticketId: varchar("ticket_id", { length: 36 }).notNull(),
  senderId: varchar("sender_id", { length: 36 }).notNull(),
  senderRole: varchar("sender_role", { length: 16 }).notNull().default("user"), // user, staff, system
  message: text("message").notNull(),
  isInternal: tinyint("is_internal").notNull().default(0), // Internal staff notes not visible to user
  attachments: text("attachments"), // JSON array of attachment URLs
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  ticketIdIdx: index("ticket_messages_ticket_id_idx").on(table.ticketId),
  senderIdIdx: index("ticket_messages_sender_id_idx").on(table.senderId),
  createdAtIdx: index("ticket_messages_created_at_idx").on(table.createdAt),
}));

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  appId: varchar("app_id", { length: 36 }),
  provider: varchar("provider", { length: 16 }).notNull().default("razorpay"),
  providerOrderId: varchar("provider_order_id", { length: 128 }).unique(),
  providerPaymentId: varchar("provider_payment_id", { length: 128 }),
  // Authoritative storage: integer paise.
  // Nullable for safe rollout; migrate existing rows with: amount_paise = amount_inr * 100.
  amountPaise: int("amount_paise"),
  amountInr: int("amount_inr").notNull(),
  plan: varchar("plan", { length: 50 }).notNull().default("starter"),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("payments_user_id_idx").on(table.userId),
  appIdIdx: index("payments_app_id_idx").on(table.appId),
  statusIdx: index("payments_status_idx").on(table.status),
  providerOrderIdIdx: index("payments_provider_order_id_idx").on(table.providerOrderId),
}));

// Push notification device tokens
export const pushTokens = mysqlTable("push_tokens", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  token: varchar("token", { length: 512 }).notNull(),
  platform: varchar("platform", { length: 16 }).notNull().default("android"), // android, ios, web
  deviceInfo: text("device_info"), // JSON with device details
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("push_tokens_app_id_idx").on(table.appId),
  tokenIdx: index("push_tokens_token_idx").on(table.token),
}));

// Push notifications queue/history
export const pushNotifications = mysqlTable("push_notifications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  appId: varchar("app_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  actionUrl: text("action_url"),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending, sent, failed
  sentCount: int("sent_count").notNull().default(0),
  failedCount: int("failed_count").notNull().default(0),
  scheduledAt: timestamp("scheduled_at", { mode: "date" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  appIdIdx: index("push_notifications_app_id_idx").on(table.appId),
  statusIdx: index("push_notifications_status_idx").on(table.status),
}));

// Audit log for tracking sensitive actions
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }), // Actor who performed action (null for system)
  action: varchar("action", { length: 64 }).notNull(), // e.g., "user.login", "payment.completed", "app.deleted"
  targetType: varchar("target_type", { length: 32 }), // e.g., "user", "app", "payment"
  targetId: varchar("target_id", { length: 36 }), // ID of affected resource
  metadata: text("metadata"), // JSON with additional details
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 max length
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  targetIdx: index("audit_logs_target_idx").on(table.targetType, table.targetId),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));

export { contactSubmissions } from "./db.contact.mysql";
