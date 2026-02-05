import { z } from "zod";
import { editorScreensSchema } from "./editor-screens";

export const insertUserSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  username: z
    .string()
    .min(3)
    .max(200)
    .transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8).max(200),
});

// NOTE: Historically this codebase used role="support" for staff users.
// Keep it for backward compatibility while also supporting role="staff".
export const userRoleSchema = z.enum(["admin", "staff", "support", "user"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// Subscription status for yearly renewal model
export const planStatusSchema = z.enum(["active", "expired", "cancelled"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const planIdSchema = z.enum(["preview", "starter", "standard", "pro", "agency"]);
export type PlanId = z.infer<typeof planIdSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = {
  id: string;
  name: string | null;
  username: string;
  role: UserRole;
  // Minimal RBAC: staff permissions (nullable; treat null as empty array)
  permissions?: string[] | null;
  googleId?: string | null;
  // Phase 2: Google Play user-connected publishing (encrypted refresh token)
  playRefreshTokenEnc?: string | null;
  playConnectedAt?: Date | null;
  password: string;
  mustChangePassword?: boolean | null; // Force password change on first login (for team members)
  // Subscription fields for yearly renewal model
  plan?: PlanId | null;
  planStatus?: PlanStatus | null;
  planStartDate?: Date | null;
  planExpiryDate?: Date | null;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  remainingRebuilds?: number | null;
  subscriptionId?: string | null;  // Razorpay subscription ID
  // App limit tracking
  maxAppsAllowed?: number | null;    // From plan + purchased slots
  currentAppsCount?: number | null;  // Current apps owned
  extraAppSlots?: number | null;     // Purchased extra slots
  // Team access (Agency plan)
  teamMembers?: number | null;       // Current team members count
  maxTeamMembers?: number | null;    // From plan
  createdAt: Date;
  updatedAt: Date;
};

export const appStatusSchema = z.enum([
  "draft",
  "processing",
  "live",
  "failed",
]);

export const appPlatformSchema = z.enum(["android", "ios", "both"]);

// --- App structure (AppyPie-style primitives) ---
export const appModuleTypeSchema = z.enum([
  "webviewPages",
  "catalog",
  "booking",
  "contactForm",
  "notifications",
  // Business-ready capabilities (AppyPie-like)
  "auth",
  "payments",
  "analytics",
  "admin",
  "publishing",
]);

export const appModuleSchema = z.object({
  id: z.string().min(1),
  type: appModuleTypeSchema,
  name: z.string().min(1).max(100),
  enabled: z.boolean().optional().default(true),
  config: z.record(z.any()).optional(),
});

export const appNavigationStyleSchema = z.enum(["bottom-tabs", "drawer"]);
export const appNavigationItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  icon: z.string().max(32).optional(),
  kind: z.enum(["screen", "webview", "module"]).default("screen"),
  screenId: z.string().optional(),
  url: z.string().optional(),
  moduleId: z.string().optional(),
});

export const appNavigationSchema = z.object({
  style: appNavigationStyleSchema.default("bottom-tabs"),
  items: z.array(appNavigationItemSchema).default([]),
});

export type AppModule = z.infer<typeof appModuleSchema>;
export type AppNavigation = z.infer<typeof appNavigationSchema>;

// Native enhancement features schema
export const appFeaturesSchema = z.object({
  bottomNav: z.boolean().optional().default(false),
  pullToRefresh: z.boolean().optional().default(true),
  offlineScreen: z.boolean().optional().default(true),
  whatsappButton: z.boolean().optional().default(false),
  whatsappNumber: z.string().optional().default(""),
}).optional();

export type AppFeatures = z.infer<typeof appFeaturesSchema>;

export const insertAppSchema = z.object({
  name: z.string().min(2).max(200),
  url: z.string().url().max(2000),
  icon: z.string().max(32).default("rocket"), // Icon ID; can be empty if user has custom logo
  iconUrl: z.string().max(500000).nullable().optional(), // base64 or URL
  iconColor: z.string().min(4).max(32).default("#2563EB").optional(), // Icon background color
  primaryColor: z.string().min(4).max(32).default("#2563EB"),
  platform: appPlatformSchema.default("android"),
  status: appStatusSchema.default("draft"),
  features: appFeaturesSchema.optional(), // Native enhancement features
  plan: planIdSchema.optional(), // Plan tier (preview, starter, standard, pro, agency)
  // Industry template for pre-built screen designs (ecommerce, salon, restaurant, etc.)
  industry: z.string().max(50).optional(),
  // Flag to indicate this is a native-only app (no website URL)
  isNativeOnly: z.boolean().optional(),
  // Initial visual editor data (stored as JSON)
  editorScreens: editorScreensSchema,
  // App modules + navigation (stored as JSON)
  modules: z.array(appModuleSchema).optional(),
  navigation: appNavigationSchema.optional(),
  // Screen history for restore/versioning (stored as JSON)
  editorScreensHistory: z.array(z.any()).optional(),
  // AI generation metadata (stored for reference)
  generatedPrompt: z.string().optional(),
  generatedScreens: z.array(z.string()).optional(),

  // Google Play publishing configuration
  playPublishingMode: z.enum(["central", "user"]).optional(),
});

export type InsertApp = z.infer<typeof insertAppSchema>;
export type App = {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  icon: string;
  iconUrl?: string | null;
  iconColor?: string | null;
  primaryColor: string;
  platform: z.infer<typeof appPlatformSchema>;
  status: z.infer<typeof appStatusSchema>;
  features?: AppFeatures | null; // Native enhancement features
  plan?: PlanId | null; // Plan tier for this app
  industry?: string | null; // Industry template ID
  isNativeOnly?: boolean | null; // True if app is native-only (no website)
  generatedPrompt?: string | null;
  generatedScreens?: string[] | null;
  packageName?: string | null;
  versionCode?: number | null;
  artifactPath?: string | null;
  artifactMime?: string | null;
  artifactSize?: number | null;
  buildLogs?: string | null;
  buildError?: string | null;
  lastBuildAt?: Date | null;
  apiSecret?: string | null; // For authenticating push token registration
  editorScreens?: any[] | null; // Visual editor screens data
  modules?: AppModule[] | null;
  navigation?: AppNavigation | null;
  editorScreensHistory?: any[] | null;

  // Google Play publishing state
  playPublishingMode?: "central" | "user" | null;
  playProductionStatus?: "none" | "requested" | "approved" | "rejected" | null;
  playProductionRequestedAt?: Date | null;
  playProductionDecisionAt?: Date | null;
  playProductionDecisionBy?: string | null;
  playProductionDecisionReason?: string | null;
  lastPlayTrack?: string | null;
  lastPlayVersionCode?: number | null;
  lastPlayPublishedAt?: Date | null;
  lastPlayReleaseStatus?: string | null;

  // Health monitoring (aggregated)
  crashRate7d?: number | null;
  lastCrashAt?: Date | null;
  lastHealthSyncAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const insertContactSubmissionSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(320),
  subject: z.string().min(2).max(200),
  message: z.string().min(10).max(5000),
});

export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;
export type ContactSubmission = InsertContactSubmission & {
  id: string;
  createdAt: Date;
};

// Enhanced ticket statuses for proper workflow
export const supportTicketStatusSchema = z.enum([
  "open",           // New ticket, unassigned
  "in_progress",    // Assigned and being worked on
  "waiting_user",   // Waiting for user response
  "resolved",       // Staff marked as resolved, awaiting user confirmation
  "closed",         // Fully closed (user confirmed or auto-closed after 7 days)
]);
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;

// Ticket priority for triage
export const supportTicketPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type SupportTicketPriority = z.infer<typeof supportTicketPrioritySchema>;

export const insertSupportTicketSchema = z
  .object({
    appId: z.string().uuid().optional().nullable(),
    subject: z.string().min(2).max(200),
    message: z.string().min(10).max(5000),
    priority: supportTicketPrioritySchema.optional().default("medium"),
  })
  .strict();

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = {
  id: string;
  requesterId: string;
  appId: string | null;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assignedTo: string | null;      // Staff member ID
  resolutionNotes: string | null; // Internal notes from staff
  resolvedAt: Date | null;        // When marked resolved
  closedAt: Date | null;          // When finally closed
  createdAt: Date;
  updatedAt: Date;
};

// --- Ticket Messages (conversation thread) ---
export const ticketMessageRoleSchema = z.enum(["user", "staff", "system"]);
export type TicketMessageRole = z.infer<typeof ticketMessageRoleSchema>;

export const insertTicketMessageSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().min(1).max(10000),
  isInternal: z.boolean().optional().default(false), // Staff-only internal notes
});

export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type TicketMessage = {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: TicketMessageRole;
  message: string;
  isInternal: boolean;
  attachments: string | null; // JSON array
  createdAt: Date;
};

// --- Payments ---
export const paymentProviderSchema = z.enum(["razorpay", "stripe"]);
export const paymentStatusSchema = z.enum(["pending", "completed", "failed"]);

export const insertPaymentSchema = z.object({
  appId: z.string().uuid().optional().nullable(),
  provider: paymentProviderSchema.default("razorpay"),
  providerOrderId: z.string().max(128).optional().nullable(),
  providerPaymentId: z.string().max(128).optional().nullable(),
  // Money is stored as integer paise (authoritative).
  // amountInr remains for backwards compatibility with older rows/clients.
  amountPaise: z.number().int().positive(),
  amountInr: z.number().int().nonnegative().optional(),
  plan: z.string().max(50).default("starter"),
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type Payment = {
  id: string;
  userId: string;
  appId: string | null;
  provider: PaymentProvider;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amountPaise: number;
  amountInr?: number;
  plan: string;
  status: PaymentStatus;
  entitlementsAppliedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// --- Update User Schema (for profile edit) ---
export const updateUserSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  currentPassword: z.string().min(8).max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
}).refine(
  (data) => {
    // If newPassword is provided, currentPassword must also be provided
    if (data.newPassword && !data.currentPassword) return false;
    return true;
  },
  { message: "Current password required to set new password" }
);

export type UpdateUser = z.infer<typeof updateUserSchema>;

// Extended User type with new fields
export type UserWithAuth = User & {
  emailVerified?: boolean;
  emailVerifyToken?: string | null;
  resetToken?: string | null;
  resetTokenExpiresAt?: Date | null;
};

// --- Push Notifications ---
export const pushPlatformSchema = z.enum(["android", "ios", "web"]);
export const pushStatusSchema = z.enum(["pending", "sent", "failed"]);

export const insertPushTokenSchema = z.object({
  appId: z.string().uuid(),
  token: z.string().min(1).max(512),
  platform: pushPlatformSchema.default("android"),
  deviceInfo: z.string().optional().nullable(),
});

export const insertPushNotificationSchema = z.object({
  appId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional().nullable(),
  actionUrl: z.string().url().optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
});

export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type InsertPushNotification = z.infer<typeof insertPushNotificationSchema>;
export type PushPlatform = z.infer<typeof pushPlatformSchema>;
export type PushStatus = z.infer<typeof pushStatusSchema>;

export type PushToken = {
  id: string;
  appId: string;
  token: string;
  platform: PushPlatform;
  deviceInfo: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PushNotification = {
  id: string;
  appId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  actionUrl: string | null;
  status: PushStatus;
  sentCount: number;
  failedCount: number;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// --- Audit Logs ---
export const auditActionSchema = z.enum([
  "user.register",
  "user.login",
  "user.logout",
  "user.email_verified",
  "user.password_reset",
  "user.password_changed",
  "user.deleted",
  "user.role_changed",
  "app.created",
  "app.updated",
  "app.deleted",
  "app.build_started",
  "app.build_completed",
  "app.build_failed",
  "payment.initiated",
  "payment.completed",
  "payment.failed",
  "payment.refunded",
  "subscription.activated",
  "subscription.cancelled",
  "subscription.expired",
  "admin.bypass_payment",
  "admin.user_created",
  "admin.user_deleted",
  "support.ticket_created",
  "support.ticket_closed",

  // Publishing / Google Play
  "user.play.connected",
  "user.play.disconnected",
  "app.play.request_production",
  "app.play.approve_production",
  "app.play.reject_production",
  "app.play.publish.internal",
  "app.play.publish.production",
  "app.play.promote",
  "app.health.check",
]);

export type AuditAction = z.infer<typeof auditActionSchema>;

export type AuditLog = {
  id: string;
  userId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type InsertAuditLog = {
  userId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};
