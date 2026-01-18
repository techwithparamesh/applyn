import { mysqlTable, int, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name"),
  username: varchar("username", { length: 200 }).notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const apps = mysqlTable("apps", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  icon: text("icon").notNull().default("🚀"),
  primaryColor: text("primary_color").notNull().default("#2563EB"),
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

export { contactSubmissions } from "./db.contact.mysql";
