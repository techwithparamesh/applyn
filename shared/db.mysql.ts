import { mysqlTable, int, text, timestamp, varchar, boolean, index, customType } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name"),
  username: varchar("username", { length: 200 }).notNull().unique(),
  googleId: varchar("google_id", { length: 255 }).unique(),
  role: varchar("role", { length: 16 }).notNull().default("user"),
  password: text("password").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifyToken: varchar("email_verify_token", { length: 128 }),
  resetToken: varchar("reset_token", { length: 128 }),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  resetTokenIdx: index("users_reset_token_idx").on(table.resetToken),
}));

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
  primaryColor: varchar("primary_color", { length: 16 }).notNull().default("#2563EB"),
  platform: varchar("platform", { length: 16 }).notNull().default("android"),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  packageName: varchar("package_name", { length: 200 }),
  versionCode: int("version_code"),
  artifactPath: text("artifact_path"),
  artifactMime: varchar("artifact_mime", { length: 100 }),
  artifactSize: int("artifact_size"),
  buildLogs: text("build_logs"),
  buildError: text("build_error"),
  lastBuildAt: timestamp("last_build_at", { mode: "date" }),
  apiSecret: varchar("api_secret", { length: 64 }), // For push notification token registration auth
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  ownerIdIdx: index("apps_owner_id_idx").on(table.ownerId),
  statusIdx: index("apps_status_idx").on(table.status),
}));

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
  status: varchar("status", { length: 16 }).notNull().default("open"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  requesterIdIdx: index("support_tickets_requester_id_idx").on(table.requesterId),
  statusIdx: index("support_tickets_status_idx").on(table.status),
}));

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  appId: varchar("app_id", { length: 36 }),
  provider: varchar("provider", { length: 16 }).notNull().default("razorpay"),
  providerOrderId: varchar("provider_order_id", { length: 128 }),
  providerPaymentId: varchar("provider_payment_id", { length: 128 }),
  amountInr: int("amount_inr").notNull(),
  plan: varchar("plan", { length: 50 }).notNull().default("starter"),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("payments_user_id_idx").on(table.userId),
  appIdIdx: index("payments_app_id_idx").on(table.appId),
  statusIdx: index("payments_status_idx").on(table.status),
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

export { contactSubmissions } from "./db.contact.mysql";
