import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
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
import { apps, buildJobs, contactSubmissions, supportTickets, users, payments, pushTokens, pushNotifications } from "@shared/db.mysql";
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

  async createUser(user: InsertUser & { role?: UserRole; googleId?: string | null }): Promise<User> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(users).values({
      id,
      name: user.name ?? null,
      username: user.username,
      googleId: user.googleId ?? null,
      role: user.role ?? "user",
      password: user.password,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getUser(id))!;
  }

  async updateUser(id: string, patch: Partial<{ name: string; password: string; role?: string }>): Promise<User | undefined> {
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
      features: apps.features,
      packageName: apps.packageName,
      versionCode: apps.versionCode,
      artifactPath: apps.artifactPath,
      artifactMime: apps.artifactMime,
      artifactSize: apps.artifactSize,
      buildLogs: apps.buildLogs,
      buildError: apps.buildError,
      lastBuildAt: apps.lastBuildAt,
      createdAt: apps.createdAt,
      updatedAt: apps.updatedAt,
    };
  }

  // Parse features JSON from database row
  private parseAppRow(row: any): App {
    return {
      ...row,
      features: row.features ? JSON.parse(row.features) : null,
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
      features: app.features ? JSON.stringify(app.features) : null,
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

    await getMysqlDb().insert(payments).values({
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

  async updatePaymentStatus(id: string, status: PaymentStatus, providerPaymentId?: string | null): Promise<Payment | undefined> {
    const existing = await this.getPayment(id);
    if (!existing) return undefined;

    await getMysqlDb()
      .update(payments)
      .set({
        status,
        providerPaymentId: providerPaymentId ?? existing.providerPaymentId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id));

    return await this.getPayment(id);
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
}
