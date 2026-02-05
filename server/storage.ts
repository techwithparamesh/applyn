import type {
  App,
  ContactSubmission,
  InsertApp,
  InsertContactSubmission,
  InsertSupportTicket,
  InsertTicketMessage,
  InsertUser,
  SupportTicket,
  SupportTicketStatus,
  TicketMessage,
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
  AuditLog,
  InsertAuditLog,
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
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: UserRole; mustChangePassword?: boolean }): Promise<User>;
  updateUser(id: string, patch: Partial<{ name: string; password: string; role?: UserRole; mustChangePassword?: boolean }>): Promise<User | undefined>;
  setUserPermissions(id: string, permissions: string[] | null): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  linkGoogleId(userId: string, googleId: string): Promise<User | undefined>;
  setResetToken(userId: string, token: string, expiresAt: Date): Promise<User | undefined>;
  clearResetToken(userId: string): Promise<User | undefined>;
  setEmailVerified(userId: string, verified: boolean): Promise<User | undefined>;

  // Google Play OAuth (Phase 2)
  setUserPlayRefreshTokenEnc(userId: string, tokenEnc: string | null): Promise<User | undefined>;

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
  startTrial(userId: string, trialDays: number): Promise<
    | { status: "subscription_active" }
    | { status: "already_started"; trialEndsAt: Date }
    | { status: "started"; trialEndsAt: Date }
  >;
  decrementRebuilds(userId: string): Promise<User | undefined>;
  addRebuilds(userId: string, count: number): Promise<User | undefined>;
  addExtraAppSlot(userId: string, count: number): Promise<User | undefined>;
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
  completeBuildJob(jobId: string, lockToken: string, status: Exclude<BuildJobStatus, "queued" | "running">, error?: string | null): Promise<boolean>;
  requeueBuildJob(jobId: string, lockToken: string): Promise<boolean>;
  listBuildJobsForApp(appId: string): Promise<BuildJob[]>;
  updateAppBuild(id: string, patch: AppBuildPatch): Promise<App | undefined>;

  createContactSubmission(payload: InsertContactSubmission): Promise<ContactSubmission>;

  // Support ticketing (Enhanced)
  createSupportTicket(requesterId: string, payload: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTicket(id: string): Promise<SupportTicket | undefined>;
  listSupportTicketsByRequester(requesterId: string): Promise<SupportTicket[]>;
  listSupportTicketsAll(): Promise<SupportTicket[]>;
  listSupportTicketsByAssignee(assigneeId: string): Promise<SupportTicket[]>;
  updateSupportTicketStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | undefined>;
  assignSupportTicket(id: string, assigneeId: string | null): Promise<SupportTicket | undefined>;
  resolveTicket(id: string, resolutionNotes: string): Promise<SupportTicket | undefined>;
  closeTicket(id: string): Promise<SupportTicket | undefined>;
  reopenTicket(id: string): Promise<SupportTicket | undefined>;
  updateTicketPriority(id: string, priority: string): Promise<SupportTicket | undefined>;
  getTicketStats(): Promise<{ open: number; inProgress: number; waitingUser: number; resolved: number; closed: number }>;
  getStaffTicketStats(staffId: string): Promise<{ assigned: number; resolved: number }>;
  deleteSupportTicket(id: string): Promise<boolean>;

  // Ticket Messages (conversation thread)
  createTicketMessage(senderId: string, senderRole: string, payload: InsertTicketMessage): Promise<TicketMessage>;
  listTicketMessages(ticketId: string, includeInternal?: boolean): Promise<TicketMessage[]>;
  getTicketMessage(id: string): Promise<TicketMessage | undefined>;

  // Payments
  createPayment(userId: string, payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByOrderId(orderId: string): Promise<Payment | undefined>;
  updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    providerPaymentId?: string | null,
  ): Promise<{ payment?: Payment; updated: boolean }>;
  applyEntitlementsIfNeeded(paymentId: string): Promise<void>;
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

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  listAuditLogs(options?: { 
    userId?: string; 
    action?: string; 
    targetType?: string; 
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;
  countAuditLogs(options?: { userId?: string; action?: string; targetType?: string; }): Promise<number>;

  // Email verification
  setEmailVerifyToken(userId: string, token: string): Promise<User | undefined>;
  getUserByEmailVerifyToken(token: string): Promise<User | undefined>;
  clearEmailVerifyToken(userId: string): Promise<User | undefined>;

  // Analytics (for admin dashboard)
  getAnalytics(): Promise<{
    totalUsers: number;
    totalApps: number;
    totalPayments: number;
    totalRevenue: number;
    usersToday: number;
    usersThisWeek: number;
    usersThisMonth: number;
    appsToday: number;
    appsThisWeek: number;
    appsThisMonth: number;
    paymentsToday: number;
    paymentsThisWeek: number;
    paymentsThisMonth: number;
    revenueToday: number;
    revenueThisWeek: number;
    revenueThisMonth: number;
    usersByDay: Array<{ date: string; count: number }>;
    revenueByDay: Array<{ date: string; amount: number }>;
    appsByPlan: Array<{ plan: string; count: number }>;
    buildSuccessRate: number;
  }>;

  // Account lockout (brute-force protection)
  incrementFailedLogin(userId: string): Promise<{ attempts: number; lockedUntil: Date | null }>;
  resetFailedLogin(userId: string): Promise<void>;
  isAccountLocked(userId: string): Promise<{ locked: boolean; lockedUntil: Date | null }>;
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
  private auditLogs: Map<string, AuditLog>;

  constructor() {
    this.users = new Map();
    this.apps = new Map();
    this.contacts = new Map();
    this.tickets = new Map();
    this.buildJobs = new Map();
    this.payments = new Map();
    this.pushTokens = new Map();
    this.pushNotifications = new Map();
    this.auditLogs = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async setUserPermissions(id: string, permissions: string[] | null): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated: User = { ...existing, permissions: permissions ?? [] } as any;
    this.users.set(id, updated);
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
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

  async createUser(insertUser: InsertUser & { role?: UserRole; mustChangePassword?: boolean }): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      id,
      name: insertUser.name ?? null,
      username: insertUser.username,
      role: insertUser.role ?? "user",
      permissions: [],
      googleId: (insertUser as any).googleId ?? null,
      password: insertUser.password,
      mustChangePassword: insertUser.mustChangePassword ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, patch: Partial<{ name: string; password: string; mustChangePassword?: boolean }>): Promise<User | undefined> {
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

  async setUserPlayRefreshTokenEnc(userId: string, tokenEnc: string | null): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updated: any = {
      ...existing,
      playRefreshTokenEnc: tokenEnc,
      playConnectedAt: tokenEnc ? new Date() : null,
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

  async startTrial(
    userId: string,
    trialDays: number,
  ): Promise<
    | { status: "subscription_active" }
    | { status: "already_started"; trialEndsAt: Date }
    | { status: "started"; trialEndsAt: Date }
  > {
    const existing = this.users.get(userId);
    if (!existing) return { status: "subscription_active" };

    if ((existing as any).planStatus === "active") {
      return { status: "subscription_active" };
    }

    const startedAt = (existing as any).trialStartedAt as Date | null | undefined;
    const endsAt = (existing as any).trialEndsAt as Date | null | undefined;
    if (startedAt) {
      const inferredEndsAt = endsAt ? new Date(endsAt) : new Date(new Date(startedAt).getTime() + trialDays * 24 * 60 * 60 * 1000);
      return { status: "already_started", trialEndsAt: inferredEndsAt };
    }

    const now = new Date();
    const newEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    const updated: any = {
      ...existing,
      trialStartedAt: now,
      trialEndsAt: newEndsAt,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return { status: "started", trialEndsAt: newEndsAt };
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

  async addExtraAppSlot(userId: string, count: number): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const current = (existing as any).extraAppSlots || 0;
    const updated: any = {
      ...existing,
      extraAppSlots: current + count,
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
    
    const entries = Array.from(this.users.entries());
    for (const [id, user] of entries) {
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

  async deleteUser(id: string): Promise<boolean> {
    if (!this.users.has(id)) return false;
    this.users.delete(id);
    return true;
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
      industry: insertApp.industry ?? null,
      isNativeOnly: insertApp.isNativeOnly ?? null,
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
      priority: payload.priority ?? "medium",
      assignedTo: null,
      resolutionNotes: null,
      resolvedAt: null,
      closedAt: null,
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

  async listSupportTicketsByAssignee(assigneeId: string): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values())
      .filter((t) => t.assignedTo === assigneeId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async updateSupportTicketStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;
    const updated: SupportTicket = { ...existing, status, updatedAt: new Date() };
    this.tickets.set(id, updated);
    return updated;
  }

  async assignSupportTicket(id: string, assigneeId: string | null): Promise<SupportTicket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;
    const updated: SupportTicket = { 
      ...existing, 
      assignedTo: assigneeId,
      status: assigneeId ? "in_progress" : "open",
      updatedAt: new Date() 
    };
    this.tickets.set(id, updated);
    return updated;
  }

  async resolveTicket(id: string, resolutionNotes: string): Promise<SupportTicket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;
    const now = new Date();
    const updated: SupportTicket = { 
      ...existing, 
      status: "resolved",
      resolutionNotes,
      resolvedAt: now,
      updatedAt: now,
    };
    this.tickets.set(id, updated);
    return updated;
  }

  async closeTicket(id: string): Promise<SupportTicket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;
    const now = new Date();
    const updated: SupportTicket = { 
      ...existing, 
      status: "closed",
      closedAt: now,
      updatedAt: now,
    };
    this.tickets.set(id, updated);
    return updated;
  }

  async reopenTicket(id: string): Promise<SupportTicket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;
    const updated: SupportTicket = { 
      ...existing, 
      status: "open",
      resolvedAt: null,
      closedAt: null,
      updatedAt: new Date(),
    };
    this.tickets.set(id, updated);
    return updated;
  }

  async updateTicketPriority(id: string, priority: string): Promise<SupportTicket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;
    const updated: SupportTicket = { 
      ...existing, 
      priority: priority as any,
      updatedAt: new Date(),
    };
    this.tickets.set(id, updated);
    return updated;
  }

  async getTicketStats(): Promise<{ open: number; inProgress: number; waitingUser: number; resolved: number; closed: number }> {
    const tickets = Array.from(this.tickets.values());
    return {
      open: tickets.filter(t => t.status === "open").length,
      inProgress: tickets.filter(t => t.status === "in_progress").length,
      waitingUser: tickets.filter(t => t.status === "waiting_user").length,
      resolved: tickets.filter(t => t.status === "resolved").length,
      closed: tickets.filter(t => t.status === "closed").length,
    };
  }

  async getStaffTicketStats(staffId: string): Promise<{ assigned: number; resolved: number }> {
    const tickets = Array.from(this.tickets.values());
    return {
      assigned: tickets.filter(t => t.assignedTo === staffId && t.status !== "closed").length,
      resolved: tickets.filter(t => t.assignedTo === staffId && (t.status === "resolved" || t.status === "closed")).length,
    };
  }

  async deleteSupportTicket(id: string): Promise<boolean> {
    return this.tickets.delete(id);
  }

  // Ticket Messages - In-memory implementation
  private ticketMessages = new Map<string, TicketMessage>();

  async createTicketMessage(senderId: string, senderRole: string, payload: InsertTicketMessage): Promise<TicketMessage> {
    const id = randomUUID();
    const now = new Date();
    const msg: TicketMessage = {
      id,
      ticketId: payload.ticketId,
      senderId,
      senderRole: senderRole as "user" | "staff" | "system",
      message: payload.message,
      isInternal: payload.isInternal || false,
      attachments: null,
      createdAt: now,
    };
    this.ticketMessages.set(id, msg);
    return msg;
  }

  async listTicketMessages(ticketId: string, includeInternal = false): Promise<TicketMessage[]> {
    return Array.from(this.ticketMessages.values())
      .filter(m => m.ticketId === ticketId && (includeInternal || !m.isInternal))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getTicketMessage(id: string): Promise<TicketMessage | undefined> {
    return this.ticketMessages.get(id);
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
    lockToken: string,
    status: Exclude<BuildJobStatus, "queued" | "running">,
    error?: string | null,
  ): Promise<boolean> {
    const existing = this.buildJobs.get(jobId);
    if (!existing) return false;
    if (!existing.lockToken || existing.lockToken !== lockToken) {
      console.warn(`[Storage] completeBuildJob ignored; lock token mismatch for job ${jobId}`);
      return false;
    }
    const updated: BuildJob = {
      ...existing,
      status,
      error: error ?? null,
      updatedAt: new Date(),
    };
    this.buildJobs.set(jobId, updated);
    return true;
  }

  async requeueBuildJob(jobId: string, lockToken: string): Promise<boolean> {
    const job = this.buildJobs.get(jobId);
    if (!job) return false;
    if (!job.lockToken || job.lockToken !== lockToken) {
      console.warn(`[Storage] requeueBuildJob ignored; lock token mismatch for job ${jobId}`);
      return false;
    }
    const updated: BuildJob = {
      ...job,
      status: "queued",
      lockToken: null,
      lockedAt: null,
      error: null,
      updatedAt: new Date(),
    };
    this.buildJobs.set(jobId, updated);
    return true;
  }

  async listBuildJobsForApp(appId: string): Promise<BuildJob[]> {
    return Array.from(this.buildJobs.values()).filter((j) => j.appId === appId);
  }

  // --- Payment methods ---
  async createPayment(userId: string, payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const now = new Date();

    const amountPaise = Number((payment as any).amountPaise);
    if (!Number.isFinite(amountPaise) || amountPaise < 0) {
      throw new Error("Invalid payment amountPaise");
    }
    const amountInrLegacy = Number.isFinite((payment as any).amountInr)
      ? Number((payment as any).amountInr)
      : Math.floor(amountPaise / 100);
    const row: Payment = {
      id,
      userId,
      appId: payment.appId ?? null,
      provider: payment.provider ?? "razorpay",
      providerOrderId: payment.providerOrderId ?? null,
      providerPaymentId: payment.providerPaymentId ?? null,
      amountPaise,
      amountInr: amountInrLegacy,
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

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    providerPaymentId?: string | null,
  ): Promise<{ payment?: Payment; updated: boolean }> {
    const existing = this.payments.get(id);
    if (!existing) return { payment: undefined, updated: false };

    // Atomic semantics: only transition from pending.
    if (existing.status !== "pending") {
      return { payment: existing, updated: false };
    }

    const updatedPayment: Payment = {
      ...existing,
      status,
      providerPaymentId: providerPaymentId ?? existing.providerPaymentId,
      updatedAt: new Date(),
    };
    this.payments.set(id, updatedPayment);
    return { payment: updatedPayment, updated: true };
  }

  async applyEntitlementsIfNeeded(paymentId: string): Promise<void> {
    const payment = this.payments.get(paymentId);
    if (!payment) return;
    if (payment.status !== "completed") return;
    if (payment.entitlementsAppliedAt) return;

    const user = await this.getUser(payment.userId);
    if (!user) return;

    const plan = payment.plan as "starter" | "standard" | "pro" | "agency" | "extra_rebuild" | "extra_rebuild_pack" | "extra_app_slot";

    if (plan === "extra_rebuild") {
      await this.addRebuilds(user.id, 1);
    } else if (plan === "extra_rebuild_pack") {
      await this.addRebuilds(user.id, 10);
    } else if (plan === "extra_app_slot") {
      await this.addExtraAppSlot(user.id, 1);
    } else if (plan === "starter" || plan === "standard" || plan === "pro" || plan === "agency") {
      const now = new Date();
      let expiryDate = new Date(now);

      const freshUser = await this.getUser(user.id);
      if (freshUser?.planExpiryDate && freshUser.planStatus === "active") {
        const currentExpiry = new Date(freshUser.planExpiryDate);
        if (currentExpiry > now) {
          expiryDate = new Date(currentExpiry);
        }
      }

      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const PLAN_REBUILDS: Record<string, number> = {
        starter: 1,
        standard: 2,
        pro: 3,
        agency: 20,
      };
      const PLAN_MAX_APPS: Record<string, number> = {
        starter: 1,
        standard: 1,
        pro: 2,
        agency: 10,
      };

      await this.activateSubscription(user.id, {
        plan,
        planStatus: "active",
        planStartDate: now,
        planExpiryDate: expiryDate,
        remainingRebuilds: PLAN_REBUILDS[plan] || 1,
        maxAppsAllowed: PLAN_MAX_APPS[plan] || 1,
      });
    }

    const updated: Payment = { ...payment, entitlementsAppliedAt: new Date() };
    this.payments.set(paymentId, updated);
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

  // --- Audit Log methods ---
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const now = new Date();
    const row: AuditLog = {
      id,
      userId: log.userId ?? null,
      action: log.action,
      targetType: log.targetType ?? null,
      targetId: log.targetId ?? null,
      metadata: log.metadata ?? null,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      createdAt: now,
    };
    this.auditLogs.set(id, row);
    return row;
  }

  async listAuditLogs(options?: {
    userId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values());
    if (options?.userId) logs = logs.filter(l => l.userId === options.userId);
    if (options?.action) logs = logs.filter(l => l.action === options.action);
    if (options?.targetType) logs = logs.filter(l => l.targetType === options.targetType);
    if (options?.targetId) logs = logs.filter(l => l.targetId === options.targetId);
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return logs.slice(offset, offset + limit);
  }

  async countAuditLogs(options?: { userId?: string; action?: string; targetType?: string; }): Promise<number> {
    let logs = Array.from(this.auditLogs.values());
    if (options?.userId) logs = logs.filter(l => l.userId === options.userId);
    if (options?.action) logs = logs.filter(l => l.action === options.action);
    if (options?.targetType) logs = logs.filter(l => l.targetType === options.targetType);
    return logs.length;
  }

  // --- Email verification methods ---
  async setEmailVerifyToken(userId: string, token: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated = { ...user, emailVerifyToken: token, updatedAt: new Date() };
    this.users.set(userId, updated as User);
    return updated as User;
  }

  async getUserByEmailVerifyToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u: any) => u.emailVerifyToken === token);
  }

  async clearEmailVerifyToken(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated = { ...user, emailVerifyToken: null, updatedAt: new Date() };
    this.users.set(userId, updated as User);
    return updated as User;
  }

  // --- Analytics methods ---
  async getAnalytics(): Promise<{
    totalUsers: number;
    totalApps: number;
    totalPayments: number;
    totalRevenue: number;
    usersToday: number;
    usersThisWeek: number;
    usersThisMonth: number;
    appsToday: number;
    appsThisWeek: number;
    appsThisMonth: number;
    paymentsToday: number;
    paymentsThisWeek: number;
    paymentsThisMonth: number;
    revenueToday: number;
    revenueThisWeek: number;
    revenueThisMonth: number;
    usersByDay: Array<{ date: string; count: number }>;
    revenueByDay: Array<{ date: string; amount: number }>;
    appsByPlan: Array<{ plan: string; count: number }>;
    buildSuccessRate: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const users = Array.from(this.users.values());
    const apps = Array.from(this.apps.values());
    const payments = Array.from(this.payments.values()).filter(
      (p) => p.status === "completed" && Number((p as any).amountPaise || 0) > 0,
    );
    const builds = Array.from(this.buildJobs.values());

    const totalRevenue = payments.reduce((sum, p) => sum + Number((p as any).amountPaise || 0) / 100, 0);
    const usersToday = users.filter(u => u.createdAt >= today).length;
    const usersThisWeek = users.filter(u => u.createdAt >= weekAgo).length;
    const usersThisMonth = users.filter(u => u.createdAt >= monthAgo).length;
    const appsToday = apps.filter(a => a.createdAt >= today).length;
    const appsThisWeek = apps.filter(a => a.createdAt >= weekAgo).length;
    const appsThisMonth = apps.filter(a => a.createdAt >= monthAgo).length;
    const paymentsToday = payments.filter(p => p.createdAt >= today).length;
    const paymentsThisWeek = payments.filter(p => p.createdAt >= weekAgo).length;
    const paymentsThisMonth = payments.filter(p => p.createdAt >= monthAgo).length;
    const revenueToday = payments.filter(p => p.createdAt >= today).reduce((sum, p) => sum + Number((p as any).amountPaise || 0) / 100, 0);
    const revenueThisWeek = payments.filter(p => p.createdAt >= weekAgo).reduce((sum, p) => sum + Number((p as any).amountPaise || 0) / 100, 0);
    const revenueThisMonth = payments.filter(p => p.createdAt >= monthAgo).reduce((sum, p) => sum + Number((p as any).amountPaise || 0) / 100, 0);

    // Users by day (last 30 days)
    const usersByDay: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const count = users.filter(u => u.createdAt >= date && u.createdAt < nextDate).length;
      usersByDay.push({ date: date.toISOString().split('T')[0], count });
    }

    // Revenue by day (last 30 days)
    const revenueByDay: Array<{ date: string; amount: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const amount = payments
        .filter(p => p.createdAt >= date && p.createdAt < nextDate)
        .reduce((sum, p) => sum + Number((p as any).amountPaise || 0) / 100, 0);
      revenueByDay.push({ date: date.toISOString().split('T')[0], amount });
    }

    // Apps by plan
    const planCounts: Record<string, number> = {};
    apps.forEach(a => {
      const plan = a.plan || "none";
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });
    const appsByPlan = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));

    // Build success rate
    const completedBuilds = builds.filter(b => b.status === "succeeded" || b.status === "failed");
    const successfulBuilds = builds.filter(b => b.status === "succeeded");
    const buildSuccessRate = completedBuilds.length > 0 ? (successfulBuilds.length / completedBuilds.length) * 100 : 100;

    return {
      totalUsers: users.length,
      totalApps: apps.length,
      totalPayments: payments.length,
      totalRevenue,
      usersToday,
      usersThisWeek,
      usersThisMonth,
      appsToday,
      appsThisWeek,
      appsThisMonth,
      paymentsToday,
      paymentsThisWeek,
      paymentsThisMonth,
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      usersByDay,
      revenueByDay,
      appsByPlan,
      buildSuccessRate,
    };
  }

  // Account lockout methods
  async incrementFailedLogin(userId: string): Promise<{ attempts: number; lockedUntil: Date | null }> {
    const user = this.users.get(userId);
    if (!user) return { attempts: 0, lockedUntil: null };

    const attempts = ((user as any).failedLoginAttempts || 0) + 1;
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = 15;
    
    let lockedUntil: Date | null = null;
    if (attempts >= MAX_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }

    (user as any).failedLoginAttempts = attempts;
    (user as any).lockedUntil = lockedUntil;
    this.users.set(userId, user);

    return { attempts, lockedUntil };
  }

  async resetFailedLogin(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    (user as any).failedLoginAttempts = 0;
    (user as any).lockedUntil = null;
    this.users.set(userId, user);
  }

  async isAccountLocked(userId: string): Promise<{ locked: boolean; lockedUntil: Date | null }> {
    const user = this.users.get(userId);
    if (!user) return { locked: false, lockedUntil: null };

    const lockedUntil = (user as any).lockedUntil as Date | null;
    if (!lockedUntil) return { locked: false, lockedUntil: null };

    if (new Date() > lockedUntil) {
      // Lock expired, clear it
      (user as any).lockedUntil = null;
      (user as any).failedLoginAttempts = 0;
      this.users.set(userId, user);
      return { locked: false, lockedUntil: null };
    }

    return { locked: true, lockedUntil };
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
