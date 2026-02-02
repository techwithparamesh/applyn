import { and, desc, eq, sql, gte, lt, between, count } from "drizzle-orm";
import { randomUUID } from "crypto";
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
import { apps, buildJobs, contactSubmissions, supportTickets, ticketMessages, users, payments, pushTokens, pushNotifications, auditLogs } from "@shared/db.mysql";
import { getMysqlDb } from "./db-mysql";
import type { AppBuildPatch, BuildJob, BuildJobStatus } from "./storage";

function maxBuildAttempts() {
  return Number(process.env.MAX_BUILD_ATTEMPTS || 3);
}

function jobLockTtlMs() {
  return Number(process.env.BUILD_JOB_LOCK_TTL_MS || 30 * 60 * 1000);
}

export class MysqlStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = await getMysqlDb().select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] as unknown as User;
  }

  async setUserPermissions(id: string, permissions: string[] | null): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        permissions: permissions ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    return await this.getUser(id);
  }

  async getAllUsers(): Promise<User[]> {
    const rows = await getMysqlDb().select().from(users);
    return rows as unknown as User[];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await getMysqlDb()
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return rows[0] as unknown as User;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const rows = await getMysqlDb()
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);
    return rows[0] as unknown as User;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const rows = await getMysqlDb()
      .select()
      .from(users)
      .where(eq(users.resetToken, token))
      .limit(1);
    return rows[0] as unknown as User;
  }

  async createUser(user: InsertUser & { role?: UserRole; googleId?: string | null; mustChangePassword?: boolean }): Promise<User> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(users).values({
      id,
      name: user.name ?? null,
      username: user.username,
      googleId: user.googleId ?? null,
      role: user.role ?? "user",
      permissions: [],
      password: user.password,
      mustChangePassword: user.mustChangePassword ?? false,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getUser(id))!;
  }

  async updateUser(id: string, patch: Partial<{ name: string; password: string; role?: string; mustChangePassword?: boolean }>): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    return await this.getUser(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    // First delete related data (apps, tickets, etc.)
    // For safety, we'll soft-delete or just delete the user
    // Related data will remain orphaned but that's acceptable for MVP
    const result = await getMysqlDb()
      .delete(users)
      .where(eq(users.id, id));
    return (result[0]?.affectedRows ?? 0) > 0;
  }

  async setResetToken(userId: string, token: string, expiresAt: Date): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  async clearResetToken(userId: string): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  async setEmailVerified(userId: string, verified: boolean): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        emailVerified: verified,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  async setUserPlayRefreshTokenEnc(userId: string, tokenEnc: string | null): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        playRefreshTokenEnc: tokenEnc,
        playConnectedAt: tokenEnc ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================

  /**
   * Activate or renew a user's subscription
   */
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
    const updateData: any = {
      plan: data.plan,
      planStatus: data.planStatus,
      planStartDate: data.planStartDate,
      planExpiryDate: data.planExpiryDate,
      remainingRebuilds: data.remainingRebuilds,
      subscriptionId: data.subscriptionId ?? null,
      updatedAt: new Date(),
    };
    
    // Only update maxAppsAllowed and maxTeamMembers if provided
    if (data.maxAppsAllowed !== undefined) {
      updateData.maxAppsAllowed = data.maxAppsAllowed;
    }
    if (data.maxTeamMembers !== undefined) {
      updateData.maxTeamMembers = data.maxTeamMembers;
    }
    
    await getMysqlDb()
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  /**
   * Update subscription status (for expiry or cancellation)
   */
  async updateSubscriptionStatus(userId: string, status: string): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        planStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  /**
   * Decrement remaining rebuilds
   */
  async decrementRebuilds(userId: string): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        remainingRebuilds: sql`GREATEST(0, remaining_rebuilds - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  /**
   * Add extra rebuilds (for purchased rebuilds)
   */
  async addRebuilds(userId: string, count: number): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        remainingRebuilds: sql`remaining_rebuilds + ${count}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  /**
   * Add extra app slots (for purchased slots)
   */
  async addExtraAppSlot(userId: string, count: number): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        extraAppSlots: sql`COALESCE(extra_app_slots, 0) + ${count}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  /**
   * Get users with expiring subscriptions (for renewal reminders)
   */
  async getUsersWithExpiringSubscriptions(daysUntilExpiry: number): Promise<User[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysUntilExpiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const rows = await getMysqlDb()
      .select()
      .from(users)
      .where(
        and(
          eq(users.planStatus, "active"),
          sql`plan_expiry_date > ${today}`,
          sql`plan_expiry_date <= ${futureDate}`
        )
      );
    return rows as unknown as User[];
  }

  /**
   * Get users with expired subscriptions (for status update)
   */
  async getUsersWithExpiredSubscriptions(): Promise<User[]> {
    const now = new Date();
    
    const rows = await getMysqlDb()
      .select()
      .from(users)
      .where(
        and(
          eq(users.planStatus, "active"),
          sql`plan_expiry_date < ${now}`
        )
      );
    return rows as unknown as User[];
  }

  /**
   * Bulk update expired subscriptions
   */
  async expireSubscriptions(): Promise<number> {
    const now = new Date();
    
    const result = await getMysqlDb()
      .update(users)
      .set({
        planStatus: "expired",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.planStatus, "active"),
          sql`plan_expiry_date < ${now}`
        )
      );
    
    return (result as any)?.rowsAffected ?? (result as any)?.affectedRows ?? 0;
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        googleId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  async listUsers(): Promise<Array<Omit<User, "password">>> {
    const rows = await getMysqlDb().select().from(users).orderBy(desc(users.createdAt));
    return (rows as unknown as User[]).map(({ password: _pw, ...rest }) => rest);
  }

  // Helper to get app columns (avoiding api_secret which may not exist in older schemas)
  private getAppColumns() {
    return {
      id: apps.id,
      ownerId: apps.ownerId,
      name: apps.name,
      url: apps.url,
      icon: apps.icon,
      iconUrl: apps.iconUrl,
      iconColor: apps.iconColor,
      primaryColor: apps.primaryColor,
      platform: apps.platform,
      status: apps.status,
      plan: apps.plan,
      industry: (apps as any).industry,
      isNativeOnly: (apps as any).isNativeOnly,
      generatedPrompt: (apps as any).generatedPrompt,
      generatedScreens: (apps as any).generatedScreens,
      editorScreens: (apps as any).editorScreens,
      modules: (apps as any).modules,
      navigation: (apps as any).navigation,
      editorScreensHistory: (apps as any).editorScreensHistory,
      features: apps.features,
      packageName: apps.packageName,
      versionCode: apps.versionCode,
      artifactPath: apps.artifactPath,
      artifactMime: apps.artifactMime,
      artifactSize: apps.artifactSize,
      buildLogs: apps.buildLogs,
      buildError: apps.buildError,
      lastBuildAt: apps.lastBuildAt,
      apiSecret: apps.apiSecret,
      createdAt: apps.createdAt,
      updatedAt: apps.updatedAt,
    };
  }

  // Parse features JSON from database row
  private parseAppRow(row: any): App {
    return {
      ...row,
      features: row.features ? JSON.parse(row.features) : null,
      generatedScreens: row.generatedScreens ? (typeof row.generatedScreens === "string" ? JSON.parse(row.generatedScreens) : row.generatedScreens) : null,
      editorScreens: row.editorScreens ? (typeof row.editorScreens === "string" ? JSON.parse(row.editorScreens) : row.editorScreens) : null,
      modules: row.modules ? (typeof row.modules === "string" ? JSON.parse(row.modules) : row.modules) : null,
      navigation: row.navigation ? (typeof row.navigation === "string" ? JSON.parse(row.navigation) : row.navigation) : null,
      editorScreensHistory: row.editorScreensHistory ? (typeof row.editorScreensHistory === "string" ? JSON.parse(row.editorScreensHistory) : row.editorScreensHistory) : null,
      isNativeOnly: row.isNativeOnly === 1 || row.isNativeOnly === true,
    } as App;
  }

  async listAppsByOwner(ownerId: string): Promise<App[]> {
    const rows = await getMysqlDb()
      .select(this.getAppColumns())
      .from(apps)
      .where(eq(apps.ownerId, ownerId))
      .orderBy(desc(apps.updatedAt));
    return rows.map(row => this.parseAppRow(row));
  }

  async listAppsAll(): Promise<App[]> {
    const rows = await getMysqlDb().select(this.getAppColumns()).from(apps).orderBy(desc(apps.updatedAt));
    return rows.map(row => this.parseAppRow(row));
  }

  async getApp(id: string): Promise<App | undefined> {
    const rows = await getMysqlDb()
      .select(this.getAppColumns())
      .from(apps)
      .where(eq(apps.id, id))
      .limit(1);
    return rows[0] ? this.parseAppRow(rows[0]) : undefined;
  }

  async createApp(ownerId: string, app: InsertApp): Promise<App> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(apps).values({
      id,
      ownerId,
      name: app.name,
      url: app.url,
      icon: app.icon ?? "🚀",
      iconUrl: app.iconUrl ?? null,
      iconColor: app.iconColor ?? null,
      primaryColor: app.primaryColor ?? "#2563EB",
      platform: app.platform ?? "android",
      status: app.status ?? "draft",
      plan: (app as any).plan ?? null,
      industry: (app as any).industry ?? null,
      isNativeOnly: (app as any).isNativeOnly ? 1 : 0,
      generatedPrompt: (app as any).generatedPrompt ?? null,
      generatedScreens: (app as any).generatedScreens ? JSON.stringify((app as any).generatedScreens) : null,
      editorScreens: (app as any).editorScreens ? JSON.stringify((app as any).editorScreens) : null,
      modules: (app as any).modules ? JSON.stringify((app as any).modules) : null,
      navigation: (app as any).navigation ? JSON.stringify((app as any).navigation) : null,
      editorScreensHistory: (app as any).editorScreensHistory ? JSON.stringify((app as any).editorScreensHistory) : null,
      features: app.features ? JSON.stringify(app.features) : null,
      playPublishingMode: (app as any).playPublishingMode ?? "central",
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getApp(id))!;
  }

  async updateApp(id: string, patch: Partial<InsertApp>): Promise<App | undefined> {
    // Handle features field - convert object to JSON string for MySQL
    const patchData: any = {
      ...patch,
      updatedAt: new Date(),
    };
    if (patch.features && typeof patch.features === 'object') {
      patchData.features = JSON.stringify(patch.features);
    }
    if ((patch as any).generatedScreens && Array.isArray((patch as any).generatedScreens)) {
      patchData.generatedScreens = JSON.stringify((patch as any).generatedScreens);
    }
    if ((patch as any).editorScreens && Array.isArray((patch as any).editorScreens)) {
      // Append previous screens to history for easy restore
      const current = await this.getApp(id);
      if (current?.editorScreens) {
        const history = Array.isArray((current as any).editorScreensHistory)
          ? ([...(current as any).editorScreensHistory] as any[])
          : ([] as any[]);

        history.unshift({
          ts: new Date().toISOString(),
          editorScreens: current.editorScreens,
        });

        // Keep last 10 snapshots
        patchData.editorScreensHistory = JSON.stringify(history.slice(0, 10));
      }

      patchData.editorScreens = JSON.stringify((patch as any).editorScreens);
    }
    if ((patch as any).modules && Array.isArray((patch as any).modules)) {
      patchData.modules = JSON.stringify((patch as any).modules);
    }
    if ((patch as any).navigation && typeof (patch as any).navigation === "object") {
      patchData.navigation = JSON.stringify((patch as any).navigation);
    }
    if ((patch as any).editorScreensHistory && Array.isArray((patch as any).editorScreensHistory)) {
      patchData.editorScreensHistory = JSON.stringify((patch as any).editorScreensHistory);
    }
    if (typeof (patch as any).isNativeOnly === "boolean") {
      patchData.isNativeOnly = (patch as any).isNativeOnly ? 1 : 0;
    }
    
    await getMysqlDb()
      .update(apps)
      .set(patchData)
      .where(eq(apps.id, id));

    return await this.getApp(id);
  }

  async updateAppBuild(id: string, patch: AppBuildPatch): Promise<App | undefined> {
    await getMysqlDb()
      .update(apps)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(apps.id, id));

    return await this.getApp(id);
  }

  async deleteApp(id: string): Promise<boolean> {
    const result = await getMysqlDb().delete(apps).where(eq(apps.id, id));
    const affected = (result as any)?.rowsAffected ?? (result as any)?.affectedRows ?? 0;
    return affected > 0;
  }

  async createContactSubmission(
    payload: InsertContactSubmission,
  ): Promise<ContactSubmission> {
    const id = randomUUID();
    const createdAt = new Date();

    await getMysqlDb().insert(contactSubmissions).values({
      id,
      ...payload,
      createdAt,
    });

    return {
      id,
      createdAt,
      ...payload,
    };
  }

  async createSupportTicket(requesterId: string, payload: InsertSupportTicket): Promise<SupportTicket> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(supportTickets).values({
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
    });

    const rows = await getMysqlDb().select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return rows[0] as unknown as SupportTicket;
  }

  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    const rows = await getMysqlDb().select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return rows[0] as unknown as SupportTicket | undefined;
  }

  async listSupportTicketsByRequester(requesterId: string): Promise<SupportTicket[]> {
    const rows = await getMysqlDb()
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.requesterId, requesterId))
      .orderBy(desc(supportTickets.updatedAt));
    return rows as unknown as SupportTicket[];
  }

  async listSupportTicketsAll(): Promise<SupportTicket[]> {
    const rows = await getMysqlDb().select().from(supportTickets).orderBy(desc(supportTickets.updatedAt));
    return rows as unknown as SupportTicket[];
  }

  async listSupportTicketsByAssignee(assigneeId: string): Promise<SupportTicket[]> {
    const rows = await getMysqlDb()
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.assignedTo, assigneeId))
      .orderBy(desc(supportTickets.updatedAt));
    return rows as unknown as SupportTicket[];
  }

  async updateSupportTicketStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | undefined> {
    await getMysqlDb()
      .update(supportTickets)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id));

    const rows = await getMysqlDb().select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return rows[0] as unknown as SupportTicket | undefined;
  }

  async assignSupportTicket(id: string, assigneeId: string | null): Promise<SupportTicket | undefined> {
    await getMysqlDb()
      .update(supportTickets)
      .set({
        assignedTo: assigneeId,
        status: assigneeId ? "in_progress" : "open",
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id));

    const rows = await getMysqlDb().select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return rows[0] as unknown as SupportTicket | undefined;
  }

  async resolveTicket(id: string, resolutionNotes: string): Promise<SupportTicket | undefined> {
    const now = new Date();
    await getMysqlDb()
      .update(supportTickets)
      .set({
        status: "resolved",
        resolutionNotes,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(supportTickets.id, id));

    const rows = await getMysqlDb().select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return rows[0] as unknown as SupportTicket | undefined;
  }

  async closeTicket(id: string): Promise<SupportTicket | undefined> {
    const now = new Date();
    await getMysqlDb()
      .update(supportTickets)
      .set({
        status: "closed",
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(supportTickets.id, id));

    const rows = await getMysqlDb().select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return rows[0] as unknown as SupportTicket | undefined;
  }

  async reopenTicket(id: string): Promise<SupportTicket | undefined> {
    await getMysqlDb()
      .update(supportTickets)
      .set({
        status: "open",
        resolvedAt: null,
        closedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id));

    const rows = await getMysqlDb().select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return rows[0] as unknown as SupportTicket | undefined;
  }

  async updateTicketPriority(id: string, priority: string): Promise<SupportTicket | undefined> {
    await getMysqlDb()
      .update(supportTickets)
      .set({
        priority,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id));

    const rows = await getMysqlDb().select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return rows[0] as unknown as SupportTicket | undefined;
  }

  async getTicketStats(): Promise<{ open: number; inProgress: number; waitingUser: number; resolved: number; closed: number }> {
    const result = await getMysqlDb()
      .select({
        status: supportTickets.status,
        count: sql<number>`count(*)`,
      })
      .from(supportTickets)
      .groupBy(supportTickets.status);
    
    const stats = { open: 0, inProgress: 0, waitingUser: 0, resolved: 0, closed: 0 };
    for (const row of result) {
      if (row.status === "open") stats.open = Number(row.count);
      else if (row.status === "in_progress") stats.inProgress = Number(row.count);
      else if (row.status === "waiting_user") stats.waitingUser = Number(row.count);
      else if (row.status === "resolved") stats.resolved = Number(row.count);
      else if (row.status === "closed") stats.closed = Number(row.count);
    }
    return stats;
  }

  async getStaffTicketStats(staffId: string): Promise<{ assigned: number; resolved: number }> {
    const assignedResult = await getMysqlDb()
      .select({ count: sql<number>`count(*)` })
      .from(supportTickets)
      .where(and(
        eq(supportTickets.assignedTo, staffId),
        sql`${supportTickets.status} NOT IN ('closed')`
      ));
    
    const resolvedResult = await getMysqlDb()
      .select({ count: sql<number>`count(*)` })
      .from(supportTickets)
      .where(and(
        eq(supportTickets.assignedTo, staffId),
        sql`${supportTickets.status} IN ('resolved', 'closed')`
      ));

    return {
      assigned: Number(assignedResult[0]?.count || 0),
      resolved: Number(resolvedResult[0]?.count || 0),
    };
  }

  async deleteSupportTicket(id: string): Promise<boolean> {
    const result = await getMysqlDb()
      .delete(supportTickets)
      .where(eq(supportTickets.id, id));
    
    return (result[0] as any).affectedRows > 0;
  }

  // Ticket Messages (conversation thread)
  async createTicketMessage(senderId: string, senderRole: string, payload: InsertTicketMessage): Promise<TicketMessage> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(ticketMessages).values({
      id,
      ticketId: payload.ticketId,
      senderId,
      senderRole,
      message: payload.message,
      isInternal: payload.isInternal ? 1 : 0,
      attachments: null,
      createdAt: now,
    });

    const rows = await getMysqlDb().select().from(ticketMessages).where(eq(ticketMessages.id, id)).limit(1);
    const row = rows[0];
    return {
      ...row,
      isInternal: Boolean(row.isInternal),
    } as unknown as TicketMessage;
  }

  async listTicketMessages(ticketId: string, includeInternal = false): Promise<TicketMessage[]> {
    let query = getMysqlDb()
      .select()
      .from(ticketMessages)
      .where(
        includeInternal 
          ? eq(ticketMessages.ticketId, ticketId)
          : and(eq(ticketMessages.ticketId, ticketId), eq(ticketMessages.isInternal, 0))
      )
      .orderBy(ticketMessages.createdAt);

    const rows = await query;
    return rows.map(row => ({
      ...row,
      isInternal: Boolean(row.isInternal),
    })) as unknown as TicketMessage[];
  }

  async getTicketMessage(id: string): Promise<TicketMessage | undefined> {
    const rows = await getMysqlDb()
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.id, id))
      .limit(1);
    
    if (!rows[0]) return undefined;
    return {
      ...rows[0],
      isInternal: Boolean(rows[0].isInternal),
    } as unknown as TicketMessage;
  }

  async enqueueBuildJob(ownerId: string, appId: string): Promise<BuildJob> {
    // Check if there's already a queued or running job for this app
    const existing = await getMysqlDb()
      .select()
      .from(buildJobs)
      .where(
        and(
          eq(buildJobs.appId, appId),
          sql`${buildJobs.status} IN ('queued', 'running')`
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      console.log(`[Storage] Job already exists for app ${appId}, returning existing job ${existing[0].id}`);
      return existing[0] as unknown as BuildJob;
    }

    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(buildJobs).values({
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
    });

    console.log(`[Storage] Created new build job ${id} for app ${appId}`);
    const rows = await getMysqlDb().select().from(buildJobs).where(eq(buildJobs.id, id)).limit(1);
    return rows[0] as unknown as BuildJob;
  }

  async claimNextBuildJob(workerId: string): Promise<BuildJob | null> {
    const maxAttempts = maxBuildAttempts();
    const staleBefore = new Date(Date.now() - jobLockTtlMs());

    // Prefer queued jobs; reclaim stale running jobs if a worker died mid-build.
    const rows = await getMysqlDb()
      .select()
      .from(buildJobs)
      .where(
        and(
          sql`(${buildJobs.status} = 'queued' OR (${buildJobs.status} = 'running' AND ${buildJobs.lockedAt} < ${staleBefore}))`,
          sql`${buildJobs.attempts} < ${maxAttempts}`,
        ),
      )
      .orderBy(buildJobs.createdAt)
      .limit(1);

    const candidate = rows[0] as unknown as BuildJob | undefined;
    if (!candidate) return null;

    const lockToken = `${workerId}:${randomUUID()}`;
    const now = new Date();

    try {
      const result = await getMysqlDb()
        .update(buildJobs)
        .set({
          status: "running",
          attempts: sql`${buildJobs.attempts} + 1`,
          lockToken,
          lockedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(buildJobs.id, candidate.id),
            sql`(${buildJobs.status} = 'queued' OR (${buildJobs.status} = 'running' AND ${buildJobs.lockedAt} < ${staleBefore}))`,
            sql`${buildJobs.attempts} < ${maxAttempts}`,
          ),
        );

      const affected = (result as any)?.rowsAffected ?? (result as any)?.affectedRows ?? (result as any)?.[0]?.affectedRows ?? 0;
      
      if (affected !== 1) {
        return null;
      }

      const claimed = await getMysqlDb().select().from(buildJobs).where(eq(buildJobs.id, candidate.id)).limit(1);
      return (claimed[0] as unknown as BuildJob) ?? null;
    } catch (err) {
      console.error(`[Storage] Error claiming job:`, err);
      return null;
    }
  }

  async completeBuildJob(
    jobId: string,
    status: Exclude<BuildJobStatus, "queued" | "running">,
    error?: string | null,
  ): Promise<BuildJob | undefined> {
    const now = new Date();
    await getMysqlDb()
      .update(buildJobs)
      .set({
        status,
        error: error ?? null,
        updatedAt: now,
      })
      .where(eq(buildJobs.id, jobId));

    const rows = await getMysqlDb().select().from(buildJobs).where(eq(buildJobs.id, jobId)).limit(1);
    return rows[0] as unknown as BuildJob;
  }

  async listBuildJobsForApp(appId: string): Promise<BuildJob[]> {
    const rows = await getMysqlDb()
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.appId, appId))
      .orderBy(desc(buildJobs.createdAt));
    return rows as unknown as BuildJob[];
  }

  async requeueBuildJob(jobId: string): Promise<BuildJob | undefined> {
    const now = new Date();
    await getMysqlDb()
      .update(buildJobs)
      .set({
        status: "queued",
        lockToken: null,
        lockedAt: null,
        error: null,
        updatedAt: now,
      })
      .where(eq(buildJobs.id, jobId));

    const rows = await getMysqlDb().select().from(buildJobs).where(eq(buildJobs.id, jobId)).limit(1);
    return rows[0] as unknown as BuildJob;
  }

  // --- Payment methods ---
  async createPayment(userId: string, payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const now = new Date();

    const amountPaise = Number((payment as any).amountPaise);
    if (!Number.isFinite(amountPaise) || amountPaise < 0) {
      throw new Error("Invalid payment amountPaise");
    }
    // Keep the legacy integer-rupees column populated for older code/rows.
    const amountInrLegacy = Number.isFinite((payment as any).amountInr)
      ? Number((payment as any).amountInr)
      : Math.floor(amountPaise / 100);

    await getMysqlDb().insert(payments).values({
      id,
      userId,
      appId: payment.appId ?? null,
      provider: payment.provider ?? "razorpay",
      providerOrderId: payment.providerOrderId ?? null,
      providerPaymentId: payment.providerPaymentId ?? null,
      amountPaise: amountPaise as any,
      amountInr: amountInrLegacy,
      plan: payment.plan ?? "starter",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getPayment(id))!;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const rows = await getMysqlDb().select().from(payments).where(eq(payments.id, id)).limit(1);
    return rows[0] as unknown as Payment;
  }

  async getPaymentByOrderId(orderId: string): Promise<Payment | undefined> {
    const rows = await getMysqlDb()
      .select()
      .from(payments)
      .where(eq(payments.providerOrderId, orderId))
      .limit(1);
    return rows[0] as unknown as Payment;
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    providerPaymentId?: string | null,
  ): Promise<{ payment?: Payment; updated: boolean }> {
    // Atomic transition: only mutate pending -> (completed|failed)
    const result = await getMysqlDb()
      .update(payments)
      .set({
        status,
        providerPaymentId: providerPaymentId ?? sql`${payments.providerPaymentId}`,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, id), eq(payments.status, "pending")));

    const affected =
      (result as any)?.rowsAffected ??
      (result as any)?.affectedRows ??
      (result as any)?.[0]?.affectedRows ??
      0;

    // Always return the current row for idempotency.
    const payment = await this.getPayment(id);
    return { payment, updated: Number(affected) > 0 };
  }

  async listPaymentsByUser(userId: string): Promise<Payment[]> {
    const rows = await getMysqlDb()
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
    return rows as unknown as Payment[];
  }

  async getCompletedPaymentForApp(appId: string): Promise<Payment | undefined> {
    const rows = await getMysqlDb()
      .select()
      .from(payments)
      .where(and(eq(payments.appId, appId), eq(payments.status, "completed")))
      .limit(1);
    return rows[0] as unknown as Payment | undefined;
  }

  async countCompletedBuildsForApp(appId: string, sinceDate?: Date): Promise<number> {
    let query = getMysqlDb()
      .select({ count: sql<number>`COUNT(*)` })
      .from(buildJobs)
      .where(
        sinceDate
          ? and(
              eq(buildJobs.appId, appId),
              eq(buildJobs.status, "succeeded"),
              sql`${buildJobs.createdAt} >= ${sinceDate}`
            )
          : and(eq(buildJobs.appId, appId), eq(buildJobs.status, "succeeded"))
      );
    const rows = await query;
    return Number(rows[0]?.count ?? 0);
  }

  // --- Push Notification methods ---
  async createPushToken(token: InsertPushToken): Promise<PushToken> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(pushTokens).values({
      id,
      appId: token.appId,
      token: token.token,
      platform: token.platform ?? "android",
      deviceInfo: token.deviceInfo ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getPushToken(id))!;
  }

  async getPushToken(id: string): Promise<PushToken | undefined> {
    const rows = await getMysqlDb().select().from(pushTokens).where(eq(pushTokens.id, id)).limit(1);
    return rows[0] as unknown as PushToken;
  }

  async getPushTokenByToken(token: string): Promise<PushToken | undefined> {
    const rows = await getMysqlDb()
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, token))
      .limit(1);
    return rows[0] as unknown as PushToken;
  }

  async listPushTokensByApp(appId: string): Promise<PushToken[]> {
    const rows = await getMysqlDb()
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.appId, appId))
      .orderBy(desc(pushTokens.createdAt));
    return rows as unknown as PushToken[];
  }

  async deletePushToken(id: string): Promise<boolean> {
    const result = await getMysqlDb().delete(pushTokens).where(eq(pushTokens.id, id));
    return (result as any).affectedRows > 0;
  }

  async createPushNotification(notification: InsertPushNotification): Promise<PushNotification> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(pushNotifications).values({
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
    });

    return (await this.getPushNotification(id))!;
  }

  async getPushNotification(id: string): Promise<PushNotification | undefined> {
    const rows = await getMysqlDb().select().from(pushNotifications).where(eq(pushNotifications.id, id)).limit(1);
    return rows[0] as unknown as PushNotification;
  }

  async listPushNotificationsByApp(appId: string): Promise<PushNotification[]> {
    const rows = await getMysqlDb()
      .select()
      .from(pushNotifications)
      .where(eq(pushNotifications.appId, appId))
      .orderBy(desc(pushNotifications.createdAt));
    return rows as unknown as PushNotification[];
  }

  async updatePushNotificationStatus(
    id: string,
    status: PushStatus,
    sentCount?: number,
    failedCount?: number
  ): Promise<PushNotification | undefined> {
    const existing = await this.getPushNotification(id);
    if (!existing) return undefined;

    await getMysqlDb()
      .update(pushNotifications)
      .set({
        status,
        sentCount: sentCount ?? existing.sentCount,
        failedCount: failedCount ?? existing.failedCount,
        sentAt: status === "sent" ? new Date() : existing.sentAt,
        updatedAt: new Date(),
      })
      .where(eq(pushNotifications.id, id));

    return await this.getPushNotification(id);
  }

  // ============================================
  // AUDIT LOG METHODS
  // ============================================

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(auditLogs).values({
      id,
      userId: log.userId ?? null,
      action: log.action,
      targetType: log.targetType ?? null,
      targetId: log.targetId ?? null,
      metadata: log.metadata ? JSON.stringify(log.metadata) : null,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      createdAt: now,
    });

    const rows = await getMysqlDb().select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
    const row = rows[0];
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    } as AuditLog;
  }

  async listAuditLogs(options?: {
    userId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const conditions = [];
    if (options?.userId) conditions.push(eq(auditLogs.userId, options.userId));
    if (options?.action) conditions.push(eq(auditLogs.action, options.action));
    if (options?.targetType) conditions.push(eq(auditLogs.targetType, options.targetType));
    if (options?.targetId) conditions.push(eq(auditLogs.targetId, options.targetId));

    const query = getMysqlDb()
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);

    const rows = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;

    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    })) as AuditLog[];
  }

  async countAuditLogs(options?: { userId?: string; action?: string; targetType?: string; }): Promise<number> {
    const conditions = [];
    if (options?.userId) conditions.push(eq(auditLogs.userId, options.userId));
    if (options?.action) conditions.push(eq(auditLogs.action, options.action));
    if (options?.targetType) conditions.push(eq(auditLogs.targetType, options.targetType));

    const query = getMysqlDb()
      .select({ count: count() })
      .from(auditLogs);

    const result = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;

    return result[0]?.count ?? 0;
  }

  // ============================================
  // EMAIL VERIFICATION METHODS
  // ============================================

  async setEmailVerifyToken(userId: string, token: string): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        emailVerifyToken: token,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  async getUserByEmailVerifyToken(token: string): Promise<User | undefined> {
    const rows = await getMysqlDb()
      .select()
      .from(users)
      .where(eq(users.emailVerifyToken, token))
      .limit(1);
    return rows[0] as unknown as User;
  }

  async clearEmailVerifyToken(userId: string): Promise<User | undefined> {
    await getMysqlDb()
      .update(users)
      .set({
        emailVerifyToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return await this.getUser(userId);
  }

  // ============================================
  // ANALYTICS METHODS
  // ============================================

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
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total counts
    const [totalUsersRes] = await getMysqlDb().select({ count: count() }).from(users);
    const [totalAppsRes] = await getMysqlDb().select({ count: count() }).from(apps);
    const amountPaiseExpr = sql<number>`COALESCE(${payments.amountPaise}, ${payments.amountInr} * 100)`;
    const [totalPaymentsRes] = await getMysqlDb()
      .select({ count: count() })
      .from(payments)
      .where(and(eq(payments.status, "completed"), sql`${amountPaiseExpr} > 0`));
    const [totalRevenueRes] = await getMysqlDb()
      .select({ total: sql<number>`COALESCE(SUM(${amountPaiseExpr}), 0) / 100` })
      .from(payments)
      .where(and(eq(payments.status, "completed"), sql`${amountPaiseExpr} > 0`));

    // Users by period
    const [usersTodayRes] = await getMysqlDb().select({ count: count() }).from(users).where(gte(users.createdAt, today));
    const [usersWeekRes] = await getMysqlDb().select({ count: count() }).from(users).where(gte(users.createdAt, weekAgo));
    const [usersMonthRes] = await getMysqlDb().select({ count: count() }).from(users).where(gte(users.createdAt, monthAgo));

    // Apps by period
    const [appsTodayRes] = await getMysqlDb().select({ count: count() }).from(apps).where(gte(apps.createdAt, today));
    const [appsWeekRes] = await getMysqlDb().select({ count: count() }).from(apps).where(gte(apps.createdAt, weekAgo));
    const [appsMonthRes] = await getMysqlDb().select({ count: count() }).from(apps).where(gte(apps.createdAt, monthAgo));

    // Payments by period
    const paymentConditions = and(eq(payments.status, "completed"), sql`${amountPaiseExpr} > 0`);
    const [paymentsTodayRes] = await getMysqlDb().select({ count: count() }).from(payments).where(and(paymentConditions, gte(payments.createdAt, today)));
    const [paymentsWeekRes] = await getMysqlDb().select({ count: count() }).from(payments).where(and(paymentConditions, gte(payments.createdAt, weekAgo)));
    const [paymentsMonthRes] = await getMysqlDb().select({ count: count() }).from(payments).where(and(paymentConditions, gte(payments.createdAt, monthAgo)));

    // Revenue by period
    const [revenueTodayRes] = await getMysqlDb().select({ total: sql<number>`COALESCE(SUM(${amountPaiseExpr}), 0) / 100` }).from(payments).where(and(paymentConditions, gte(payments.createdAt, today)));
    const [revenueWeekRes] = await getMysqlDb().select({ total: sql<number>`COALESCE(SUM(${amountPaiseExpr}), 0) / 100` }).from(payments).where(and(paymentConditions, gte(payments.createdAt, weekAgo)));
    const [revenueMonthRes] = await getMysqlDb().select({ total: sql<number>`COALESCE(SUM(${amountPaiseExpr}), 0) / 100` }).from(payments).where(and(paymentConditions, gte(payments.createdAt, monthAgo)));

    // Users by day (last 30 days)
    const usersByDayRes = await getMysqlDb()
      .select({
        date: sql<string>`DATE(${users.createdAt})`,
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);

    // Fill in missing days
    const usersByDayMap = new Map(usersByDayRes.map(r => [r.date, r.count]));
    const usersByDay: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      usersByDay.push({ date: dateStr, count: usersByDayMap.get(dateStr) ?? 0 });
    }

    // Revenue by day (last 30 days)
    const revenueByDayRes = await getMysqlDb()
      .select({
        date: sql<string>`DATE(${payments.createdAt})`,
        amount: sql<number>`COALESCE(SUM(${amountPaiseExpr}), 0) / 100`,
      })
      .from(payments)
      .where(and(paymentConditions, gte(payments.createdAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${payments.createdAt})`)
      .orderBy(sql`DATE(${payments.createdAt})`);

    const revenueByDayMap = new Map(revenueByDayRes.map(r => [r.date, Number(r.amount)]));
    const revenueByDay: Array<{ date: string; amount: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      revenueByDay.push({ date: dateStr, amount: revenueByDayMap.get(dateStr) ?? 0 });
    }

    // Apps by plan
    const appsByPlanRes = await getMysqlDb()
      .select({
        plan: sql<string>`COALESCE(${apps.plan}, 'none')`,
        count: count(),
      })
      .from(apps)
      .groupBy(apps.plan);
    const appsByPlan = appsByPlanRes.map(r => ({ plan: r.plan || 'none', count: r.count }));

    // Build success rate
    const [completedBuildsRes] = await getMysqlDb()
      .select({ count: count() })
      .from(buildJobs)
      .where(sql`${buildJobs.status} IN ('succeeded', 'failed')`);
    const [successfulBuildsRes] = await getMysqlDb()
      .select({ count: count() })
      .from(buildJobs)
      .where(eq(buildJobs.status, "succeeded"));
    const buildSuccessRate = completedBuildsRes.count > 0 
      ? (successfulBuildsRes.count / completedBuildsRes.count) * 100 
      : 100;

    return {
      totalUsers: totalUsersRes.count,
      totalApps: totalAppsRes.count,
      totalPayments: totalPaymentsRes.count,
      totalRevenue: Number(totalRevenueRes.total) || 0,
      usersToday: usersTodayRes.count,
      usersThisWeek: usersWeekRes.count,
      usersThisMonth: usersMonthRes.count,
      appsToday: appsTodayRes.count,
      appsThisWeek: appsWeekRes.count,
      appsThisMonth: appsMonthRes.count,
      paymentsToday: paymentsTodayRes.count,
      paymentsThisWeek: paymentsWeekRes.count,
      paymentsThisMonth: paymentsMonthRes.count,
      revenueToday: Number(revenueTodayRes.total) || 0,
      revenueThisWeek: Number(revenueWeekRes.total) || 0,
      revenueThisMonth: Number(revenueMonthRes.total) || 0,
      usersByDay,
      revenueByDay,
      appsByPlan,
      buildSuccessRate,
    };
  }

  // Account lockout methods
  async incrementFailedLogin(userId: string): Promise<{ attempts: number; lockedUntil: Date | null }> {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = 15;

    const [user] = await getMysqlDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return { attempts: 0, lockedUntil: null };

    const attempts = ((user as any).failedLoginAttempts || 0) + 1;
    let lockedUntil: Date | null = null;

    if (attempts >= MAX_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }

    await getMysqlDb()
      .update(users)
      .set({
        failedLoginAttempts: attempts,
        lockedUntil: lockedUntil,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, userId));

    return { attempts, lockedUntil };
  }

  async resetFailedLogin(userId: string): Promise<void> {
    await getMysqlDb()
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, userId));
  }

  async isAccountLocked(userId: string): Promise<{ locked: boolean; lockedUntil: Date | null }> {
    const [user] = await getMysqlDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return { locked: false, lockedUntil: null };

    const lockedUntil = (user as any).lockedUntil as Date | null;
    if (!lockedUntil) return { locked: false, lockedUntil: null };

    if (new Date() > lockedUntil) {
      // Lock expired, clear it
      await this.resetFailedLogin(userId);
      return { locked: false, lockedUntil: null };
    }

    return { locked: true, lockedUntil };
  }
}
