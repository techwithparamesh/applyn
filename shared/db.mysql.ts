import { mysqlTable, int, text, timestamp, varchar, boolean, index, customType, tinyint } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name"),
  username: varchar("username", { length: 200 }).notNull().unique(),
  googleId: varchar("google_id", { length: 255 }).unique(),
  role: varchar("role", { length: 16 }).notNull().default("user"),
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
