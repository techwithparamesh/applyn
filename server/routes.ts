import type { Express } from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import passport from "passport";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import { z } from "zod";
import {
  insertAppSchema,
  insertContactSubmissionSchema,
  insertSupportTicketSchema,
  insertUserSchema,
  supportTicketStatusSchema,
  supportTicketPrioritySchema,
  updateUserSchema,
  insertPushTokenSchema,
  insertPushNotificationSchema,
  type User,
  userRoleSchema,
} from "@shared/schema";
import { getPlan, PLANS, type PlanId } from "@shared/pricing";
import { storage } from "./storage";
import { hashPassword, sanitizeUser, verifyPassword } from "./auth";
import { sendPasswordResetEmail, isEmailConfigured, sendTeamMemberWelcomeEmail, sendEmailVerificationEmail, sendBuildCompleteEmail, sendAccountLockedEmail } from "./email";
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
import {
  validatePlayStoreReadiness,
  validateAppStoreReadiness,
  canDownloadAab,
  canSubmitToPlayStore,
  canDownloadIpa,
  canSubmitToAppStore,
} from "./build-validation";

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

// --- Plan-based limits configuration (UPDATED PRICING) ---
// Starter: Preview only, NO Play Store
// Standard: Play Store ready, NO iOS
// Pro: Both stores ready
const PLAN_LIMITS: Record<string, { 
  rebuilds: number; 
  rebuildWindowDays: number; 
  pushEnabled: boolean;
  playStoreReady: boolean;
  appStoreReady: boolean;
  aabEnabled: boolean;
  iosEnabled: boolean;
}> = {
  starter: { 
    rebuilds: 0, 
    rebuildWindowDays: 0, 
    pushEnabled: false,
    playStoreReady: false,
    appStoreReady: false,
    aabEnabled: false,
    iosEnabled: false,
  },
  standard: { 
    rebuilds: 1, 
    rebuildWindowDays: 30, 
    pushEnabled: true,
    playStoreReady: true,
    appStoreReady: false,
    aabEnabled: true,
    iosEnabled: false,
  },
  pro: { 
    rebuilds: 3, 
    rebuildWindowDays: 90, 
    pushEnabled: true,
    playStoreReady: true,
    appStoreReady: true,
    aabEnabled: true,
    iosEnabled: true,
  },
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

  // --- Subscription Status Endpoint ---
  app.get("/api/subscription", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      // Fetch fresh user data to get subscription info
      const freshUser = await storage.getUser(user.id);
      if (!freshUser) return res.status(404).json({ message: "User not found" });

      const plan = freshUser.plan || null;
      const planStatus = freshUser.planStatus || null;
      const planStartDate = freshUser.planStartDate || null;
      const planExpiryDate = freshUser.planExpiryDate || null;
      const remainingRebuilds = freshUser.remainingRebuilds ?? 0;

      // Calculate days until expiry
      let daysUntilExpiry: number | null = null;
      if (planExpiryDate) {
        const now = new Date();
        const expiry = new Date(planExpiryDate);
        daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Get plan details
      const planDetails = plan ? getPlan(plan as any) : null;
      
      // Get app count for limit info
      const userApps = await storage.listAppsByOwner(freshUser.id);
      const currentAppsCount = userApps.length;
      const extraAppSlots = freshUser.extraAppSlots ?? 0;
      const maxAppsAllowed = planDetails ? planDetails.maxApps + extraAppSlots : 0;

      return res.json({
        plan,
        planStatus,
        planStartDate,
        planExpiryDate,
        remainingRebuilds,
        daysUntilExpiry,
        // App limits
        currentAppsCount,
        maxAppsAllowed,
        extraAppSlots,
        // Team limits (Agency)
        teamMembers: freshUser.teamMembers ?? 1,
        maxTeamMembers: planDetails?.maxTeamMembers ?? 1,
        planDetails: planDetails ? {
          name: planDetails.name,
          price: planDetails.price,
          monthlyEquivalent: planDetails.monthlyEquivalent,
          rebuildsPerYear: planDetails.rebuildsPerYear,
          maxApps: planDetails.maxApps,
          maxTeamMembers: planDetails.maxTeamMembers,
          features: planDetails.features,
        } : null,
        isActive: planStatus === "active",
        isExpired: planStatus === "expired",
        needsRenewal: daysUntilExpiry !== null && daysUntilExpiry <= 7,
      });
    } catch (err) {
      return next(err);
    }
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

  // ===== ENHANCED TICKET MANAGEMENT (Staff only) =====
  
  // Assign ticket to a staff member
  app.post("/api/support/tickets/:id/assign", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user || !isStaff(user)) return res.status(403).json({ message: "Staff access required" });

      const { assigneeId } = z.object({ assigneeId: z.string().uuid().nullable() }).parse(req.body);
      
      // If assigning to someone, verify they're staff
      if (assigneeId) {
        const assignee = await storage.getUser(assigneeId);
        if (!assignee || !["staff", "admin"].includes(assignee.role)) {
          return res.status(400).json({ message: "Can only assign to staff members" });
        }
      }

      const existing = await storage.getSupportTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });

      const updated = await storage.assignSupportTicket(existing.id, assigneeId);
      
      // Log the assignment
      await storage.createAuditLog({
        userId: user.id,
        action: assigneeId ? "ticket_assigned" : "ticket_unassigned",
        targetType: "ticket",
        targetId: existing.id,
        metadata: JSON.stringify({ 
          assigneeId, 
          previousAssignee: existing.assignedTo,
          ticketSubject: existing.subject 
        }),
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
      });

      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  });

  // Resolve ticket with notes (staff only)
  app.post("/api/support/tickets/:id/resolve", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user || !isStaff(user)) return res.status(403).json({ message: "Staff access required" });

      const { resolutionNotes } = z.object({ 
        resolutionNotes: z.string().min(5).max(5000) 
      }).parse(req.body);

      const existing = await storage.getSupportTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });

      const updated = await storage.resolveTicket(existing.id, resolutionNotes);
      
      await storage.createAuditLog({
        userId: user.id,
        action: "ticket_resolved",
        targetType: "ticket",
        targetId: existing.id,
        metadata: JSON.stringify({ ticketSubject: existing.subject }),
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
      });

      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  });

  // Close ticket (staff or ticket owner)
  app.post("/api/support/tickets/:id/close", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const existing = await storage.getSupportTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });

      // User can close their own ticket if resolved, staff can close any
      const staff = isStaff(user);
      if (!staff && existing.requesterId !== user.id) {
        return res.status(403).json({ message: "Not allowed" });
      }
      
      // Non-staff can only close if already resolved
      if (!staff && existing.status !== "resolved") {
        return res.status(400).json({ message: "Ticket must be resolved first" });
      }

      const updated = await storage.closeTicket(existing.id);
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  });

  // Reopen a closed/resolved ticket
  app.post("/api/support/tickets/:id/reopen", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const existing = await storage.getSupportTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });

      const staff = isStaff(user);
      if (!staff && existing.requesterId !== user.id) {
        return res.status(403).json({ message: "Not allowed" });
      }

      // Can only reopen resolved or closed tickets
      if (!["resolved", "closed"].includes(existing.status)) {
        return res.status(400).json({ message: "Ticket is not closed" });
      }

      const updated = await storage.reopenTicket(existing.id);
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  });

  // Update ticket priority (staff only)
  app.patch("/api/support/tickets/:id/priority", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user || !isStaff(user)) return res.status(403).json({ message: "Staff access required" });

      const { priority } = z.object({ 
        priority: supportTicketPrioritySchema 
      }).parse(req.body);

      const existing = await storage.getSupportTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });

      const updated = await storage.updateTicketPriority(existing.id, priority);
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  });

  // Get my assigned tickets (staff)
  app.get("/api/support/tickets/assigned", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user || !isStaff(user)) return res.status(403).json({ message: "Staff access required" });

      const tickets = await storage.listSupportTicketsByAssignee(user.id);
      return res.json(tickets);
    } catch (err) {
      return next(err);
    }
  });

  // Get ticket statistics (staff/admin)
  app.get("/api/support/stats", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user || !isStaff(user)) return res.status(403).json({ message: "Staff access required" });

      const stats = await storage.getTicketStats();
      const myStats = await storage.getStaffTicketStats(user.id);
      
      return res.json({
        overall: stats,
        mine: myStats,
      });
    } catch (err) {
      return next(err);
    }
  });

  // List all staff members (for assignment dropdown)
  app.get("/api/support/staff", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user || !isStaff(user)) return res.status(403).json({ message: "Staff access required" });

      // Get all users with staff or admin role
      const allUsers = await storage.getAllUsers();
      const staffMembers = allUsers
        .filter(u => ["staff", "admin"].includes(u.role))
        .map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role }));

      return res.json(staffMembers);
    } catch (err) {
      return next(err);
    }
  });

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

      // Generate email verification token and send email
      const verifyToken = crypto.randomBytes(32).toString("hex");
      await storage.setEmailVerifyToken(user.id, verifyToken);
      const appUrl = process.env.APP_URL || "https://applyn.co.in";
      const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;
      sendEmailVerificationEmail(parsed.username, verifyUrl, parsed.name).catch(err => {
        console.error("[Register] Failed to send verification email:", err);
      });

      // Create audit log
      storage.createAuditLog({
        userId: user.id,
        action: "user.register",
        targetType: "user",
        targetId: user.id,
        metadata: { username: parsed.username },
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(err => console.error("[Audit] Failed to log registration:", err));

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

  app.post("/api/auth/login", authLimiter, async (req, res, next) => {
    try {
      const normalized = loginSchemaWithAlias.parse(req.body);
      (req as any).body = normalized;

      // Check if account is locked before attempting login
      const existingUser = await storage.getUserByUsername(normalized.username);
      if (existingUser) {
        const lockStatus = await storage.isAccountLocked(existingUser.id);
        if (lockStatus.locked) {
          const minutesLeft = Math.ceil((lockStatus.lockedUntil!.getTime() - Date.now()) / 60000);
          return res.status(423).json({ 
            message: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
            lockedUntil: lockStatus.lockedUntil,
          });
        }
      }
    } catch {
      return res.status(400).json({ message: "Invalid request" });
    }

    passport.authenticate(
      "local",
      async (err: any, user: User | false, info: any) => {
        if (err) return next(err);
        if (!user) {
          // Track failed login attempt
          const existingUser = await storage.getUserByUsername((req.body as any).username);
          if (existingUser) {
            const result = await storage.incrementFailedLogin(existingUser.id);
            if (result.lockedUntil) {
              // Send email notification about account lock
              sendAccountLockedEmail(existingUser.username, result.lockedUntil).catch(err => 
                console.error("[Auth] Failed to send account locked email:", err)
              );
              return res.status(423).json({ 
                message: "Account temporarily locked due to too many failed login attempts. Check your email for details.",
                lockedUntil: result.lockedUntil,
              });
            }
          }
          return res
            .status(401)
            .json({ message: info?.message || "Unauthorized" });
        }

        // Reset failed login count on successful login
        await storage.resetFailedLogin(user.id);

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

  // Public preview endpoint - no auth required (for QR code sharing)
  app.get("/api/apps/:id/public-preview", async (req, res, next) => {
    try {
      const appItem = await storage.getApp(req.params.id);
      if (!appItem) {
        return res.status(404).json({ message: "App not found" });
      }
      // Return only public-safe data for preview
      return res.json({
        id: appItem.id,
        name: appItem.name,
        url: appItem.url,
        icon: appItem.icon,
        iconUrl: appItem.iconUrl,
        primaryColor: appItem.primaryColor,
        status: appItem.status,
      });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      // --- Enforce app limit based on plan (staff bypass) ---
      if (!isStaff(user)) {
        const { checkUserAppLimit } = await import("./subscription-middleware");
        const userApps = await storage.listAppsByOwner(user.id);
        const appLimitCheck = checkUserAppLimit(user, userApps.length);
        
        if (!appLimitCheck.allowed) {
          return res.status(403).json({
            message: appLimitCheck.reason,
            code: "APP_LIMIT_REACHED",
            currentApps: appLimitCheck.currentCount,
            maxApps: appLimitCheck.maxAllowed,
            canPurchaseSlot: appLimitCheck.canPurchaseSlot,
            plan: appLimitCheck.plan,
          });
        }
      }

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

  // Retry a failed build
  app.post("/api/apps/:id/retry-build", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      // Only allow retry for failed builds
      if (appItem.status !== "failed") {
        return res.status(400).json({ message: "Can only retry failed builds" });
      }

      // Check if there's already a build in progress
      const jobs = await storage.listBuildJobsForApp(appItem.id);
      const activeJob = jobs.find(j => j.status === "queued" || j.status === "running");
      if (activeJob) {
        return res.status(400).json({ message: "A build is already in progress" });
      }

      // Check rebuild limits for paid plans
      const { plan, paidAt } = await getAppPlanInfo(appItem.id);
      if (paidAt) {
        const rebuildCheck = await checkRebuildAllowed(appItem.id);
        if (!rebuildCheck.allowed) {
          return res.status(403).json({ 
            message: `Rebuild limit reached (${rebuildCheck.used}/${rebuildCheck.limit}). Please upgrade your plan or wait for the next billing cycle.`,
            rebuildsUsed: rebuildCheck.used,
            rebuildsLimit: rebuildCheck.limit,
          });
        }
      }

      // Reset app status and enqueue new build
      await storage.updateApp(appItem.id, { 
        status: "processing" as any,
        buildError: null,
      } as any);

      const job = await storage.enqueueBuildJob(user.id, appItem.id);

      // Log the retry action
      storage.createAuditLog({
        userId: user.id,
        action: "app.build.start",
        targetType: "app",
        targetId: appItem.id,
        metadata: { retry: true, jobId: job.id },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(err => console.error("[Audit] Failed to log build retry:", err));

      return res.json({ 
        message: "Build retry queued successfully",
        jobId: job.id,
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
        // Only return staff members (admin + support), NOT regular users
        const staffOnly = rows.filter(u => u.role === "admin" || u.role === "support");
        return res.json(staffOnly);
      } catch (err) {
        return next(err);
      }
    },
  );

  // Get all regular users for admin management (separate from team members)
  app.get(
    "/api/admin/users",
    requireAuth,
    requireRole(["admin", "support"]),
    async (req, res, next) => {
      try {
        const rows = await storage.listUsers();
        // Only return regular users (not staff)
        const regularUsers = rows.filter(u => u.role === "user");
        
        // Get app counts for each user
        const usersWithStats = await Promise.all(
          regularUsers.map(async (user) => {
            const apps = await storage.listAppsByOwner(user.id);
            const tickets = await storage.listSupportTicketsByRequester(user.id);
            return {
              ...user,
              appCount: apps.length,
              ticketCount: tickets.length,
              openTickets: tickets.filter(t => t.status === "open").length,
            };
          })
        );
        
        return res.json(usersWithStats);
      } catch (err) {
        return next(err);
      }
    },
  );

  // Get single user details with their apps and tickets (for admin support)
  app.get(
    "/api/admin/users/:id",
    requireAuth,
    requireRole(["admin", "support"]),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const user = await storage.getUser(id);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const apps = await storage.listAppsByOwner(id);
        const tickets = await storage.listSupportTicketsByRequester(id);
        
        // Don't expose password
        const { password: _pw, ...safeUser } = user;
        
        return res.json({
          user: safeUser,
          apps,
          tickets,
        });
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
        const currentUser = getAuthedUser(req);
        const payload = adminCreateTeamMemberSchema.parse(req.body);
        if (payload.role === "user") {
          return res.status(400).json({ message: "Team member role must be admin or support" });
        }

        const existing = await storage.getUserByUsername(payload.email);
        if (existing) {
          return res.status(409).json({ message: "User already exists" });
        }

        // Generate a secure temporary password
        const tempPassword = `Temp-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
        const passwordHash = await hashPassword(tempPassword);

        // Create user with mustChangePassword flag set to true
        const user = await storage.createUser({
          username: payload.email,
          password: passwordHash,
          role: payload.role,
          mustChangePassword: true, // Force password change on first login
        });

        // Send welcome email with credentials (async, don't block response)
        const invitedBy = currentUser?.username || currentUser?.name || undefined;
        sendTeamMemberWelcomeEmail(payload.email, tempPassword, payload.role as "admin" | "support", invitedBy)
          .then((sent) => {
            if (sent) {
              console.log(`[TEAM] Welcome email sent to ${payload.email}`);
            } else {
              console.warn(`[TEAM] Failed to send welcome email to ${payload.email}`);
            }
          })
          .catch((err) => {
            console.error(`[TEAM] Error sending welcome email:`, err);
          });

        return res.status(201).json({ 
          user: sanitizeUser(user), 
          tempPassword,
          emailSent: isEmailConfigured(), // Let frontend know if email was sent
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  // Delete team member (admin only, cannot delete self)
  app.delete(
    "/api/admin/team-members/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req, res, next) => {
      try {
        const currentUser = getAuthedUser(req);
        if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

        const targetId = req.params.id;
        
        // Prevent self-deletion
        if (targetId === currentUser.id) {
          return res.status(400).json({ message: "You cannot delete your own account" });
        }

        const targetUser = await storage.getUser(targetId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Delete the user
        await storage.deleteUser(targetId);

        return res.json({ ok: true, message: "User deleted successfully" });
      } catch (err) {
        return next(err);
      }
    },
  );

  // Update team member role (admin only)
  app.patch(
    "/api/admin/team-members/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req, res, next) => {
      try {
        const currentUser = getAuthedUser(req);
        if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

        const targetId = req.params.id;
        const { role } = req.body;

        if (!["admin", "support", "user"].includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }

        // Prevent changing own role
        if (targetId === currentUser.id) {
          return res.status(400).json({ message: "You cannot change your own role" });
        }

        const targetUser = await storage.getUser(targetId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Create audit log
        storage.createAuditLog({
          userId: currentUser.id,
          action: "user.role_changed",
          targetType: "user",
          targetId,
          metadata: { oldRole: targetUser.role, newRole: role },
          ipAddress: req.ip || req.socket?.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
        }).catch(err => console.error("[Audit] Failed to log role change:", err));

        const updated = await storage.updateUser(targetId, { role });
        return res.json(sanitizeUser(updated!));
      } catch (err) {
        return next(err);
      }
    },
  );

  // --- Admin Analytics Dashboard ---
  app.get("/api/admin/analytics", requireAuth, requireRole(["admin"]), async (req, res, next) => {
    try {
      const analytics = await storage.getAnalytics();
      return res.json(analytics);
    } catch (err) {
      return next(err);
    }
  });

  // --- Audit Logs ---
  app.get("/api/admin/audit-logs", requireAuth, requireRole(["admin"]), async (req, res, next) => {
    try {
      const { userId, action, targetType, targetId, limit, offset } = req.query;
      const logs = await storage.listAuditLogs({
        userId: userId as string | undefined,
        action: action as string | undefined,
        targetType: targetType as string | undefined,
        targetId: targetId as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
      });
      const total = await storage.countAuditLogs({
        userId: userId as string | undefined,
        action: action as string | undefined,
        targetType: targetType as string | undefined,
      });
      return res.json({ logs, total });
    } catch (err) {
      return next(err);
    }
  });

  // --- Subscription Management (Self-Service) ---
  app.post("/api/subscription/cancel", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const fullUser = await storage.getUser(user.id);
      if (!fullUser || !fullUser.plan || fullUser.planStatus !== "active") {
        return res.status(400).json({ message: "No active subscription to cancel" });
      }

      // Mark subscription as cancelled (it will remain active until expiry)
      await storage.updateSubscriptionStatus(user.id, "cancelled");

      // Create audit log
      storage.createAuditLog({
        userId: user.id,
        action: "subscription.cancelled",
        targetType: "user",
        targetId: user.id,
        metadata: { plan: fullUser.plan, expiresAt: fullUser.planExpiryDate },
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(err => console.error("[Audit] Failed to log subscription cancellation:", err));

      return res.json({ 
        ok: true, 
        message: "Subscription cancelled. You can continue using your plan until " + 
          (fullUser.planExpiryDate ? new Date(fullUser.planExpiryDate).toLocaleDateString() : "the end of your billing period")
      });
    } catch (err) {
      return next(err);
    }
  });

  // Get subscription status
  app.get("/api/subscription/status", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const fullUser = await storage.getUser(user.id);
      if (!fullUser) return res.status(404).json({ message: "User not found" });

      return res.json({
        plan: fullUser.plan || null,
        status: fullUser.planStatus || null,
        startDate: fullUser.planStartDate || null,
        expiryDate: fullUser.planExpiryDate || null,
        remainingRebuilds: fullUser.remainingRebuilds || 0,
        maxAppsAllowed: fullUser.maxAppsAllowed || 1,
        extraAppSlots: fullUser.extraAppSlots || 0,
      });
    } catch (err) {
      return next(err);
    }
  });

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

  // --- Change password (for forced password change on first login) ---
  const changePasswordSchema = z.object({
    currentPassword: z.string().min(8).max(200),
    newPassword: z.string().min(8).max(200),
  }).strict();

  app.post("/api/change-password", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

      // Verify current password
      const ok = await verifyPassword(currentPassword, user.password);
      if (!ok) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password and clear the mustChangePassword flag
      const newPasswordHash = await hashPassword(newPassword);
      const updated = await storage.updateUser(user.id, { 
        password: newPasswordHash,
        mustChangePassword: false, // Clear the flag after password change
      });

      return res.json({ 
        ok: true, 
        message: "Password changed successfully",
        user: sanitizeUser(updated!),
      });
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

      // Create audit log
      storage.createAuditLog({
        userId: user.id,
        action: "user.password_reset",
        targetType: "user",
        targetId: user.id,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(err => console.error("[Audit] Failed to log password reset:", err));

      return res.json({ ok: true, message: "Password has been reset successfully" });
    } catch (err) {
      return next(err);
    }
  });

  // --- Email Verification ---
  app.post("/api/auth/verify-email", async (req, res, next) => {
    try {
      const schema = z.object({ token: z.string().min(32).max(128) }).strict();
      const { token } = schema.parse(req.body);

      const user = await storage.getUserByEmailVerifyToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      // Mark email as verified and clear token
      await storage.setEmailVerified(user.id, true);
      await storage.clearEmailVerifyToken(user.id);

      // Create audit log
      storage.createAuditLog({
        userId: user.id,
        action: "user.email_verified",
        targetType: "user",
        targetId: user.id,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(err => console.error("[Audit] Failed to log email verification:", err));

      return res.json({ ok: true, message: "Email verified successfully" });
    } catch (err) {
      return next(err);
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const fullUser = await storage.getUser(user.id);
      if (!fullUser) return res.status(404).json({ message: "User not found" });

      if ((fullUser as any).emailVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }

      // Generate new token
      const verifyToken = crypto.randomBytes(32).toString("hex");
      await storage.setEmailVerifyToken(user.id, verifyToken);
      const appUrl = process.env.APP_URL || "https://applyn.co.in";
      const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;
      
      const sent = await sendEmailVerificationEmail(fullUser.username, verifyUrl, fullUser.name || undefined);
      if (!sent) {
        return res.status(500).json({ message: "Failed to send verification email" });
      }

      return res.json({ ok: true, message: "Verification email sent" });
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

  // Plan pricing (in paise) - YEARLY SUBSCRIPTION MODEL
  const PLAN_PRICES: Record<string, number> = {
    starter: 199900,   // ₹1,999/year - 1 Android app, basic native shell
    standard: 399900,  // ₹3,999/year - 1 Android app, smart hybrid enhancements
    pro: 699900,       // ₹6,999/year - 1 Android + 1 iOS app, full features
    agency: 1999900,   // ₹19,999/year - Up to 10 apps, team access
  };

  // Extra rebuild prices
  const EXTRA_REBUILD_PRICE = 49900;      // ₹499 per single rebuild
  const EXTRA_REBUILD_PACK_PRICE = 299900; // ₹2,999 for 10 rebuilds
  const EXTRA_APP_SLOT_PRICE = 149900;     // ₹1,499 per extra app slot/year

  // Rebuilds per plan (yearly)
  const PLAN_REBUILDS: Record<string, number> = {
    starter: 1,
    standard: 2,
    pro: 3,
    agency: 20,
  };

  // Max apps per plan
  const PLAN_MAX_APPS: Record<string, number> = {
    starter: 1,
    standard: 1,
    pro: 2,
    agency: 10,
  };

  const createOrderSchema = z.object({
    plan: z.enum(["starter", "standard", "pro", "agency"]),
    appId: z.string().uuid().optional().nullable(),
    type: z.enum(["subscription", "extra_rebuild", "extra_rebuild_pack", "extra_app_slot"]).default("subscription"),
  }).strict();

  app.post("/api/payments/create-order", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: "Payment gateway not configured" });
      }

      const { plan, appId, type } = createOrderSchema.parse(req.body);
      
      // Determine amount based on type
      let amountInPaise: number;
      let description: string;
      
      if (type === "extra_rebuild") {
        amountInPaise = EXTRA_REBUILD_PRICE;
        description = "Extra Rebuild (1)";
      } else if (type === "extra_rebuild_pack") {
        amountInPaise = EXTRA_REBUILD_PACK_PRICE;
        description = "Extra Rebuild Pack (10)";
      } else if (type === "extra_app_slot") {
        amountInPaise = EXTRA_APP_SLOT_PRICE;
        description = "Extra App Slot";
      } else {
        amountInPaise = PLAN_PRICES[plan];
        if (!amountInPaise) {
          return res.status(400).json({ message: "Invalid plan" });
        }
        description = `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - Yearly`;
      }

      // Create Razorpay order via API
      const orderPayload = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `${type}_${plan}_${Date.now()}`,
        notes: {
          userId: user.id,
          plan,
          appId: appId || "",
          type,
          description,
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
        plan: type === "extra_rebuild" ? "extra_rebuild" : plan,
      });

      return res.json({
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: razorpayKeyId,
        paymentId: payment.id,
        plan,
        type,
        description,
      });
    } catch (err) {
      return next(err);
    }
  });

  // --- Razorpay Webhook Handler ---
  // Handles async payment events from Razorpay for reliable payment processing
  const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  app.post("/api/webhooks/razorpay", async (req, res) => {
    try {
      if (!RAZORPAY_WEBHOOK_SECRET) {
        console.log("[Razorpay Webhook] Webhook secret not configured, skipping");
        return res.status(200).json({ ok: true, message: "Webhook not configured" });
      }

      // Verify webhook signature
      const signature = req.headers["x-razorpay-signature"] as string;
      if (!signature) {
        console.log("[Razorpay Webhook] Missing signature header");
        return res.status(400).json({ message: "Missing signature" });
      }

      const rawBody = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      // Timing-safe comparison
      const sigBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        console.log("[Razorpay Webhook] Invalid signature");
        return res.status(400).json({ message: "Invalid signature" });
      }

      const event = req.body;
      console.log(`[Razorpay Webhook] Received event: ${event.event}`);

      // Handle payment.captured event
      if (event.event === "payment.captured") {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id && payment?.id && payment?.status === "captured") {
          // Find payment by order ID
          const existingPayments = await storage.listPaymentsByUser("all"); // Get all to find by order
          const dbPayment = Array.from(existingPayments).find(
            (p: any) => p.providerOrderId === payment.order_id && p.status === "pending"
          );

          if (dbPayment) {
            await storage.updatePaymentStatus(dbPayment.id, "completed", payment.id);
            console.log(`[Razorpay Webhook] Payment ${dbPayment.id} marked as completed via webhook`);
          }
        }
      }

      // Handle payment.failed event
      if (event.event === "payment.failed") {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id) {
          const existingPayments = await storage.listPaymentsByUser("all");
          const dbPayment = Array.from(existingPayments).find(
            (p: any) => p.providerOrderId === payment.order_id && p.status === "pending"
          );

          if (dbPayment) {
            await storage.updatePaymentStatus(dbPayment.id, "failed");
            console.log(`[Razorpay Webhook] Payment ${dbPayment.id} marked as failed via webhook`);
          }
        }
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[Razorpay Webhook] Error:", err);
      return res.status(500).json({ message: "Webhook processing error" });
    }
  });

  // --- Admin Payment Bypass ---
  // Allows admin users to create apps without payment and activates subscription
  const adminBypassSchema = z.object({
    plan: z.enum(["starter", "standard", "pro", "agency"]),
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

      // Activate subscription for admin
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      
      await storage.activateSubscription(user.id, {
        plan,
        planStatus: "active",
        planStartDate: now,
        planExpiryDate: expiryDate,
        remainingRebuilds: PLAN_REBUILDS[plan] || 1,
        maxAppsAllowed: PLAN_MAX_APPS[plan] || 1,
      });

      return res.json({ ok: true, payment, message: "Admin bypass - payment skipped, subscription activated" });
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

      // Verify signature using timing-safe comparison to prevent timing attacks
      const expectedSignature = crypto
        .createHmac("sha256", razorpayKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      // Use timing-safe comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(razorpay_signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const signaturesMatch = signatureBuffer.length === expectedBuffer.length && 
        crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!signaturesMatch) {
        await storage.updatePaymentStatus(paymentId, "failed");
        return res.status(400).json({ message: "Payment verification failed" });
      }

      // Update payment status
      const payment = await storage.updatePaymentStatus(paymentId, "completed", razorpay_payment_id);
      if (!payment) {
        return res.status(404).json({ message: "Payment record not found" });
      }

      // Handle subscription activation or extra rebuild
      const plan = payment.plan as PlanId | "extra_rebuild" | "extra_rebuild_pack" | "extra_app_slot";
      
      if (plan === "extra_rebuild") {
        // Add 1 rebuild to user's remaining rebuilds
        await storage.addRebuilds(user.id, 1);
        console.log(`[Payment Verify] Added 1 extra rebuild for user ${user.id}`);
      } else if (plan === "extra_rebuild_pack") {
        // Add 10 rebuilds to user's remaining rebuilds
        await storage.addRebuilds(user.id, 10);
        console.log(`[Payment Verify] Added 10 extra rebuilds for user ${user.id}`);
      } else if (plan === "extra_app_slot") {
        // Add 1 extra app slot to user
        await storage.addExtraAppSlot(user.id, 1);
        const freshUser = await storage.getUser(user.id);
        const currentSlots = (freshUser as any)?.extraAppSlots || 0;
        console.log(`[Payment Verify] Added 1 extra app slot for user ${user.id}, now has ${currentSlots} extra slots`);
      } else if (plan === "starter" || plan === "standard" || plan === "pro" || plan === "agency") {
        // Activate or extend subscription
        const now = new Date();
        
        // If user already has an active subscription that hasn't expired yet,
        // extend from the current expiry date, otherwise start from now
        const freshUser = await storage.getUser(user.id);
        let startDate = now;
        let expiryDate = new Date(now);
        
        if (freshUser?.planExpiryDate && freshUser.planStatus === "active") {
          const currentExpiry = new Date(freshUser.planExpiryDate);
          if (currentExpiry > now) {
            // Extend from current expiry
            expiryDate = new Date(currentExpiry);
          }
        }
        
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        
        await storage.activateSubscription(user.id, {
          plan,
          planStatus: "active",
          planStartDate: startDate,
          planExpiryDate: expiryDate,
          remainingRebuilds: PLAN_REBUILDS[plan] || 1,
          maxAppsAllowed: PLAN_MAX_APPS[plan] || 1,
        });
        
        console.log(`[Payment Verify] Activated ${plan} subscription for user ${user.id} until ${expiryDate.toISOString()}`);
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

  // Generate invoice PDF for a payment
  app.get("/api/payments/:id/invoice", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const payments = await storage.listPaymentsByUser(user.id);
      const payment = payments.find(p => p.id === req.params.id);
      
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Only generate invoice for completed payments
      if (payment.status !== "completed") {
        return res.status(400).json({ message: "Invoice only available for completed payments" });
      }

      // Get app details
      const appItem = payment.appId ? await storage.getApp(payment.appId) : null;

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${payment.id}.pdf"`);
      
      // Pipe to response
      doc.pipe(res);

      // Company Header
      doc.fontSize(24).fillColor('#06b6d4').text('Applyn', { align: 'left' });
      doc.fontSize(10).fillColor('#666666').text('App Builder Platform', { align: 'left' });
      doc.moveDown(0.5);
      
      // Invoice Title
      doc.fontSize(20).fillColor('#1a1a1a').text('INVOICE', { align: 'right' });
      doc.fontSize(10).fillColor('#666666').text(`Invoice #: INV-${String(payment.id).padStart(6, '0')}`, { align: 'right' });
      doc.text(`Date: ${new Date(payment.createdAt || Date.now()).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' });
      
      doc.moveDown(2);

      // Horizontal line
      doc.strokeColor('#e5e5e5').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Bill To section
      doc.fontSize(12).fillColor('#1a1a1a').text('Bill To:', { continued: false });
      doc.fontSize(10).fillColor('#666666');
      doc.text(user.name || user.username);
      doc.text(user.username);
      
      doc.moveDown(2);

      // Payment Details Table Header
      const tableTop = doc.y;
      doc.fontSize(10).fillColor('#ffffff');
      doc.rect(50, tableTop, 500, 25).fill('#1a1a2e');
      doc.fillColor('#ffffff');
      doc.text('Description', 60, tableTop + 8);
      doc.text('Plan', 280, tableTop + 8);
      doc.text('Amount', 450, tableTop + 8, { align: 'right', width: 90 });

      // Table Row
      const rowTop = tableTop + 25;
      doc.rect(50, rowTop, 500, 30).fill('#f9f9f9');
      doc.fillColor('#1a1a1a').fontSize(10);
      
      const description = appItem ? `App: ${appItem.name || 'Unnamed App'}` : 'App Build Credits';
      doc.text(description, 60, rowTop + 10);
      doc.text(payment.plan?.toUpperCase() || 'STANDARD', 280, rowTop + 10);
      doc.text(`₹${((payment.amountInr || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, rowTop + 10, { align: 'right', width: 90 });

      doc.moveDown(4);

      // Subtotal and Total
      const subtotalY = doc.y;
      doc.fontSize(10).fillColor('#666666');
      doc.text('Subtotal:', 350, subtotalY);
      doc.fillColor('#1a1a1a').text(`₹${((payment.amountInr || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, subtotalY, { align: 'right', width: 90 });
      
      doc.moveDown(0.5);
      doc.fillColor('#666666').text('GST (Included):', 350, doc.y);
      doc.fillColor('#1a1a1a').text('₹0.00', 450, doc.y, { align: 'right', width: 90 });
      
      doc.moveDown(0.5);
      doc.strokeColor('#e5e5e5').lineWidth(1).moveTo(350, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      
      doc.fontSize(12).fillColor('#1a1a1a').text('Total:', 350, doc.y, { continued: false });
      doc.fontSize(12).fillColor('#06b6d4').text(`₹${((payment.amountInr || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, doc.y - 14, { align: 'right', width: 90 });

      doc.moveDown(3);

      // Payment Info
      doc.fontSize(10).fillColor('#666666');
      doc.text('Payment Information:', { underline: true });
      doc.moveDown(0.5);
      doc.text(`Payment ID: ${payment.providerPaymentId || 'N/A'}`);
      doc.text(`Order ID: ${payment.providerOrderId || 'N/A'}`);
      doc.text(`Status: ${payment.status?.toUpperCase() || 'COMPLETED'}`);

      doc.moveDown(2);

      // Footer
      doc.strokeColor('#e5e5e5').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#999999');
      doc.text('Thank you for your business!', { align: 'center' });
      doc.text('This is a computer-generated invoice and does not require a signature.', { align: 'center' });
      doc.moveDown(0.5);
      doc.text('For support, contact: support@applyn.com', { align: 'center' });

      // Finalize PDF
      doc.end();
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

  // ============================================
  // BUILD READINESS CHECK ENDPOINTS
  // ============================================

  // Check Play Store readiness for an app
  app.get("/api/apps/:id/readiness/playstore", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      // Get plan info to check if Play Store is even available
      const { plan, limits } = await getAppPlanInfo(appItem.id);
      
      if (!limits.playStoreReady) {
        return res.status(403).json({
          ready: false,
          message: "Play Store submission is not available on Starter plan",
          requiresUpgrade: true,
          minimumPlan: "standard",
          checks: [],
          passCount: 0,
          failCount: 1,
          warningCount: 0,
        });
      }

      // Perform readiness validation
      // In production, these would come from the actual build artifacts
      const buildInfo = {
        isReleaseSigned: appItem.status === "live", // Assume live builds are signed
        hasAabOutput: limits.aabEnabled && appItem.status === "live",
        targetSdk: 34,
        hasDebugFlags: false,
        hasInternetPermission: true,
        iconSize: appItem.iconUrl ? 512 : 48, // Custom icons are larger
      };

      const result = validatePlayStoreReadiness(appItem, buildInfo);

      return res.json({
        ...result,
        plan,
        canSubmit: result.ready && limits.playStoreReady,
      });
    } catch (err) {
      return next(err);
    }
  });

  // Check App Store readiness for an app (Pro plan only)
  app.get("/api/apps/:id/readiness/appstore", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      // Get plan info
      const { plan, limits } = await getAppPlanInfo(appItem.id);
      
      if (!limits.appStoreReady) {
        return res.status(403).json({
          ready: false,
          message: "App Store submission is only available on Pro plan",
          requiresUpgrade: true,
          minimumPlan: "pro",
          checks: [],
          passCount: 0,
          failCount: 1,
          warningCount: 0,
        });
      }

      // Perform iOS readiness validation
      const buildInfo = {
        bundleId: appItem.packageName?.replace(/^com\./, ""), // Derive from package name
        appVersion: "1.0.0",
        buildNumber: appItem.versionCode || 1,
        hasAllIcons: !!appItem.iconUrl,
        hasLaunchScreen: true, // Default splash is always included
        hasPushCapability: limits.pushEnabled,
        hasSigningProfile: appItem.status === "live",
      };

      const result = validateAppStoreReadiness(appItem, buildInfo);

      return res.json({
        ...result,
        plan,
        canSubmit: result.ready && limits.appStoreReady,
      });
    } catch (err) {
      return next(err);
    }
  });

  // Validate before AAB download (Play Store format)
  app.get("/api/apps/:id/validate/aab", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const { plan, limits } = await getAppPlanInfo(appItem.id);

      // Check if AAB is allowed for this plan
      if (!limits.aabEnabled) {
        return res.status(403).json({
          allowed: false,
          reason: "AAB format (Play Store) is not available on Starter plan. Preview builds are not eligible for Play Store submission.",
          requiresUpgrade: true,
          minimumPlan: "standard",
        });
      }

      // Run readiness checks
      const buildInfo = {
        isReleaseSigned: appItem.status === "live",
        hasAabOutput: appItem.status === "live",
        targetSdk: 34,
        hasDebugFlags: false,
        hasInternetPermission: true,
      };

      const validation = canDownloadAab(appItem, plan, buildInfo);

      return res.json(validation);
    } catch (err) {
      return next(err);
    }
  });

  // ============================================
  // END BUILD READINESS ENDPOINTS
  // ============================================

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
  // Website Scraper (No LLM Required)
  // ==========================================
  
  // Lightweight website scraper - extracts logo, colors, and metadata
  // This works WITHOUT AI/LLM - pure HTML parsing
  app.post("/api/scrape-website", rateLimit({
    windowMs: 60 * 1000,
    max: 30, // Allow more requests since it's lightweight
    message: { message: "Too many requests, please slow down" },
  }), async (req, res, next) => {
    try {
      const schema = z.object({
        url: z.string().url(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid URL" });
      }

      const { url } = parsed.data;
      const baseUrl = new URL(url);

      // SSRF Protection: Block private/internal IP ranges
      const hostname = baseUrl.hostname.toLowerCase();
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^192\.168\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^169\.254\./,
        /^0\./,
        /^\[::1\]$/,
        /^\[fe80:/i,
        /^\[fc00:/i,
        /^\[fd00:/i,
        /^\.internal$/i,
        /\.local$/i,
        /^metadata\./i,
        /^169\.254\.169\.254/,
      ];
      
      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return res.status(400).json({ message: "Invalid URL: private/internal addresses not allowed" });
      }

      // Block non-HTTP(S) protocols
      if (!['http:', 'https:'].includes(baseUrl.protocol)) {
        return res.status(400).json({ message: "Invalid URL: only HTTP/HTTPS allowed" });
      }

      // Fetch the website HTML
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          return res.status(400).json({ message: `Could not fetch website: ${response.status}` });
        }

        const html = await response.text();
        
        // ===== EXTRACT LOGO =====
        let logoUrl: string | null = null;
        let logoSource: string = "";
        
        // Priority order for logo extraction:
        // 1. Apple touch icon (best quality, designed for apps)
        const appleTouchIcon = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i) ||
                               html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i);
        if (appleTouchIcon) {
          logoUrl = appleTouchIcon[1];
          logoSource = "apple-touch-icon";
        }
        
        // 2. Apple touch icon precomposed
        if (!logoUrl) {
          const appleTouchPrecomposed = html.match(/<link[^>]*rel=["']apple-touch-icon-precomposed["'][^>]*href=["']([^"']+)["']/i);
          if (appleTouchPrecomposed) {
            logoUrl = appleTouchPrecomposed[1];
            logoSource = "apple-touch-icon-precomposed";
          }
        }
        
        // 3. Large favicon (192x192 or higher)
        if (!logoUrl) {
          const largeFavicon = html.match(/<link[^>]*rel=["']icon["'][^>]*sizes=["'](192x192|512x512|384x384|256x256)["'][^>]*href=["']([^"']+)["']/i) ||
                              html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']icon["'][^>]*sizes=["'](192x192|512x512|384x384|256x256)["']/i);
          if (largeFavicon) {
            logoUrl = largeFavicon[2] || largeFavicon[1];
            logoSource = "large-favicon";
          }
        }
        
        // 4. OG image (social sharing image)
        if (!logoUrl) {
          const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
          if (ogImage) {
            logoUrl = ogImage[1];
            logoSource = "og-image";
          }
        }
        
        // 5. Any favicon
        if (!logoUrl) {
          const favicon = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) ||
                         html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
          if (favicon) {
            logoUrl = favicon[1];
            logoSource = "favicon";
          }
        }
        
        // 6. Default favicon.ico
        if (!logoUrl) {
          logoUrl = "/favicon.ico";
          logoSource = "default-favicon";
        }
        
        // Make logo URL absolute
        if (logoUrl && !logoUrl.startsWith("http")) {
          if (logoUrl.startsWith("//")) {
            logoUrl = `${baseUrl.protocol}${logoUrl}`;
          } else if (logoUrl.startsWith("/")) {
            logoUrl = `${baseUrl.origin}${logoUrl}`;
          } else {
            logoUrl = `${baseUrl.origin}/${logoUrl}`;
          }
        }
        
        // ===== EXTRACT COLORS =====
        let primaryColor: string | null = null;
        let secondaryColor: string | null = null;
        let backgroundColor: string | null = null;
        let colorSource: string = "";
        let secondaryColorSource: string = "";
        let backgroundColorSource: string = "";
        const allExtractedColors: string[] = []; // Collect all colors for secondary fallback
        
        // Helper to validate and normalize hex color
        const normalizeHexColor = (color: string): string | null => {
          if (!color) return null;
          color = color.trim();
          // Handle 3-digit hex
          if (/^#[0-9A-Fa-f]{3}$/i.test(color)) {
            color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
          }
          // Validate 6-digit hex
          if (/^#[0-9A-Fa-f]{6}$/i.test(color)) {
            return color.toUpperCase();
          }
          return null;
        };
        
        // Helper to check if color is too generic (white, black, gray)
        const isGenericColor = (hex: string): boolean => {
          if (!hex) return true;
          hex = hex.toUpperCase().replace('#', '');
          // Check for white/near-white
          if (hex === 'FFFFFF' || hex === 'FFF' || hex === 'FAFAFA' || hex === 'F5F5F5' || hex === 'EEEEEE') return true;
          // Check for black/near-black
          if (hex === '000000' || hex === '000' || hex === '111111' || hex === '1A1A1A' || hex === '0A0A0A') return true;
          // Check for grays
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          const isGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
          const isTooLight = r > 240 && g > 240 && b > 240;
          const isTooDark = r < 25 && g < 25 && b < 25;
          return isGray || isTooLight || isTooDark;
        };
        
        // Priority order for color extraction:
        // 1. theme-color meta tag (most reliable)
        const themeColor = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
        if (themeColor) {
          const normalized = normalizeHexColor(themeColor[1]);
          if (normalized && !isGenericColor(normalized)) {
            primaryColor = normalized;
            colorSource = "theme-color";
            allExtractedColors.push(normalized);
          }
        }
        
        // 2. msapplication-TileColor
        if (!primaryColor) {
          const tileColor = html.match(/<meta[^>]*name=["']msapplication-TileColor["'][^>]*content=["']([^"']+)["']/i);
          if (tileColor) {
            const normalized = normalizeHexColor(tileColor[1]);
            if (normalized && !isGenericColor(normalized)) {
              primaryColor = normalized;
              colorSource = "tile-color";
              allExtractedColors.push(normalized);
            }
          }
        }
        
        // === EXTRACT BACKGROUND COLOR ===
        // Look for body/html background colors
        const bodyBgMatch = html.match(/<body[^>]*style=["'][^"']*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})[^"']*["']/i);
        if (bodyBgMatch) {
          const normalized = normalizeHexColor(bodyBgMatch[1]);
          if (normalized) {
            backgroundColor = normalized;
            backgroundColorSource = "body-style";
          }
        }
        
        // Also check CSS for body background
        if (!backgroundColor) {
          const styleTagContent = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi)?.join(' ') || '';
          const bodyBgCss = styleTagContent.match(/body\s*{[^}]*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/i);
          if (bodyBgCss) {
            const normalized = normalizeHexColor(bodyBgCss[1]);
            if (normalized) {
              backgroundColor = normalized;
              backgroundColorSource = "body-css";
            }
          }
        }
        
        // 3. CSS custom properties from inline styles and style tags
        if (!primaryColor) {
          const cssVarPatterns = [
            /--primary(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--brand(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--main(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--accent(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--theme(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--color-primary:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--wp--preset--color--primary:\s*([#][0-9A-Fa-f]{3,6})/gi,
          ];
          // Also look for secondary/accent CSS variables
          const secondaryCssPatterns = [
            /--secondary(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--accent(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--color-secondary:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /--wp--preset--color--secondary:\s*([#][0-9A-Fa-f]{3,6})/gi,
          ];
          for (const pattern of cssVarPatterns) {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
              const normalized = normalizeHexColor(match[1]);
              if (normalized && !isGenericColor(normalized)) {
                if (!primaryColor) {
                  primaryColor = normalized;
                  colorSource = "css-variable";
                }
                allExtractedColors.push(normalized);
              }
            }
          }
          // Extract secondary colors
          for (const pattern of secondaryCssPatterns) {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
              const normalized = normalizeHexColor(match[1]);
              if (normalized && !isGenericColor(normalized) && normalized !== primaryColor) {
                if (!secondaryColor) {
                  secondaryColor = normalized;
                  secondaryColorSource = "css-variable";
                }
                allExtractedColors.push(normalized);
              }
            }
          }
        }
        
        // 4. Look for colors in inline style attributes on key elements
        {
          // Extract all inline style colors (always, to build color palette)
          const inlineStyleColors: string[] = [];
          const styleMatches = html.matchAll(/style=["'][^"']*(?:background(?:-color)?|color|border-color):\s*([#][0-9A-Fa-f]{3,6})[^"']*["']/gi);
          for (const match of styleMatches) {
            const normalized = normalizeHexColor(match[1]);
            if (normalized && !isGenericColor(normalized)) {
              inlineStyleColors.push(normalized);
              allExtractedColors.push(normalized);
            }
          }
          if (!primaryColor && inlineStyleColors.length > 0) {
            // Use the most common non-generic color
            const colorCounts: Record<string, number> = {};
            inlineStyleColors.forEach(c => { colorCounts[c] = (colorCounts[c] || 0) + 1; });
            const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
              primaryColor = sorted[0][0];
              colorSource = "inline-style";
            }
          }
        }
        
        // 5. Extract from CSS in <style> tags - look for button, .btn, header, nav backgrounds
        if (!primaryColor) {
          const styleTagContent = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi)?.join(' ') || '';
          const bgColorPatterns = [
            /\.btn[^{]*{[^}]*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /button[^{]*{[^}]*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /\.primary[^{]*{[^}]*(?:background(?:-color)?|color):\s*([#][0-9A-Fa-f]{3,6})/gi,
            /\.brand[^{]*{[^}]*(?:background(?:-color)?|color):\s*([#][0-9A-Fa-f]{3,6})/gi,
            /header[^{]*{[^}]*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /nav[^{]*{[^}]*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
            /\.cta[^{]*{[^}]*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/gi,
          ];
          for (const pattern of bgColorPatterns) {
            const matches = styleTagContent.matchAll(pattern);
            for (const match of matches) {
              const normalized = normalizeHexColor(match[1]);
              if (normalized && !isGenericColor(normalized)) {
                primaryColor = normalized;
                colorSource = "css-button";
                break;
              }
            }
            if (primaryColor) break;
          }
        }
        
        // 6. Try to fetch primary CSS file and extract colors
        if (!primaryColor) {
          try {
            // Find main CSS file
            const cssLinkMatch = html.match(/<link[^>]*href=["']([^"']+\.css(?:\?[^"']*)?)[^"']*["'][^>]*rel=["']stylesheet["']/i) ||
                                html.match(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css(?:\?[^"']*)?)/i);
            if (cssLinkMatch) {
              let cssUrl = cssLinkMatch[1];
              if (!cssUrl.startsWith('http')) {
                cssUrl = cssUrl.startsWith('/') ? `${baseUrl.origin}${cssUrl}` : `${baseUrl.origin}/${cssUrl}`;
              }
              
              // Fetch CSS with short timeout
              const cssController = new AbortController();
              const cssTimeout = setTimeout(() => cssController.abort(), 5000);
              const cssRes = await fetch(cssUrl, { 
                signal: cssController.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AppScraper/1.0)' }
              });
              clearTimeout(cssTimeout);
              
              if (cssRes.ok) {
                const cssText = await cssRes.text();
                // Look for brand colors in CSS
                const cssBrandPatterns = [
                  /--primary(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/i,
                  /--brand(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/i,
                  /--accent(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/i,
                  /\.btn-primary[^{]*{[^}]*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/i,
                  /\.btn[^{]*{[^}]*background(?:-color)?:\s*([#][0-9A-Fa-f]{3,6})/i,
                  /a\s*{[^}]*color:\s*([#][0-9A-Fa-f]{3,6})/i,
                  /a:hover[^{]*{[^}]*color:\s*([#][0-9A-Fa-f]{3,6})/i,
                ];
                for (const pattern of cssBrandPatterns) {
                  const match = cssText.match(pattern);
                  if (match) {
                    const normalized = normalizeHexColor(match[1]);
                    if (normalized && !isGenericColor(normalized)) {
                      primaryColor = normalized;
                      colorSource = "external-css";
                      break;
                    }
                  }
                }
              }
            }
          } catch (cssErr) {
            // Ignore CSS fetch errors
          }
        }
        
        // 7. Last resort: Extract any prominent color from the page
        if (!primaryColor) {
          // Look for any hex colors that appear multiple times
          const allHexColors = html.matchAll(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g);
          const colorCounts: Record<string, number> = {};
          for (const match of allHexColors) {
            const normalized = normalizeHexColor(`#${match[1]}`);
            if (normalized && !isGenericColor(normalized)) {
              colorCounts[normalized] = (colorCounts[normalized] || 0) + 1;
            }
          }
          const sortedColors = Object.entries(colorCounts)
            .filter(([_, count]) => count >= 2) // Must appear at least twice
            .sort((a, b) => b[1] - a[1]);
          if (sortedColors.length > 0) {
            primaryColor = sortedColors[0][0];
            colorSource = "frequent-color";
          }
        }
        
        // 8. BEST FALLBACK: Extract dominant color from logo image
        // The logo colors ARE the brand colors - most reliable method
        if (!primaryColor && logoUrl) {
          try {
            // Fetch the logo image
            const logoController = new AbortController();
            const logoTimeout = setTimeout(() => logoController.abort(), 5000);
            const logoRes = await fetch(logoUrl, {
              signal: logoController.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AppScraper/1.0)' }
            });
            clearTimeout(logoTimeout);
            
            if (logoRes.ok) {
              const contentType = logoRes.headers.get('content-type') || '';
              
              // For SVG, extract colors from the SVG code
              if (contentType.includes('svg') || logoUrl.endsWith('.svg')) {
                const svgText = await logoRes.text();
                // Extract colors from fill and stroke attributes
                const svgColors: string[] = [];
                const fillMatches = svgText.matchAll(/(?:fill|stroke)=["']#([0-9A-Fa-f]{3,6})["']/gi);
                for (const match of fillMatches) {
                  const normalized = normalizeHexColor(`#${match[1]}`);
                  if (normalized && !isGenericColor(normalized)) {
                    svgColors.push(normalized);
                  }
                }
                // Also check style attributes
                const styleMatches = svgText.matchAll(/(?:fill|stroke):\s*#([0-9A-Fa-f]{3,6})/gi);
                for (const match of styleMatches) {
                  const normalized = normalizeHexColor(`#${match[1]}`);
                  if (normalized && !isGenericColor(normalized)) {
                    svgColors.push(normalized);
                  }
                }
                if (svgColors.length > 0) {
                  // Count occurrences and pick most common
                  const counts: Record<string, number> = {};
                  svgColors.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
                  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                  primaryColor = sorted[0][0];
                  colorSource = "logo-svg";
                }
              }
              // For PNG/JPG/ICO, use sharp to extract dominant colors
              const imageBuffer = Buffer.from(await logoResponse.arrayBuffer());
              try {
                // Get raw pixel data from the image
                const { data, info } = await sharp(imageBuffer)
                  .resize(100, 100, { fit: 'inside' }) // Resize for faster processing
                  .removeAlpha() // Remove alpha channel
                  .raw()
                  .toBuffer({ resolveWithObject: true });
                
                // Count color frequencies
                const colorCounts: Record<string, number> = {};
                for (let i = 0; i < data.length; i += 3) {
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];
                  
                  // Skip very light (white-ish) and very dark (black-ish) colors
                  const brightness = (r + g + b) / 3;
                  if (brightness > 240 || brightness < 15) continue;
                  
                  // Skip grayscale colors (where R, G, B are too similar)
                  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
                  if (maxDiff < 20) continue;
                  
                  // Quantize colors to reduce noise (round to nearest 16)
                  const qr = Math.round(r / 16) * 16;
                  const qg = Math.round(g / 16) * 16;
                  const qb = Math.round(b / 16) * 16;
                  
                  const hex = `#${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`.toUpperCase();
                  colorCounts[hex] = (colorCounts[hex] || 0) + 1;
                }
                
                // Get the most frequent non-generic color
                const sortedColors = Object.entries(colorCounts)
                  .sort((a, b) => b[1] - a[1])
                  .filter(([color]) => !isGenericColor(color));
                
                if (sortedColors.length > 0) {
                  primaryColor = sortedColors[0][0];
                  colorSource = "logo-image";
                  console.log(`Extracted color ${primaryColor} from logo image`);
                }
              } catch (sharpErr) {
                console.log("Sharp image processing failed:", sharpErr);
              }
            }
          } catch (logoErr) {
            // Ignore logo color extraction errors
            console.log("Logo color extraction failed:", logoErr);
          }
        }
        
        // ===== EXTRACT APP NAME =====
        let appName: string | null = null;
        
        // 1. og:site_name
        const ogSiteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
        if (ogSiteName) {
          appName = ogSiteName[1].trim();
        }
        
        // 2. og:title
        if (!appName) {
          const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
          if (ogTitle) {
            appName = ogTitle[1].trim();
          }
        }
        
        // 3. Title tag
        if (!appName) {
          const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (title) {
            // Clean up title - remove common suffixes
            appName = title[1]
              .split(/[|\-–—]/)[0] // Take first part before separators
              .replace(/home|homepage|welcome/gi, "")
              .trim();
          }
        }
        
        // 4. Domain name as fallback
        if (!appName || appName.length < 2) {
          appName = baseUrl.hostname
            .replace(/^www\./, "")
            .split(".")[0]
            .replace(/-/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());
        }
        
        // Limit app name length
        if (appName && appName.length > 30) {
          appName = appName.substring(0, 30).trim();
        }
        
        // ===== DERIVE SECONDARY COLOR =====
        // If we didn't find a specific secondary color, pick from extracted colors
        if (!secondaryColor && allExtractedColors.length > 1) {
          // Get unique colors that aren't the primary
          const uniqueColors = [...new Set(allExtractedColors)].filter(c => c !== primaryColor);
          if (uniqueColors.length > 0) {
            secondaryColor = uniqueColors[0];
            secondaryColorSource = "derived";
          }
        }
        
        // If still no secondary, try to derive a complementary color from primary
        if (!secondaryColor && primaryColor) {
          // Simple complementary: shift hue by 180 degrees
          const hex = primaryColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          // Simple color shift (not true complementary but creates contrast)
          const newR = (r + 128) % 256;
          const newG = (g + 64) % 256;
          const newB = (b + 192) % 256;
          secondaryColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`.toUpperCase();
          secondaryColorSource = "generated";
        }
        
        // ===== DERIVE BACKGROUND COLOR =====
        // If we couldn't extract background, try to infer based on site theme
        if (!backgroundColor) {
          // Check if site uses dark mode CSS
          const hasDarkMode = html.includes('prefers-color-scheme: dark') || 
                             html.includes('dark-mode') || 
                             html.includes('theme-dark') ||
                             html.includes('bg-black') ||
                             html.includes('bg-gray-900') ||
                             html.includes('bg-slate-900');
          const hasLightMode = html.includes('bg-white') ||
                              html.includes('bg-gray-50') ||
                              html.includes('bg-slate-50');
          
          if (hasDarkMode && !hasLightMode) {
            backgroundColor = "#0A0A0A";
            backgroundColorSource = "dark-mode-detected";
          } else if (hasLightMode) {
            backgroundColor = "#FFFFFF";
            backgroundColorSource = "light-mode-detected";
          } else {
            // Default to dark for modern app feel
            backgroundColor = "#0A0A0A";
            backgroundColorSource = "default";
          }
        }
        
        return res.json({
          success: true,
          url,
          appName,
          logo: {
            url: logoUrl,
            source: logoSource,
          },
          colors: {
            primary: primaryColor,
            primarySource: colorSource,
            secondary: secondaryColor,
            secondarySource: secondaryColorSource,
            background: backgroundColor,
            backgroundSource: backgroundColorSource,
          },
        });
        
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          return res.status(408).json({ message: "Website took too long to respond" });
        }
        console.error("Website scrape error:", fetchErr);
        return res.status(400).json({ message: "Could not access website" });
      }
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
