import type {
  App,
  ContactSubmission,
  InsertApp,
  InsertContactSubmission,
  InsertSupportTicket,
  InsertUser,
  SupportTicket,
  SupportTicketStatus,
  UserRole,
  User,
  Payment,
  InsertPayment,
  PaymentStatus,
  PushToken,
  InsertPushToken,
  PushNotification,
  InsertPushNotification,
  PushStatus,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { MysqlStorage } from "./storage.mysql";

export type BuildJobStatus = "queued" | "running" | "succeeded" | "failed";

function maxBuildAttempts() {
  return Number(process.env.MAX_BUILD_ATTEMPTS || 3);
}

function jobLockTtlMs() {
  return Number(process.env.BUILD_JOB_LOCK_TTL_MS || 30 * 60 * 1000);
}

export type BuildJob = {
  id: string;
  appId: string;
  ownerId: string;
  status: BuildJobStatus;
  attempts: number;
  lockToken?: string | null;
  lockedAt?: Date | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AppBuildPatch = {
  status?: App["status"];
  packageName?: string | null;
  versionCode?: number | null;
  artifactPath?: string | null;
  artifactMime?: string | null;
  artifactSize?: number | null;
  buildLogs?: string | null;
  buildError?: string | null;
  lastBuildAt?: Date | null;
};

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: UserRole }): Promise<User>;
  updateUser(id: string, patch: Partial<{ name: string; password: string }>): Promise<User | undefined>;
  linkGoogleId(userId: string, googleId: string): Promise<User | undefined>;
  setResetToken(userId: string, token: string, expiresAt: Date): Promise<User | undefined>;
  clearResetToken(userId: string): Promise<User | undefined>;
  setEmailVerified(userId: string, verified: boolean): Promise<User | undefined>;

  // Subscription management (yearly renewal model)
  activateSubscription(userId: string, data: {
    plan: string;
    planStatus: string;
    planStartDate: Date;
    planExpiryDate: Date;
    remainingRebuilds: number;
    subscriptionId?: string;
    maxAppsAllowed?: number;
    maxTeamMembers?: number;
  }): Promise<User | undefined>;
  updateSubscriptionStatus(userId: string, status: string): Promise<User | undefined>;
  decrementRebuilds(userId: string): Promise<User | undefined>;
  addRebuilds(userId: string, count: number): Promise<User | undefined>;
  getUsersWithExpiringSubscriptions(daysUntilExpiry: number): Promise<User[]>;
  getUsersWithExpiredSubscriptions(): Promise<User[]>;
  expireSubscriptions(): Promise<number>;

  // Admin use-cases
  listUsers(): Promise<Array<Omit<User, "password">>>;

  listAppsByOwner(ownerId: string): Promise<App[]>;
  listAppsAll(): Promise<App[]>;
  getApp(id: string): Promise<App | undefined>;
  createApp(ownerId: string, app: InsertApp): Promise<App>;
  updateApp(id: string, patch: Partial<InsertApp>): Promise<App | undefined>;
  deleteApp(id: string): Promise<boolean>;

  enqueueBuildJob(ownerId: string, appId: string): Promise<BuildJob>;
  claimNextBuildJob(workerId: string): Promise<BuildJob | null>;
  completeBuildJob(jobId: string, status: Exclude<BuildJobStatus, "queued" | "running">, error?: string | null): Promise<BuildJob | undefined>;
  requeueBuildJob(jobId: string): Promise<BuildJob | undefined>;
  listBuildJobsForApp(appId: string): Promise<BuildJob[]>;
  updateAppBuild(id: string, patch: AppBuildPatch): Promise<App | undefined>;

  createContactSubmission(payload: InsertContactSubmission): Promise<ContactSubmission>;

  // Support ticketing (MVP)
  createSupportTicket(requesterId: string, payload: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTicket(id: string): Promise<SupportTicket | undefined>;
  listSupportTicketsByRequester(requesterId: string): Promise<SupportTicket[]>;
  listSupportTicketsAll(): Promise<SupportTicket[]>;
  updateSupportTicketStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | undefined>;

  // Payments
  createPayment(userId: string, payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByOrderId(orderId: string): Promise<Payment | undefined>;
  updatePaymentStatus(id: string, status: PaymentStatus, providerPaymentId?: string | null): Promise<Payment | undefined>;
  listPaymentsByUser(userId: string): Promise<Payment[]>;
  getCompletedPaymentForApp(appId: string): Promise<Payment | undefined>;
  countCompletedBuildsForApp(appId: string, sinceDate?: Date): Promise<number>;

  // Push Notifications
  createPushToken(token: InsertPushToken): Promise<PushToken>;
  getPushToken(id: string): Promise<PushToken | undefined>;
  getPushTokenByToken(token: string): Promise<PushToken | undefined>;
  listPushTokensByApp(appId: string): Promise<PushToken[]>;
  deletePushToken(id: string): Promise<boolean>;
  
  createPushNotification(notification: InsertPushNotification): Promise<PushNotification>;
  getPushNotification(id: string): Promise<PushNotification | undefined>;
  listPushNotificationsByApp(appId: string): Promise<PushNotification[]>;
  updatePushNotificationStatus(id: string, status: PushStatus, sentCount?: number, failedCount?: number): Promise<PushNotification | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private apps: Map<string, App>;
  private contacts: Map<string, ContactSubmission>;
  private tickets: Map<string, SupportTicket>;
  private buildJobs: Map<string, BuildJob>;
  private payments: Map<string, Payment>;
  private pushTokens: Map<string, PushToken>;
  private pushNotifications: Map<string, PushNotification>;

  constructor() {
    this.users = new Map();
    this.apps = new Map();
    this.contacts = new Map();
    this.tickets = new Map();
    this.buildJobs = new Map();
    this.payments = new Map();
    this.pushTokens = new Map();
    this.pushNotifications = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => (u as any).googleId === googleId);
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => (u as any).resetToken === token);
  }

  async createUser(insertUser: InsertUser & { role?: UserRole }): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      id,
      name: insertUser.name ?? null,
      username: insertUser.username,
      role: insertUser.role ?? "user",
      googleId: (insertUser as any).googleId ?? null,
      password: insertUser.password,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, patch: Partial<{ name: string; password: string }>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated: User = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updated: User = {
      ...existing,
      googleId,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async setResetToken(userId: string, token: string, expiresAt: Date): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updated: any = {
      ...existing,
      resetToken: token,
      resetTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async clearResetToken(userId: string): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updated: any = {
      ...existing,
      resetToken: null,
      resetTokenExpiresAt: null,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async setEmailVerified(userId: string, verified: boolean): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updated: any = {
      ...existing,
      emailVerified: verified,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  // ============================================
  // SUBSCRIPTION MANAGEMENT (In-Memory)
  // ============================================

  async activateSubscription(
    userId: string,
    data: {
      plan: string;
      planStatus: string;
      planStartDate: Date;
      planExpiryDate: Date;
      remainingRebuilds: number;
      subscriptionId?: string;
      maxAppsAllowed?: number;
      maxTeamMembers?: number;
    }
  ): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updated: any = {
      ...existing,
      plan: data.plan,
      planStatus: data.planStatus,
      planStartDate: data.planStartDate,
      planExpiryDate: data.planExpiryDate,
      remainingRebuilds: data.remainingRebuilds,
      subscriptionId: data.subscriptionId ?? null,
      maxAppsAllowed: data.maxAppsAllowed ?? existing.maxAppsAllowed ?? 1,
      maxTeamMembers: data.maxTeamMembers ?? existing.maxTeamMembers ?? 1,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async updateSubscriptionStatus(userId: string, status: string): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updated: any = {
      ...existing,
      planStatus: status,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async decrementRebuilds(userId: string): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const current = (existing as any).remainingRebuilds || 0;
    const updated: any = {
      ...existing,
      remainingRebuilds: Math.max(0, current - 1),
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async addRebuilds(userId: string, count: number): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const current = (existing as any).remainingRebuilds || 0;
    const updated: any = {
      ...existing,
      remainingRebuilds: current + count,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async getUsersWithExpiringSubscriptions(daysUntilExpiry: number): Promise<User[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysUntilExpiry);
    const today = new Date();
    
    return Array.from(this.users.values()).filter((user: any) => {
      if (user.planStatus !== "active" || !user.planExpiryDate) return false;
      return user.planExpiryDate > today && user.planExpiryDate <= futureDate;
    });
  }

  async getUsersWithExpiredSubscriptions(): Promise<User[]> {
    const now = new Date();
    return Array.from(this.users.values()).filter((user: any) => {
      if (user.planStatus !== "active" || !user.planExpiryDate) return false;
      return user.planExpiryDate < now;
    });
  }

  async expireSubscriptions(): Promise<number> {
    const now = new Date();
    let count = 0;
    
    for (const [id, user] of this.users.entries()) {
      const u = user as any;
      if (u.planStatus === "active" && u.planExpiryDate && u.planExpiryDate < now) {
        this.users.set(id, {
          ...user,
          planStatus: "expired",
          updatedAt: new Date(),
        } as any);
        count++;
      }
    }
    
    return count;
  }

  async listUsers(): Promise<Array<Omit<User, "password">>> {
    return Array.from(this.users.values())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(({ password: _pw, ...rest }) => rest);
  }

  async listAppsByOwner(ownerId: string): Promise<App[]> {
    return Array.from(this.apps.values())
      .filter((a) => a.ownerId === ownerId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async listAppsAll(): Promise<App[]> {
    return Array.from(this.apps.values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async getApp(id: string): Promise<App | undefined> {
    return this.apps.get(id);
  }

  async createApp(ownerId: string, insertApp: InsertApp): Promise<App> {
    const id = randomUUID();
    const now = new Date();
    const app: App = {
      id,
      ownerId,
      name: insertApp.name,
      url: insertApp.url,
      icon: insertApp.icon ?? "🚀",
      iconUrl: insertApp.iconUrl ?? null,
      iconColor: insertApp.iconColor ?? null,
      primaryColor: insertApp.primaryColor ?? "#2563EB",
      platform: insertApp.platform ?? "android",
      status: insertApp.status ?? "draft",
      features: insertApp.features ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.apps.set(id, app);
    return app;
  }

  async updateApp(id: string, patch: Partial<InsertApp>): Promise<App | undefined> {
    const existing = this.apps.get(id);
    if (!existing) return undefined;
    const updated: App = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.apps.set(id, updated);
    return updated;
  }

  async updateAppBuild(id: string, patch: AppBuildPatch): Promise<App | undefined> {
    const existing = this.apps.get(id);
    if (!existing) return undefined;
    const updated: App = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.apps.set(id, updated);
    return updated;
  }

  async deleteApp(id: string): Promise<boolean> {
    return this.apps.delete(id);
  }

  async createContactSubmission(
    payload: InsertContactSubmission,
  ): Promise<ContactSubmission> {
    const id = randomUUID();
    const createdAt = new Date();
    const row: ContactSubmission = {
      id,
      createdAt,
      ...payload,
    };
    this.contacts.set(id, row);
    return row;
  }

  async createSupportTicket(requesterId: string, payload: InsertSupportTicket): Promise<SupportTicket> {
    const id = randomUUID();
    const now = new Date();
    const row: SupportTicket = {
      id,
      requesterId,
      appId: payload.appId ?? null,
      subject: payload.subject,
      message: payload.message,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(id, row);
    return row;
  }

  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    return this.tickets.get(id);
  }

  async listSupportTicketsByRequester(requesterId: string): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values())
      .filter((t) => t.requesterId === requesterId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async listSupportTicketsAll(): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async updateSupportTicketStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;
    const updated: SupportTicket = { ...existing, status, updatedAt: new Date() };
    this.tickets.set(id, updated);
    return updated;
  }

  async enqueueBuildJob(ownerId: string, appId: string): Promise<BuildJob> {
    const id = randomUUID();
    const now = new Date();
    const row: BuildJob = {
      id,
      ownerId,
      appId,
      status: "queued",
      attempts: 0,
      lockToken: null,
      lockedAt: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.buildJobs.set(id, row);
    return row;
  }

  async claimNextBuildJob(workerId: string): Promise<BuildJob | null> {
    const maxAttempts = maxBuildAttempts();
    const staleBefore = new Date(Date.now() - jobLockTtlMs());

    const candidate = Array.from(this.buildJobs.values())
      .filter((j) => {
        const reclaimableRunning = j.status === "running" && !!j.lockedAt && j.lockedAt < staleBefore;
        const eligible = j.status === "queued" || reclaimableRunning;
        return eligible && j.attempts < maxAttempts;
      })
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))[0];

    if (!candidate) return null;

    const lockToken = `${workerId}:${randomUUID()}`;
    const updated: BuildJob = {
      ...candidate,
      status: "running",
      attempts: candidate.attempts + 1,
      lockToken,
      lockedAt: new Date(),
      updatedAt: new Date(),
    };
    this.buildJobs.set(updated.id, updated);
    return updated;
  }

  async completeBuildJob(
    jobId: string,
    status: Exclude<BuildJobStatus, "queued" | "running">,
    error?: string | null,
  ): Promise<BuildJob | undefined> {
    const existing = this.buildJobs.get(jobId);
    if (!existing) return undefined;
    const updated: BuildJob = {
      ...existing,
      status,
      error: error ?? null,
      updatedAt: new Date(),
    };
    this.buildJobs.set(jobId, updated);
    return updated;
  }

  async requeueBuildJob(jobId: string): Promise<BuildJob | undefined> {
    const job = this.buildJobs.get(jobId);
    if (!job) return undefined;
    const updated: BuildJob = {
      ...job,
      status: "queued",
      lockToken: null,
      lockedAt: null,
      error: null,
      updatedAt: new Date(),
    };
    this.buildJobs.set(jobId, updated);
    return updated;
  }

  async listBuildJobsForApp(appId: string): Promise<BuildJob[]> {
    return Array.from(this.buildJobs.values()).filter((j) => j.appId === appId);
  }

  // --- Payment methods ---
  async createPayment(userId: string, payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const now = new Date();
    const row: Payment = {
      id,
      userId,
      appId: payment.appId ?? null,
      provider: payment.provider ?? "razorpay",
      providerOrderId: payment.providerOrderId ?? null,
      providerPaymentId: payment.providerPaymentId ?? null,
      amountInr: payment.amountInr,
      plan: payment.plan ?? "starter",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.payments.set(id, row);
    return row;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async getPaymentByOrderId(orderId: string): Promise<Payment | undefined> {
    return Array.from(this.payments.values()).find((p) => p.providerOrderId === orderId);
  }

  async updatePaymentStatus(id: string, status: PaymentStatus, providerPaymentId?: string | null): Promise<Payment | undefined> {
    const existing = this.payments.get(id);
    if (!existing) return undefined;
    const updated: Payment = {
      ...existing,
      status,
      providerPaymentId: providerPaymentId ?? existing.providerPaymentId,
      updatedAt: new Date(),
    };
    this.payments.set(id, updated);
    return updated;
  }

  async listPaymentsByUser(userId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async getCompletedPaymentForApp(appId: string): Promise<Payment | undefined> {
    return Array.from(this.payments.values()).find(
      (p) => p.appId === appId && p.status === "completed"
    );
  }

  async countCompletedBuildsForApp(appId: string, sinceDate?: Date): Promise<number> {
    // Count build jobs that completed successfully for this app
    return Array.from(this.buildJobs.values()).filter((j) => {
      if (j.appId !== appId) return false;
      if (j.status !== "succeeded") return false;
      if (sinceDate && j.createdAt < sinceDate) return false;
      return true;
    }).length;
  }

  // --- Push Notification methods ---
  async createPushToken(token: InsertPushToken): Promise<PushToken> {
    const id = randomUUID();
    const now = new Date();
    const row: PushToken = {
      id,
      appId: token.appId,
      token: token.token,
      platform: token.platform ?? "android",
      deviceInfo: token.deviceInfo ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.pushTokens.set(id, row);
    return row;
  }

  async getPushToken(id: string): Promise<PushToken | undefined> {
    return this.pushTokens.get(id);
  }

  async getPushTokenByToken(token: string): Promise<PushToken | undefined> {
    return Array.from(this.pushTokens.values()).find((t) => t.token === token);
  }

  async listPushTokensByApp(appId: string): Promise<PushToken[]> {
    return Array.from(this.pushTokens.values())
      .filter((t) => t.appId === appId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async deletePushToken(id: string): Promise<boolean> {
    return this.pushTokens.delete(id);
  }

  async createPushNotification(notification: InsertPushNotification): Promise<PushNotification> {
    const id = randomUUID();
    const now = new Date();
    const row: PushNotification = {
      id,
      appId: notification.appId,
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl ?? null,
      actionUrl: notification.actionUrl ?? null,
      status: "pending",
      sentCount: 0,
      failedCount: 0,
      scheduledAt: notification.scheduledAt ?? null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.pushNotifications.set(id, row);
    return row;
  }

  async getPushNotification(id: string): Promise<PushNotification | undefined> {
    return this.pushNotifications.get(id);
  }

  async listPushNotificationsByApp(appId: string): Promise<PushNotification[]> {
    return Array.from(this.pushNotifications.values())
      .filter((n) => n.appId === appId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async updatePushNotificationStatus(
    id: string,
    status: PushStatus,
    sentCount?: number,
    failedCount?: number
  ): Promise<PushNotification | undefined> {
    const existing = this.pushNotifications.get(id);
    if (!existing) return undefined;
    const updated: PushNotification = {
      ...existing,
      status,
      sentCount: sentCount ?? existing.sentCount,
      failedCount: failedCount ?? existing.failedCount,
      sentAt: status === "sent" ? new Date() : existing.sentAt,
      updatedAt: new Date(),
    };
    this.pushNotifications.set(id, updated);
    return updated;
  }
}

function resolveStorageKind() {
  const explicit = (process.env.STORAGE || "").toLowerCase();
  if (explicit) return explicit;
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("mysql://")) return "mysql";
  return "mem";
}

const kind = resolveStorageKind();
export const storage: IStorage =
  kind === "mysql" && process.env.DATABASE_URL
    ? (new MysqlStorage() as unknown as IStorage)
    : new MemStorage();
