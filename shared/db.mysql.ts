import { mysqlTable, int, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name"),
  username: varchar("username", { length: 200 }).notNull().unique(),
  role: varchar("role", { length: 16 }).notNull().default("user"),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const apps = mysqlTable("apps", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  // MySQL does not allow DEFAULT values for TEXT/BLOB on many versions.
  // Keep these as VARCHAR to match the manual VPS schema.
  icon: varchar("icon", { length: 32 }).notNull().default("🚀"),
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
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

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
});

export const supportTickets = mysqlTable("support_tickets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  requesterId: varchar("requester_id", { length: 36 }).notNull(),
  appId: varchar("app_id", { length: 36 }),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("open"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export { contactSubmissions } from "./db.contact.mysql";
