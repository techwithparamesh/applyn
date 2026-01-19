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
import crypto from "crypto";

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
        return res.status(201).json(sanitizeUser(user));
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
          return res.json(sanitizeUser(user));
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

      await storage.updateAppBuild(appItem.id, { status: "processing", buildError: null });
      const job = await storage.enqueueBuildJob(appItem.ownerId, appItem.id);
      return res.status(202).json({ ok: true, jobId: job.id });
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

      // In production, send email via nodemailer/resend/etc.
      // For MVP, log to console (you can replace this with actual email sending)
      const resetUrl = `${process.env.APP_URL || "http://localhost:5000"}/reset-password?token=${token}`;
      console.log(`[PASSWORD RESET] Email: ${email}, URL: ${resetUrl}`);

      // TODO: Integrate with email service (Resend, SendGrid, etc.)
      // await sendEmail({ to: email, subject: "Reset your password", html: `<a href="${resetUrl}">Reset Password</a>` });

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
    starter: 49900,   // ₹499
    standard: 99900,  // ₹999
    pro: 249900,      // ₹2499
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

  // --- Push Notifications ---
  
  // Register a device token (called from the mobile app)
  app.post("/api/push/register", async (req, res, next) => {
    try {
      const payload = insertPushTokenSchema.parse(req.body);
      
      // Check if app exists
      const appItem = await storage.getApp(payload.appId);
      if (!appItem) {
        return res.status(404).json({ message: "App not found" });
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

  return httpServer;

}
