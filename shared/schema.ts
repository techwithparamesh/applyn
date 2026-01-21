import { z } from "zod";

export const insertUserSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  username: z
    .string()
    .min(3)
    .max(200)
    .transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8).max(200),
});

export const userRoleSchema = z.enum(["admin", "support", "user"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = {
  id: string;
  name: string | null;
  username: string;
  role: UserRole;
  googleId?: string | null;
  password: string;
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

export const insertAppSchema = z.object({
  name: z.string().min(2).max(200),
  url: z.string().url().max(2000),
  icon: z.string().min(1).max(10).default("🚀"),
  iconUrl: z.string().max(500000).nullable().optional(), // base64 or URL
  iconColor: z.string().min(4).max(32).default("#2563EB").optional(), // Icon background color
  primaryColor: z.string().min(4).max(32).default("#2563EB"),
  platform: appPlatformSchema.default("android"),
  status: appStatusSchema.default("draft"),
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
  packageName?: string | null;
  versionCode?: number | null;
  artifactPath?: string | null;
  artifactMime?: string | null;
  artifactSize?: number | null;
  buildLogs?: string | null;
  buildError?: string | null;
  lastBuildAt?: Date | null;
  apiSecret?: string | null; // For authenticating push token registration
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

export const supportTicketStatusSchema = z.enum(["open", "closed"]);
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;

export const insertSupportTicketSchema = z
  .object({
    appId: z.string().uuid().optional().nullable(),
    subject: z.string().min(2).max(200),
    message: z.string().min(10).max(5000),
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
  createdAt: Date;
  updatedAt: Date;
};

// --- Payments ---
export const paymentProviderSchema = z.enum(["razorpay", "stripe"]);
export const paymentStatusSchema = z.enum(["pending", "completed", "failed"]);

export const insertPaymentSchema = z.object({
  appId: z.string().uuid().optional().nullable(),
  provider: paymentProviderSchema.default("razorpay"),
  providerOrderId: z.string().max(128).optional().nullable(),
  providerPaymentId: z.string().max(128).optional().nullable(),
  amountInr: z.number().int().positive(),
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
  amountInr: number;
  plan: string;
  status: PaymentStatus;
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
