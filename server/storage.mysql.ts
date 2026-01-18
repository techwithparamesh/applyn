import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type {
  App,
  ContactSubmission,
  InsertApp,
  InsertContactSubmission,
  InsertUser,
  User,
} from "@shared/schema";
import { apps, buildJobs, contactSubmissions, users } from "@shared/db.mysql";
import { getMysqlDb } from "./db-mysql";
import type { AppBuildPatch, BuildJob, BuildJobStatus } from "./storage";

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

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();

    await getMysqlDb().insert(users).values({
      id,
      name: user.name ?? null,
      username: user.username,
      password: user.password,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getUser(id))!;
  }

  async listAppsByOwner(ownerId: string): Promise<App[]> {
    const rows = await getMysqlDb()
      .select()
      .from(apps)
      .where(eq(apps.ownerId, ownerId))
      .orderBy(desc(apps.updatedAt));
    return rows as unknown as App[];
  }

  async getApp(id: string): Promise<App | undefined> {
    const rows = await getMysqlDb().select().from(apps).where(eq(apps.id, id)).limit(1);
    return rows[0] as unknown as App;
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
      primaryColor: app.primaryColor ?? "#2563EB",
      platform: app.platform ?? "android",
      status: app.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getApp(id))!;
  }

  async updateApp(id: string, patch: Partial<InsertApp>): Promise<App | undefined> {
    await getMysqlDb()
      .update(apps)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
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

  async enqueueBuildJob(ownerId: string, appId: string): Promise<BuildJob> {
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

    const rows = await getMysqlDb().select().from(buildJobs).where(eq(buildJobs.id, id)).limit(1);
    return rows[0] as unknown as BuildJob;
  }

  async claimNextBuildJob(workerId: string): Promise<BuildJob | null> {
    const rows = await getMysqlDb()
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.status, "queued"))
      .orderBy(buildJobs.createdAt)
      .limit(1);

    const candidate = rows[0] as unknown as BuildJob | undefined;
    if (!candidate) return null;

    const lockToken = `${workerId}:${randomUUID()}`;
    const now = new Date();

    const result = await getMysqlDb()
      .update(buildJobs)
      .set({
        status: "running",
        attempts: sql`${buildJobs.attempts} + 1`,
        lockToken,
        lockedAt: now,
        updatedAt: now,
      })
      .where(and(eq(buildJobs.id, candidate.id), eq(buildJobs.status, "queued")));

    const affected = (result as any)?.rowsAffected ?? (result as any)?.affectedRows ?? 0;
    if (affected !== 1) return null;

    const claimed = await getMysqlDb().select().from(buildJobs).where(eq(buildJobs.id, candidate.id)).limit(1);
    return (claimed[0] as unknown as BuildJob) ?? null;
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
}
