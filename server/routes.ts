import type { Express } from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import passport from "passport";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  insertAppSchema,
  insertContactSubmissionSchema,
  insertSupportTicketSchema,
  insertUserSchema,
  supportTicketStatusSchema,
  updateUserSchema,
  insertPushTokenSchema,
  insertPushNotificationSchema,
  type User,
  userRoleSchema,
} from "@shared/schema";
import { storage } from "./storage";
import { hashPassword, sanitizeUser, verifyPassword } from "./auth";
import { sendPasswordResetEmail, isEmailConfigured } from "./email";
import crypto from "crypto";
import {
  isLLMConfigured,
  getLLMProvider,
  analyzeWebsite,
  generateAppNames,
  enhanceAppDescription,
  generatePushNotifications,
  analyzeBuildError,
  supportChat,
  categorizeTicket,
} from "./llm";

function isGoogleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function safeReturnTo(raw: unknown) {
  const s = typeof raw === "string" ? raw : "";
  if (s && s.startsWith("/")) return s;
  return "/dashboard";
}

function safeArtifactsRoot() {
  const root = process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");
  return root;
}

function getAuthedUser(req: any): User | null {
  return (req.user as User | undefined) ?? null;
}

type Role = "admin" | "support" | "user";
function roleOf(user: User | null): Role {
  const raw = (user as any)?.role;
  return raw === "admin" || raw === "support" ? raw : "user";
}

function isStaff(user: User | null) {
  const role = roleOf(user);
  return role === "admin" || role === "support";
}

function requireRole(roles: Role[]) {
  return (req: any, res: any, next: any) => {
    const user = getAuthedUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = roleOf(user);
    if (!roles.includes(role)) return res.status(403).json({ message: "Forbidden" });
    return next();
  };
}

function sanitizeAppForViewer(app: any, viewer: User | null) {
  const role = roleOf(viewer);
  if (role === "admin" || role === "support") return app;

  // End users should never see raw build logs or internal artifact paths.
  const copy = { ...app };
  copy.buildLogs = null;
  copy.artifactPath = null;
  copy.artifactMime = null;
  copy.artifactSize = null;
  if (copy.buildError) {
    copy.buildError = "Build failed. Please contact support.";
  }
  return copy;
}

function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated?.() && req.user) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

// --- Plan-based limits configuration ---
const PLAN_LIMITS: Record<string, { rebuilds: number; rebuildWindowDays: number; pushEnabled: boolean }> = {
  starter: { rebuilds: 0, rebuildWindowDays: 0, pushEnabled: false },
  standard: { rebuilds: 1, rebuildWindowDays: 30, pushEnabled: true },
  pro: { rebuilds: 3, rebuildWindowDays: 90, pushEnabled: true },
};

function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
}

// Helper to get the plan for an app (from the completed payment)
async function getAppPlanInfo(appId: string): Promise<{ plan: string; paidAt: Date | null; limits: typeof PLAN_LIMITS.starter }> {
  const payment = await storage.getCompletedPaymentForApp(appId);
  const plan = payment?.plan || "starter";
  return {
    plan,
    paidAt: payment?.createdAt || null,
    limits: getPlanLimits(plan),
  };
}

// Check if a rebuild is allowed for an app based on plan limits
async function checkRebuildAllowed(appId: string): Promise<{ allowed: boolean; reason?: string; used: number; limit: number }> {
  const { plan, paidAt, limits } = await getAppPlanInfo(appId);
  
  // No payment = no builds allowed (first build happens after payment)
  if (!paidAt) {
    return { allowed: false, reason: "No completed payment found for this app", used: 0, limit: 0 };
  }
  
  // Starter plan = no rebuilds allowed
  if (limits.rebuilds === 0) {
    return { allowed: false, reason: "Starter plan does not include rebuilds. Upgrade to Standard or Pro.", used: 0, limit: 0 };
  }
  
  // Calculate rebuild window
  const windowStart = new Date(paidAt.getTime());
  const windowEnd = new Date(paidAt.getTime() + limits.rebuildWindowDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  
  if (now > windowEnd) {
    return { allowed: false, reason: `Rebuild window expired (${limits.rebuildWindowDays} days from purchase)`, used: 0, limit: limits.rebuilds };
  }
  
  // Count completed builds since payment (first build + rebuilds)
  const completedBuilds = await storage.countCompletedBuildsForApp(appId, paidAt);
  
  // First build is free; rebuilds are counted after that
  // So if completedBuilds >= 1 + limits.rebuilds, they've exhausted their rebuilds
  const rebuildsUsed = Math.max(0, completedBuilds - 1);
  
  if (rebuildsUsed >= limits.rebuilds) {
    return { allowed: false, reason: `Rebuild limit reached (${limits.rebuilds} rebuilds on ${plan} plan)`, used: rebuildsUsed, limit: limits.rebuilds };
  }
  
  return { allowed: true, used: rebuildsUsed, limit: limits.rebuilds };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.get("/api/me", (req, res) => {
    const user = getAuthedUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    return res.json(sanitizeUser(user));
  });

  app.post("/api/contact", contactLimiter, async (req, res, next) => {
    try {
      const payload = insertContactSubmissionSchema.strict().parse(req.body);
      await storage.createContactSubmission(payload);
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // --- Support ticketing (MVP) ---
  app.post("/api/support/tickets", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const payload = insertSupportTicketSchema.parse(req.body);

      // If an app is referenced, ensure the requester owns it (unless staff).
      if (payload.appId) {
        const appItem = await storage.getApp(payload.appId);
        if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
          return res.status(404).json({ message: "App not found" });
        }
      }

      const created = await storage.createSupportTicket(user.id, payload);
      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/support/tickets", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const rows = isStaff(user)
        ? await storage.listSupportTicketsAll()
        : await storage.listSupportTicketsByRequester(user.id);

      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  const updateTicketSchema = z
    .object({
      status: supportTicketStatusSchema,
    })
    .strict();

  app.patch(
    "/api/support/tickets/:id",
    requireAuth,
    async (req, res, next) => {
      try {
        const user = getAuthedUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const payload = updateTicketSchema.parse(req.body);

        const existing = await storage.getSupportTicket(req.params.id);
        if (!existing) return res.status(404).json({ message: "Not found" });

        const staff = isStaff(user);
        if (!staff && existing.requesterId !== user.id) {
          return res.status(404).json({ message: "Not found" });
        }

        const updated = await storage.updateSupportTicketStatus(existing.id, payload.status);
        if (!updated) return res.status(404).json({ message: "Not found" });
        return res.json(updated);
      } catch (err) {
        return next(err);
      }
    },
  );

  const loginSchema = z
    .object({
      username: z.string().min(3).max(200),
      password: z.string().min(8).max(200),
    })
    .strict();

  const loginSchemaWithAlias = z
    .object({
      username: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(8).max(200),
    })
    .strict()
    .transform((v) => ({
      username: (v.username ?? v.email ?? "").trim().toLowerCase(),
      password: v.password,
    }))
    .pipe(loginSchema);

  app.post("/api/auth/register", authLimiter, async (req, res, next) => {
    try {
      const parsed = insertUserSchema.strict().parse(req.body);

      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) {
        return res.status(409).json({ message: "User already exists" });
      }

      const passwordHash = await hashPassword(parsed.password);
      const user = await storage.createUser({
        name: parsed.name,
        username: parsed.username,
        password: passwordHash,
        role: "user",
      });

      (req as any).login(user, (err: any) => {
        if (err) return next(err);
        // Ensure session is saved to MySQL before responding
        (req as any).session.save((saveErr: any) => {
          if (saveErr) return next(saveErr);
          return res.status(201).json(sanitizeUser(user));
        });
      });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/auth/login", authLimiter, (req, res, next) => {
    try {
      const normalized = loginSchemaWithAlias.parse(req.body);
      (req as any).body = normalized;
    } catch {
      return res.status(400).json({ message: "Invalid request" });
    }

    passport.authenticate(
      "local",
      (err: any, user: User | false, info: any) => {
        if (err) return next(err);
        if (!user) {
          return res
            .status(401)
            .json({ message: info?.message || "Unauthorized" });
        }

        (req as any).login(user, (loginErr: any) => {
          if (loginErr) return next(loginErr);
          // Ensure session is saved to MySQL before responding
          (req as any).session.save((saveErr: any) => {
            if (saveErr) return next(saveErr);
            return res.json(sanitizeUser(user));
          });
        });
      },
    )(req, res, next);
  });

  // --- Google OAuth (optional) ---
  app.get("/api/auth/google", (req, res, next) => {
    if (!isGoogleConfigured()) {
      return res.redirect("/login?error=google_not_configured");
    }

    const returnTo = safeReturnTo(req.query.returnTo);
    const state = encodeURIComponent(returnTo);

    return passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
      state,
    })(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/login?error=google_failed",
    }),
    (req, res) => {
      const returnTo = safeReturnTo(
        typeof req.query.state === "string" ? decodeURIComponent(req.query.state) : "/dashboard",
      );
      return res.redirect(returnTo);
    },
  );

  app.post("/api/auth/logout", requireAuth, (req, res, next) => {
    const logout = (req as any).logout as
      | undefined
      | ((cb: (err?: any) => void) => void);
    if (!logout) return res.json({ ok: true });

    logout.call(req, (err?: any) => {
      if (err) return next(err);

      const sess = (req as any).session;
      if (!sess?.destroy) return res.json({ ok: true });

      sess.destroy((destroyErr: any) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("connect.sid");
        return res.json({ ok: true });
      });
    });
  });

  app.get("/api/apps", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const rows = isStaff(user)
        ? await storage.listAppsAll()
        : await storage.listAppsByOwner(user.id);
      return res.json(rows.map((a: any) => sanitizeAppForViewer(a, user)));
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/apps/:id", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      return res.json(sanitizeAppForViewer(appItem as any, user));
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      // Clients must not be able to set server-owned states like "live" / "failed".
      // Accept a simple buildNow flag instead.
      const createSchema = insertAppSchema.extend({
        buildNow: z.boolean().optional().default(true),
      });

      const parsed = createSchema.parse(req.body);
      const { buildNow, ...payload } = parsed;

      const created = await storage.createApp(user.id, {
        ...payload,
        status: buildNow ? "processing" : "draft",
      });

      // If the app is meant to be built immediately, enqueue a build job.
      // This avoids apps being stuck in "processing" with no job.
      if ((created.status as any) === "processing") {
        await storage.enqueueBuildJob(user.id, created.id);
      }

      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  });

  const updateAppSchema = insertAppSchema.omit({ status: true }).partial().strict();
  app.patch("/api/apps/:id", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      const patch = updateAppSchema.parse(req.body);
      const updated = await storage.updateApp(req.params.id, patch);
      return res.json(updated ? sanitizeAppForViewer(updated as any, user) : updated);
    } catch (err) {
      return next(err);
    }
  });

  app.delete("/api/apps/:id", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      await storage.deleteApp(req.params.id);
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/build", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      // --- Enforce plan-based rebuild limits (staff bypass) ---
      if (!isStaff(user)) {
        const rebuildCheck = await checkRebuildAllowed(appItem.id);
        if (!rebuildCheck.allowed) {
          return res.status(403).json({
            message: rebuildCheck.reason,
            rebuildsUsed: rebuildCheck.used,
            rebuildsLimit: rebuildCheck.limit,
          });
        }
      }

      await storage.updateAppBuild(appItem.id, { status: "processing", buildError: null });
      const job = await storage.enqueueBuildJob(appItem.ownerId, appItem.id);
      return res.status(202).json({ ok: true, jobId: job.id });
    } catch (err) {
      return next(err);
    }
  });

  // Get build status and logs for an app (staff only for detailed logs)
  app.get("/api/apps/:id/build-status", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      // Get the latest build job for this app
      const jobs = await storage.listBuildJobsForApp(appItem.id);
      const latestJob = jobs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      return res.json({
        appStatus: appItem.status,
        buildLogs: isStaff(user) ? appItem.buildLogs : null,
        buildError: appItem.buildError,
        lastBuildAt: appItem.lastBuildAt,
        job: latestJob ? {
          id: latestJob.id,
          status: latestJob.status,
          attempts: latestJob.attempts,
          error: isStaff(user) ? latestJob.error : null,
          createdAt: latestJob.createdAt,
        } : null,
      });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/apps/:id/download", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      if (appItem.status !== "live" || !appItem.artifactPath) {
        return res.status(409).json({ message: "Artifact not ready" });
      }

      const root = safeArtifactsRoot();
      const abs = path.resolve(root, appItem.artifactPath);
      if (!abs.startsWith(path.resolve(root))) {
        return res.status(400).json({ message: "Invalid artifact path" });
      }

      if (!fs.existsSync(abs)) {
        return res.status(404).json({ message: "Artifact missing" });
      }

      res.setHeader("Content-Type", appItem.artifactMime || "application/vnd.android.package-archive");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${(appItem.name || "app").replace(/[^a-z0-9\-_. ]/gi, "").trim() || "app"}.apk"`,
      );
      return fs.createReadStream(abs).pipe(res);
    } catch (err) {
      return next(err);
    }
  });

  // --- Admin: Team management (MVP) ---
  const adminCreateTeamMemberSchema = z
    .object({
      email: z.string().email().max(320).transform((s) => s.trim().toLowerCase()),
      role: userRoleSchema,
    })
    .strict();

  app.get(
    "/api/admin/team-members",
    requireAuth,
    requireRole(["admin"]),
    async (_req, res, next) => {
      try {
        const rows = await storage.listUsers();
        return res.json(rows);
      } catch (err) {
        return next(err);
      }
    },
  );

  app.post(
    "/api/admin/team-members",
    requireAuth,
    requireRole(["admin"]),
    async (req, res, next) => {
      try {
        const payload = adminCreateTeamMemberSchema.parse(req.body);
        if (payload.role === "user") {
          return res.status(400).json({ message: "Team member role must be admin or support" });
        }

        const existing = await storage.getUserByUsername(payload.email);
        if (existing) {
          return res.status(409).json({ message: "User already exists" });
        }

        // MVP: create with a random temporary password (admin shares it out-of-band).
        const tempPassword = `Temp-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
        const passwordHash = await hashPassword(tempPassword);

        const user = await storage.createUser({
          username: payload.email,
          password: passwordHash,
          role: payload.role,
        });

        return res.status(201).json({ user: sanitizeUser(user), tempPassword });
      } catch (err) {
        return next(err);
      }
    },
  );

  // --- Profile management ---
  app.patch("/api/me", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const payload = updateUserSchema.parse(req.body);
      const updates: Partial<{ name: string; password: string }> = {};

      if (payload.name !== undefined) {
        updates.name = payload.name;
      }

      if (payload.newPassword) {
        if (!payload.currentPassword) {
          return res.status(400).json({ message: "Current password required" });
        }
        const ok = await verifyPassword(payload.currentPassword, user.password);
        if (!ok) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
        updates.password = await hashPassword(payload.newPassword);
      }

      if (Object.keys(updates).length === 0) {
        return res.json(sanitizeUser(user));
      }

      const updated = await storage.updateUser(user.id, updates);
      return res.json(sanitizeUser(updated!));
    } catch (err) {
      return next(err);
    }
  });

  // --- Forgot password flow ---
  const forgotPasswordSchema = z.object({
    email: z.string().email().max(320).transform((s) => s.trim().toLowerCase()),
  }).strict();

  app.post("/api/auth/forgot-password", authLimiter, async (req, res, next) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const user = await storage.getUserByUsername(email);

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.setResetToken(user.id, token, expiresAt);

      // Build reset URL and send email
      const resetUrl = `${process.env.APP_URL || "http://localhost:5004"}/reset-password?token=${token}`;
      
      // Send email (falls back to console log if SMTP not configured)
      const emailSent = await sendPasswordResetEmail(email, resetUrl);
      if (!emailSent && isEmailConfigured()) {
        console.error(`[PASSWORD RESET] Failed to send email to ${email}`);
      }

      return res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
    } catch (err) {
      return next(err);
    }
  });

  const resetPasswordSchema = z.object({
    token: z.string().min(32).max(128),
    password: z.string().min(8).max(200),
  }).strict();

  app.post("/api/auth/reset-password", authLimiter, async (req, res, next) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);

      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token is expired
      const expiresAt = (user as any).resetTokenExpiresAt;
      if (!expiresAt || new Date(expiresAt) < new Date()) {
        await storage.clearResetToken(user.id);
        return res.status(400).json({ message: "Reset token has expired" });
      }

      // Update password and clear token
      const passwordHash = await hashPassword(password);
      await storage.updateUser(user.id, { password: passwordHash });
      await storage.clearResetToken(user.id);

      return res.json({ ok: true, message: "Password has been reset successfully" });
    } catch (err) {
      return next(err);
    }
  });

  // --- Razorpay Payment Integration ---
  const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

  function isRazorpayConfigured() {
    return !!(razorpayKeyId && razorpayKeySecret);
  }

  // Plan pricing (in paise)
  const PLAN_PRICES: Record<string, number> = {
    starter: 49900,    // ₹499 - Android only
    standard: 149900,  // ₹1,499 - Android + iOS
    pro: 299900,       // ₹2,999 - Full package with App Store ready
  };

  const createOrderSchema = z.object({
    plan: z.enum(["starter", "standard", "pro"]),
    appId: z.string().uuid().optional().nullable(),
  }).strict();

  app.post("/api/payments/create-order", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: "Payment gateway not configured" });
      }

      const { plan, appId } = createOrderSchema.parse(req.body);
      const amountInPaise = PLAN_PRICES[plan];
      if (!amountInPaise) {
        return res.status(400).json({ message: "Invalid plan" });
      }

      // Create Razorpay order via API
      const orderPayload = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `app_${appId || "new"}_${Date.now()}`,
        notes: {
          userId: user.id,
          plan,
          appId: appId || "",
        },
      };

      const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (!rzpRes.ok) {
        const errText = await rzpRes.text();
        console.error("Razorpay order creation failed:", errText);
        return res.status(502).json({ message: "Payment gateway error" });
      }

      const rzpOrder = (await rzpRes.json()) as { id: string; amount: number; currency: string };

      // Save payment record
      const payment = await storage.createPayment(user.id, {
        appId: appId || null,
        provider: "razorpay",
        providerOrderId: rzpOrder.id,
        amountInr: amountInPaise / 100,
        plan,
      });

      return res.json({
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: razorpayKeyId,
        paymentId: payment.id,
        plan,
      });
    } catch (err) {
      return next(err);
    }
  });

  // --- Admin Payment Bypass ---
  // Allows admin users to create apps without payment
  const adminBypassSchema = z.object({
    plan: z.enum(["starter", "standard", "pro"]),
    appId: z.string().uuid(),
  }).strict();

  app.post("/api/payments/admin-bypass", requireAuth, requireRole(["admin"]), async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { plan, appId } = adminBypassSchema.parse(req.body);

      // Create a completed payment record with 0 amount for admin
      const payment = await storage.createPayment(user.id, {
        appId,
        provider: "razorpay",
        providerOrderId: `admin_bypass_${Date.now()}`,
        amountInr: 0,
        plan,
      });

      // Mark as completed immediately
      await storage.updatePaymentStatus(payment.id, "completed", `admin_${user.id}_${Date.now()}`);

      return res.json({ ok: true, payment, message: "Admin bypass - payment skipped" });
    } catch (err) {
      return next(err);
    }
  });

  const verifyPaymentSchema = z.object({
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string(),
    paymentId: z.string().uuid(),
  }).strict();

  app.post("/api/payments/verify", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: "Payment gateway not configured" });
      }

      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } =
        verifyPaymentSchema.parse(req.body);

      // Verify payment belongs to this user
      const existingPayment = await storage.getPayment(paymentId);
      if (!existingPayment) {
        return res.status(404).json({ message: "Payment record not found" });
      }
      if (existingPayment.userId !== user.id) {
        console.log(`[Payment Verify] User ${user.id} tried to verify payment ${paymentId} owned by ${existingPayment.userId}`);
        return res.status(403).json({ message: "Forbidden" });
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac("sha256", razorpayKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        await storage.updatePaymentStatus(paymentId, "failed");
        return res.status(400).json({ message: "Payment verification failed" });
      }

      // Update payment status
      const payment = await storage.updatePaymentStatus(paymentId, "completed", razorpay_payment_id);
      if (!payment) {
        return res.status(404).json({ message: "Payment record not found" });
      }

      return res.json({ ok: true, payment });
    } catch (err) {
      return next(err);
    }
  });

  // List user's payments (for billing page)
  app.get("/api/payments", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const payments = await storage.listPaymentsByUser(user.id);
      return res.json(payments);
    } catch (err) {
      return next(err);
    }
  });

  // Check payment status for an app
  app.get("/api/payments/check/:appId", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const payments = await storage.listPaymentsByUser(user.id);
      const appPayment = payments.find(
        (p) => p.appId === req.params.appId && p.status === "completed"
      );

      return res.json({ paid: !!appPayment, payment: appPayment || null });
    } catch (err) {
      return next(err);
    }
  });

  // Get plan limits and usage for an app (for frontend display)
  app.get("/api/apps/:id/plan", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const { plan, paidAt, limits } = await getAppPlanInfo(appItem.id);
      const rebuildCheck = paidAt ? await checkRebuildAllowed(appItem.id) : { allowed: false, used: 0, limit: 0 };
      
      // Calculate window expiry
      let windowExpiresAt: Date | null = null;
      if (paidAt && limits.rebuildWindowDays > 0) {
        windowExpiresAt = new Date(paidAt.getTime() + limits.rebuildWindowDays * 24 * 60 * 60 * 1000);
      }

      return res.json({
        plan,
        paidAt,
        limits,
        rebuilds: {
          used: rebuildCheck.used,
          limit: rebuildCheck.limit,
          remaining: Math.max(0, rebuildCheck.limit - rebuildCheck.used),
          allowed: rebuildCheck.allowed,
          windowExpiresAt,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  // --- Push Notifications ---
  
  // Register a device token (called from the mobile app)
  // Requires X-API-Secret header matching the app's apiSecret
  app.post("/api/push/register", async (req, res, next) => {
    try {
      const payload = insertPushTokenSchema.parse(req.body);
      
      // Check if app exists
      const appItem = await storage.getApp(payload.appId);
      if (!appItem) {
        return res.status(404).json({ message: "App not found" });
      }

      // Validate API secret (if app has one configured)
      const apiSecret = req.headers["x-api-secret"] as string | undefined;
      if ((appItem as any).apiSecret && apiSecret !== (appItem as any).apiSecret) {
        return res.status(401).json({ message: "Invalid API secret" });
      }

      // Check if token already exists for this app
      const existing = await storage.getPushTokenByToken(payload.token);
      if (existing && existing.appId === payload.appId) {
        return res.json({ ok: true, tokenId: existing.id, message: "Token already registered" });
      }

      const token = await storage.createPushToken(payload);
      return res.status(201).json({ ok: true, tokenId: token.id });
    } catch (err) {
      return next(err);
    }
  });

  // Unregister a device token
  app.delete("/api/push/unregister/:token", async (req, res, next) => {
    try {
      const existing = await storage.getPushTokenByToken(req.params.token);
      if (!existing) {
        return res.json({ ok: true, message: "Token not found" });
      }

      await storage.deletePushToken(existing.id);
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // Get push tokens for an app (app owner only)
  app.get("/api/apps/:id/push/tokens", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      // --- Enforce plan-based push access (staff bypass) ---
      if (!isStaff(user)) {
        const { limits } = await getAppPlanInfo(appItem.id);
        if (!limits.pushEnabled) {
          return res.status(403).json({ message: "Push notifications are not available on Starter plan. Upgrade to Standard or Pro." });
        }
      }

      const tokens = await storage.listPushTokensByApp(req.params.id);
      return res.json({ count: tokens.length, tokens });
    } catch (err) {
      return next(err);
    }
  });

  // Send a push notification (app owner only)
  app.post("/api/apps/:id/push/send", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      // --- Enforce plan-based push access (staff bypass) ---
      if (!isStaff(user)) {
        const { limits } = await getAppPlanInfo(appItem.id);
        if (!limits.pushEnabled) {
          return res.status(403).json({ message: "Push notifications are not available on Starter plan. Upgrade to Standard or Pro." });
        }
      }

      const payload = insertPushNotificationSchema.omit({ appId: true }).parse(req.body);
      
      // Create the notification record
      const notification = await storage.createPushNotification({
        ...payload,
        appId: req.params.id,
      });

      // Get all tokens for this app
      const tokens = await storage.listPushTokensByApp(req.params.id);
      
      if (tokens.length === 0) {
        await storage.updatePushNotificationStatus(notification.id, "sent", 0, 0);
        return res.json({ 
          ok: true, 
          notificationId: notification.id, 
          message: "No devices registered",
          sentCount: 0,
          failedCount: 0,
        });
      }

      // Send notifications via OneSignal or similar service
      // For MVP: We'll use a simple fetch to OneSignal API
      const onesignalAppId = (process.env.ONESIGNAL_APP_ID || "").trim();
      const onesignalApiKey = (process.env.ONESIGNAL_API_KEY || "").trim();

      if (!onesignalAppId || !onesignalApiKey) {
        // OneSignal not configured - mark as sent but log warning
        console.warn("[PUSH] OneSignal not configured. Notification saved but not delivered.");
        await storage.updatePushNotificationStatus(notification.id, "sent", 0, tokens.length);
        return res.json({
          ok: true,
          notificationId: notification.id,
          message: "Push service not configured. Notification queued.",
          sentCount: 0,
          failedCount: tokens.length,
        });
      }

      // Send via OneSignal
      try {
        const onesignalPayload = {
          app_id: onesignalAppId,
          include_player_ids: tokens.map((t) => t.token),
          headings: { en: notification.title },
          contents: { en: notification.body },
          ...(notification.imageUrl && { big_picture: notification.imageUrl }),
          ...(notification.actionUrl && { url: notification.actionUrl }),
        };

        const onesignalRes = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${onesignalApiKey}`,
          },
          body: JSON.stringify(onesignalPayload),
        });

        const onesignalResult = await onesignalRes.json() as any;
        
        if (onesignalRes.ok) {
          const sentCount = onesignalResult.recipients || tokens.length;
          await storage.updatePushNotificationStatus(notification.id, "sent", sentCount, 0);
          return res.json({
            ok: true,
            notificationId: notification.id,
            sentCount,
            failedCount: 0,
          });
        } else {
          console.error("[PUSH] OneSignal error:", onesignalResult);
          await storage.updatePushNotificationStatus(notification.id, "failed", 0, tokens.length);
          return res.status(502).json({
            ok: false,
            notificationId: notification.id,
            message: "Failed to send notifications",
            error: onesignalResult.errors?.[0] || "Unknown error",
          });
        }
      } catch (pushErr: any) {
        console.error("[PUSH] Send error:", pushErr);
        await storage.updatePushNotificationStatus(notification.id, "failed", 0, tokens.length);
        return res.status(502).json({
          ok: false,
          notificationId: notification.id,
          message: "Failed to send notifications",
        });
      }
    } catch (err) {
      return next(err);
    }
  });

  // Get notification history for an app
  app.get("/api/apps/:id/push/history", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const notifications = await storage.listPushNotificationsByApp(req.params.id);
      return res.json(notifications);
    } catch (err) {
      return next(err);
    }
  });

  // --- iOS Build Callback (from GitHub Actions) ---
  const iosBuildCallbackSchema = z.object({
    appId: z.string().uuid(),
    status: z.enum(["success", "failure", "cancelled"]),
    artifactUrl: z.string().url().optional(),
    runId: z.string().optional(),
    error: z.string().optional(),
  });

  const iosCallbackSecret = process.env.IOS_CALLBACK_SECRET || "";
  
  // Import iOS artifact download helper
  const { downloadIOSArtifact } = await import("./build/github-ios");

  app.post("/api/ios-build-callback", async (req, res, next) => {
    try {
      // Verify callback authentication
      const authHeader = req.headers.authorization;
      if (!iosCallbackSecret || authHeader !== `Bearer ${iosCallbackSecret}`) {
        console.log("[iOS Callback] Unauthorized callback attempt");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const payload = iosBuildCallbackSchema.parse(req.body);
      
      const appItem = await storage.getApp(payload.appId);
      if (!appItem) {
        return res.status(404).json({ message: "App not found" });
      }

      if (payload.status === "success") {
        // iOS build succeeded - download artifact locally
        let localArtifactPath: string | null = null;
        let artifactSize: number | null = null;
        
        if (payload.runId) {
          try {
            const root = safeArtifactsRoot();
            const zipFileName = `${appItem.id}-ios-artifact.zip`; // GitHub artifacts come as zip
            const zipPath = path.join(root, zipFileName);
            
            console.log(`[iOS Callback] Downloading artifact from run ${payload.runId}...`);
            const downloaded = await downloadIOSArtifact(payload.runId, zipPath);
            
            if (downloaded && fs.existsSync(zipPath)) {
              // Extract IPA from the zip file
              try {
                const AdmZip = (await import('adm-zip')).default;
                const zip = new AdmZip(zipPath);
                const zipEntries = zip.getEntries();
                
                // Find the IPA file inside the zip
                const ipaEntry = zipEntries.find(e => e.entryName.endsWith('.ipa'));
                if (ipaEntry) {
                  const ipaFileName = `${appItem.id}-ios.ipa`;
                  const ipaPath = path.join(root, ipaFileName);
                  zip.extractEntryTo(ipaEntry, root, false, true, false, ipaFileName);
                  
                  if (fs.existsSync(ipaPath)) {
                    localArtifactPath = ipaFileName;
                    artifactSize = fs.statSync(ipaPath).size;
                    console.log(`[iOS Callback] IPA extracted: ${ipaPath} (${artifactSize} bytes)`);
                    // Clean up the zip file
                    fs.unlinkSync(zipPath);
                  } else {
                    console.log(`[iOS Callback] IPA extraction failed, keeping zip`);
                    localArtifactPath = zipFileName;
                    artifactSize = fs.statSync(zipPath).size;
                  }
                } else {
                  // No IPA found, keep the zip
                  console.log(`[iOS Callback] No IPA in artifact, keeping zip`);
                  localArtifactPath = zipFileName;
                  artifactSize = fs.statSync(zipPath).size;
                }
              } catch (extractErr) {
                console.error(`[iOS Callback] Error extracting IPA:`, extractErr);
                localArtifactPath = zipFileName;
                artifactSize = fs.statSync(zipPath).size;
              }
            } else {
              console.log(`[iOS Callback] Failed to download artifact, storing URL instead`);
              localArtifactPath = payload.artifactUrl || null;
            }
          } catch (err) {
            console.error(`[iOS Callback] Error downloading artifact:`, err);
            localArtifactPath = payload.artifactUrl || null;
          }
        }
        
        await storage.updateAppBuild(appItem.id, {
          status: "live",
          buildError: null,
          buildLogs: `iOS build completed successfully.\nRun ID: ${payload.runId || 'N/A'}`,
          lastBuildAt: new Date(),
          artifactPath: localArtifactPath,
          artifactMime: localArtifactPath?.endsWith('.ipa') ? "application/octet-stream" : "application/zip",
          artifactSize,
        });
        
        console.log(`[iOS Callback] Build succeeded for app ${payload.appId}`);
      } else {
        // iOS build failed
        await storage.updateAppBuild(appItem.id, {
          status: "failed",
          buildError: payload.error || `iOS build ${payload.status}`,
          buildLogs: `iOS build ${payload.status}.\nRun ID: ${payload.runId || 'N/A'}\nError: ${payload.error || 'Unknown'}`,
          lastBuildAt: new Date(),
        });
        
        console.log(`[iOS Callback] Build failed for app ${payload.appId}: ${payload.error}`);
      }

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // Download iOS artifact (serve local file or redirect)
  app.get("/api/apps/:id/download-ios", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      const platform = (appItem as any).platform;
      if (platform !== "ios" && platform !== "both") {
        return res.status(400).json({ message: "This app is not configured for iOS" });
      }

      if (appItem.status !== "live" || !appItem.artifactPath) {
        return res.status(409).json({ message: "iOS build not ready" });
      }

      const artifactPath = appItem.artifactPath;
      
      // Check if it's a local file or external URL
      if (artifactPath.startsWith("http")) {
        // Fallback: redirect to GitHub (shouldn't happen normally)
        return res.redirect(artifactPath);
      }
      
      // Serve local file
      const root = safeArtifactsRoot();
      const abs = path.resolve(root, artifactPath);
      if (!abs.startsWith(path.resolve(root))) {
        return res.status(400).json({ message: "Invalid artifact path" });
      }

      if (!fs.existsSync(abs)) {
        return res.status(404).json({ message: "iOS artifact file missing" });
      }

      const safeName = (appItem.name || "app").replace(/[^a-z0-9\-_. ]/gi, "").trim() || "app";
      const isIPA = artifactPath.endsWith('.ipa');
      res.setHeader("Content-Type", isIPA ? "application/octet-stream" : "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}${isIPA ? '.ipa' : '-ios.zip'}"`);
      return fs.createReadStream(abs).pipe(res);
    } catch (err) {
      return next(err);
    }
  });

  // ==========================================
  // LLM-Powered Features
  // ==========================================

  // Rate limiter for AI endpoints (more restrictive)
  const aiRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { message: "Too many AI requests, please slow down" },
  });

  // Check if LLM is configured and which provider
  app.get("/api/ai/status", (req, res) => {
    res.json({ 
      available: isLLMConfigured(),
      provider: getLLMProvider(), // "openai" or "claude"
    });
  });

  // 1. Website Analyzer - Analyze a website for app conversion
  app.post("/api/ai/analyze-website", aiRateLimit, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        url: z.string().url(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid URL" });
      }

      const { url } = parsed.data;

      // Fetch the website HTML
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Applyn/1.0; +https://applyn.io)',
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          return res.status(400).json({ message: `Could not fetch website: ${response.status}` });
        }

        const html = await response.text();
        const analysis = await analyzeWebsite(url, html);
        return res.json(analysis);
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          return res.status(408).json({ message: "Website took too long to respond" });
        }
        return res.status(400).json({ message: "Could not access website" });
      }
    } catch (err) {
      return next(err);
    }
  });

  // 2. App Name Generator
  app.post("/api/ai/generate-names", aiRateLimit, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        websiteUrl: z.string(),
        description: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const suggestions = await generateAppNames(parsed.data.websiteUrl, parsed.data.description || "");
      return res.json(suggestions);
    } catch (err) {
      return next(err);
    }
  });

  // 3. App Description Enhancer
  app.post("/api/ai/enhance-description", aiRateLimit, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        description: z.string().min(1).max(500),
        appName: z.string().min(1).max(50),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const enhanced = await enhanceAppDescription(parsed.data.description, parsed.data.appName);
      return res.json(enhanced);
    } catch (err) {
      return next(err);
    }
  });

  // 4. Push Notification Generator (requires auth)
  app.post("/api/ai/generate-notifications", requireAuth, aiRateLimit, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        appName: z.string().min(1),
        appDescription: z.string().optional(),
        context: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const suggestions = await generatePushNotifications(
        parsed.data.appName,
        parsed.data.appDescription || "",
        parsed.data.context
      );
      return res.json(suggestions);
    } catch (err) {
      return next(err);
    }
  });

  // 5. Build Error Analyzer (for apps with failed builds)
  app.get("/api/ai/analyze-error/:appId", requireAuth, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const user = getAuthedUser(req);
      const appItem = await storage.getApp(req.params.appId);
      
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user?.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      if (appItem.status !== "failed" || !appItem.buildError) {
        return res.status(400).json({ message: "No build error to analyze" });
      }

      const analysis = await analyzeBuildError(
        appItem.buildLogs || appItem.buildError || "Unknown error",
        { name: appItem.name, websiteUrl: appItem.url }
      );
      return res.json(analysis);
    } catch (err) {
      return next(err);
    }
  });

  // 6. Support Chatbot
  app.post("/api/ai/chat", aiRateLimit, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        message: z.string().min(1).max(1000),
        history: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const response = await supportChat(parsed.data.message, parsed.data.history || []);
      return res.json(response);
    } catch (err) {
      return next(err);
    }
  });

  // 7. Ticket Categorization (for staff when viewing tickets)
  app.post("/api/ai/categorize-ticket", requireRole(["admin", "support"]), async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        subject: z.string(),
        message: z.string(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const categorization = await categorizeTicket(parsed.data.subject, parsed.data.message);
      return res.json(categorization);
    } catch (err) {
      return next(err);
    }
  });

  return httpServer;

}
