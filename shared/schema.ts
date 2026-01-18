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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = {
  id: string;
  name: string | null;
  username: string;
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
