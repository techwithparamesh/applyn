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
} from "@shared/schema";
import { randomUUID } from "crypto";
import { MysqlStorage } from "./storage.mysql";

export type BuildJobStatus = "queued" | "running" | "succeeded" | "failed";

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
  createUser(user: InsertUser & { role?: UserRole }): Promise<User>;

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
  updateAppBuild(id: string, patch: AppBuildPatch): Promise<App | undefined>;

  createContactSubmission(payload: InsertContactSubmission): Promise<ContactSubmission>;

  // Support ticketing (MVP)
  createSupportTicket(requesterId: string, payload: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTicket(id: string): Promise<SupportTicket | undefined>;
  listSupportTicketsByRequester(requesterId: string): Promise<SupportTicket[]>;
  listSupportTicketsAll(): Promise<SupportTicket[]>;
  updateSupportTicketStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private apps: Map<string, App>;
  private contacts: Map<string, ContactSubmission>;
  private tickets: Map<string, SupportTicket>;
  private buildJobs: Map<string, BuildJob>;

  constructor() {
    this.users = new Map();
    this.apps = new Map();
    this.contacts = new Map();
    this.tickets = new Map();
    this.buildJobs = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser & { role?: UserRole }): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      id,
      name: insertUser.name ?? null,
      username: insertUser.username,
      role: insertUser.role ?? "user",
      password: insertUser.password,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
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
      primaryColor: insertApp.primaryColor ?? "#2563EB",
      platform: insertApp.platform ?? "android",
      status: insertApp.status ?? "draft",
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
    const queued = Array.from(this.buildJobs.values())
      .filter((j) => j.status === "queued")
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))[0];
    if (!queued) return null;

    const lockToken = `${workerId}:${randomUUID()}`;
    const updated: BuildJob = {
      ...queued,
      status: "running",
      attempts: queued.attempts + 1,
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
