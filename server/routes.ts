import type { Express } from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import passport from "passport";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { getEventNamingMode, normalizeEventName } from "./events/naming";
import { authEvents } from "./events/domains/auth";
import { fitnessEvents } from "./events/domains/fitness";
import { coursesEvents } from "./events/domains/courses";
import { crmEvents } from "./events/domains/crm";
import { servicesEvents } from "./events/domains/services";
import { paymentsEvents } from "./events/domains/payments";
import { google } from "googleapis";
import {
  insertAppSchema,
  insertContactSubmissionSchema,
  insertSupportTicketSchema,
  insertTicketMessageSchema,
  insertUserSchema,
  supportTicketStatusSchema,
  supportTicketPrioritySchema,
  updateUserSchema,
  insertPushTokenSchema,
  insertPushNotificationSchema,
  type User,
  userRoleSchema,
} from "@shared/schema";
import { editorScreensSchema } from "@shared/editor-screens";
import { getPlan, PLANS, type PlanId } from "@shared/pricing";
import { storage } from "./storage";
import { hashPassword, sanitizeUser, verifyPassword } from "./auth";
import { sendPasswordResetEmail, isEmailConfigured, sendTeamMemberWelcomeEmail, sendEmailVerificationEmail, sendBuildCompleteEmail, sendAccountLockedEmail } from "./email";
import crypto from "crypto";
import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { getMysqlDb, getMysqlPool } from "./db-mysql";
import { MemoryCache } from "./lib/memory-cache";
import { ecommerceService } from "./verticals/ecommerce/service";
import { ecommerceEvents } from "./verticals/ecommerce/events";
import { restaurantService } from "./verticals/restaurant/service";
import { realEstateService } from "./verticals/realestate/service";
import { healthcareService } from "./verticals/healthcare/service";
import { createReservationSchema } from "./verticals/restaurant/validators";
import {
  createMenuCategorySchema,
  createMenuItemSchema,
  createRestaurantTableSchema,
  updateKitchenStatusSchema,
} from "./verticals/restaurant/validators";
import { createInquirySchema } from "./verticals/realestate/validators";
import {
  assignInquirySchema,
  createListingSchema,
  scheduleTourSchema,
  updateInquiryStatusSchema,
} from "./verticals/realestate/validators";
import { createAppointmentSchema } from "./verticals/healthcare/validators";
import {
  createAppointmentTypeSchema,
  createAvailabilitySchema,
  createInvoicePaymentSchema,
  transitionAppointmentSchema,
} from "./verticals/healthcare/validators";
import {
  createOrderSchema as ecommerceCreateOrderSchema,
  createRefundSchema,
  updateOrderStatusSchema,
} from "./verticals/ecommerce/validators";
import {
  apps,
  appCustomers,
  appEvents,
  appOrderItems,
  appOrders,
  appProducts,
  appServices,
  appAppointments,
  appPosts,
  appPostBookmarks,
  appRestaurantReservations,
  appFitnessClasses,
  appFitnessBookings,
  appCourses,
  appCourseLessons,
  appCourseEnrollments,
  appRealEstateListings,
  appRealEstateInquiries,
  appSavedItems,
  appDoctors,
  appDoctorAppointments,
  buildJobs,
  payments as paymentsTable,
  appRadioStations,
  appPodcastEpisodes,
  appMusicAlbums,
  appMusicTracks,
  appLeads,
  appWebhooks,
  users as usersTable,
} from "@shared/db.mysql";
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
import { decryptToken, encryptToken } from "./security/token-encryption";
import type { PlayCredentials, PlayTrack } from "./publishing/playPublisher";
import { createPlayService } from "./services/play/playService";
import { validateForPublish } from "./publishing/publishValidator";
import { scanPolicy } from "./publishing/policyScanner";
import { assertCanQueueBuild, getEntitlements } from "./entitlements";
import { normalizeAndValidatePermissions, requirePermission } from "./permissions";
import { logger } from "./logger";

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
  // Backward/forward compatibility: support and staff are treated as the same staff role.
  if (raw === "admin") return "admin";
  if (raw === "support" || raw === "staff") return "support";
  return "user";
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

function base64UrlEncode(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeJson(obj: any) {
  return base64UrlEncode(Buffer.from(JSON.stringify(obj)));
}

function base64UrlDecodeToString(s: string) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function runtimeTokenSecret(appId: string) {
  const base =
    process.env.APP_CUSTOMER_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    "dev-secret-change-me";
  return `${base}:${appId}`;
}

function signRuntimeToken(appId: string, payload: any, ttlSeconds = 60 * 60 * 24 * 30) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload = {
    ...payload,
    appId,
    iat: now,
    exp: now + ttlSeconds,
  };
  const h = base64UrlEncodeJson(header);
  const p = base64UrlEncodeJson(fullPayload);
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", runtimeTokenSecret(appId)).update(data).digest();
  return `${data}.${base64UrlEncode(sig)}`;
}

function verifyRuntimeToken(appId: string, token: string): any | null {
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = crypto.createHmac("sha256", runtimeTokenSecret(appId)).update(data).digest();
  const got = Buffer.from((s || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4), "base64");
  if (got.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(got, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecodeToString(p));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && typeof payload.exp === "number" && now > payload.exp) return null;
    if (payload?.appId !== appId) return null;
    return payload;
  } catch {
    return null;
  }
}

function toObjectOrWrap(value: any): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  return { value };
}

async function recordAppEvent(appId: string, customerId: string | null, name: string, properties?: any, createdAt?: Date) {
  try {
    if (!process.env.DATABASE_URL?.startsWith("mysql://")) return;
    const db = getMysqlDb();
    const eventId = crypto.randomUUID();
    const ts = createdAt ?? new Date();
    await db.insert(appEvents).values({
      id: eventId,
      appId,
      customerId: customerId ?? null,
      name,
      properties: properties ? JSON.stringify(properties) : null,
      createdAt: ts,
    } as any);

    return { eventId, createdAt: ts };
  } catch {
    // Best-effort analytics; never block core flows.
    return null;
  }
}

async function emitAppEvent(appId: string, customerId: string | null, name: string, properties?: any) {
  try {
    const mode = getEventNamingMode();
    const normalized = normalizeEventName(String(name || ""));
    const canonicalName = mode === "dual" && normalized.isMapped ? normalized.legacyName : String(name || "");

    const recorded = await recordAppEvent(appId, customerId, canonicalName, properties);
    if (!recorded) return;

    // Best-effort webhook fanout (async; never block core flows)
    setImmediate(() => {
      void deliverAppWebhooks(appId, {
        id: recorded.eventId,
        appId,
        customerId: customerId ?? null,
        name: canonicalName,
        properties: properties ?? null,
        createdAt: recorded.createdAt.toISOString(),
      });
    });

    // Dual mode: record alias (internal only) without webhook delivery.
    // Canonical logicalName remains the legacy name.
    if (mode === "dual" && normalized.isMapped) {
      const prefixedName = normalized.prefixedName;
      if (prefixedName && prefixedName !== canonicalName) {
        const aliasProps = {
          ...toObjectOrWrap(properties ?? null),
          __isAlias: true,
          __aliasOf: recorded.eventId,
          __logicalName: normalized.logicalName,
        };
        await recordAppEvent(appId, customerId, prefixedName, aliasProps, recorded.createdAt);
      }
    }

  } catch {
    // Best-effort analytics; never block core flows.
  }
}

function safeJsonParse<T>(raw: unknown): T | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function webhookWantsEvent(hook: any, eventName: string) {
  const events = safeJsonParse<string[]>(hook?.events);
  if (!Array.isArray(events) || events.length === 0) return true;

  const normalized = normalizeEventName(eventName);
  if (!normalized.isMapped) return events.includes(eventName);

  // In dual mode, allow matching by either legacy or prefixed.
  // We still deliver only one webhook per logical event (handled in deliverAppWebhooks).
  if (events.includes(normalized.legacyName)) return true;
  if (normalized.prefixedName && events.includes(normalized.prefixedName)) return true;
  return false;
}

async function deliverAppWebhooks(appId: string, payload: any, onlyWebhookId?: string) {
  try {
    if (!process.env.DATABASE_URL?.startsWith("mysql://")) return;
    const db = getMysqlDb();

    const hooks = await db
      .select()
      .from(appWebhooks)
      .where(and(eq(appWebhooks.appId, appId), eq(appWebhooks.enabled, 1)));

    const normalized = normalizeEventName(String(payload?.name || ""));
    const mode = getEventNamingMode();

    const targets = (hooks as any[])
      .filter((h) => (!onlyWebhookId ? true : String(h.id) === String(onlyWebhookId)))
      .filter((h) => isHttpishUrl(String(h.url || "")))
      .filter((h) => webhookWantsEvent(h, String(payload?.name || "")));

    if (!targets.length) return;

    await Promise.allSettled(
      targets.map(async (h) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const configured = safeJsonParse<string[]>(h?.events);
          const subscribed = Array.isArray(configured) ? configured.filter((x) => typeof x === "string") : [];
          const wantsAll = subscribed.length === 0;

          // Decide delivery name per webhook:
          // - Dual mode: default legacy unless webhook explicitly subscribes to prefixed.
          // - Prefixed mode: deliver prefixed when mapping exists, otherwise original.
          // - Legacy mode: deliver legacy/original.
          let outName = String(payload?.name || "");
          if (normalized.isMapped) {
            const prefixed = normalized.prefixedName;
            const legacy = normalized.legacyName;

            const explicitlyPrefixed = !!(prefixed && subscribed.includes(prefixed));
            const explicitlyLegacy = subscribed.includes(legacy);

            // If a webhook has an explicit event list, require a match to either form.
            if (!wantsAll && !explicitlyPrefixed && !explicitlyLegacy) {
              return;
            }

            if (mode === "prefixed") {
              outName = prefixed || outName;
            } else if (mode === "dual") {
              outName = explicitlyPrefixed ? (prefixed || legacy) : legacy;
            } else {
              outName = legacy;
            }
          }

          const outPayload = { ...payload, name: outName };
          const body = JSON.stringify(outPayload);

          const headers: Record<string, string> = {
            "content-type": "application/json",
            "x-app-id": String(appId),
            "x-app-event": String(outName || ""),
            "x-app-delivery-id": String(payload?.id || ""),
          };

          const secret = typeof h.secret === "string" ? h.secret : "";
          if (secret) {
            const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
            headers["x-app-signature"] = sig;
          }

          await fetch(String(h.url), {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      }),
    );
  } catch {
    // Best-effort; ignore.
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated?.() && req.user) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

function isHttpishUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeImportedLink(hrefRaw: string, baseUrl: string): string | null {
  const href = (hrefRaw || "").trim();
  if (!href) return null;
  if (href.startsWith("#")) return null;
  const lower = href.toLowerCase();
  if (lower.startsWith("mailto:") || lower.startsWith("tel:") || lower.startsWith("javascript:")) return null;

  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    const s = url.toString();
    if (s.length > 2000) return null;
    return s;
  } catch {
    return null;
  }
}

function stripHtml(s: string) {
  return (s || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rankLink(urlStr: string): number {
  try {
    const u = new URL(urlStr);
    const path = (u.pathname || "/").toLowerCase();
    if (path === "/" || path === "") return 1000;

    let score = 0;
    const keywords: Array<[RegExp, number]> = [
      [/\b(pricing|plans|subscribe)\b/, 80],
      [/\b(about|company|team|careers)\b/, 70],
      [/\b(contact|support|help|faq)\b/, 70],
      [/\b(services|service|solutions)\b/, 60],
      [/\b(products|product|catalog|shop|store)\b/, 60],
      [/\b(blog|news|articles)\b/, 40],
      [/\b(login|signin|signup|register)\b/, 25],
    ];
    for (let i = 0; i < keywords.length; i++) {
      const [re, w] = keywords[i];
      if (re.test(path)) score += w;
    }
    score -= Math.min(30, path.split("/").filter(Boolean).length * 5);
    return score;
  } catch {
    return 0;
  }
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
  const rateLimitJsonHandler = (req: any, res: any) => {
    res.status(429).json({ message: "Too many requests", requestId: req.requestId });
  };

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitJsonHandler,
  });

  // Payments & webhooks
  const paymentsVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => getAuthedUser(req)?.id || req.ip || "unknown",
    handler: rateLimitJsonHandler,
  });

  const razorpayWebhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.ip || "unknown",
    handler: rateLimitJsonHandler,
  });

  // Build abuse control (per user)
  const buildLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => getAuthedUser(req)?.id || req.ip || "unknown",
    handler: rateLimitJsonHandler,
  });

  const unsplashLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const playOauthLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => getAuthedUser(req)?.id || req.ip || "unknown",
  });

  const publishLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 6,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => getAuthedUser(req)?.id || req.ip || "unknown",
    handler: rateLimitJsonHandler,
  });

  // Lightweight per-customer fixed-window abuse limiter for runtime create flows.
  // Keyed by appId:customerId to avoid IP-only bypass.
  const runtimeCreateWindows = new Map<string, { count: number; resetAtMs: number }>();
  function enforceRuntimeCreateLimit(key: string, opts: { windowMs: number; limit: number }) {
    const now = Date.now();
    const existing = runtimeCreateWindows.get(key);
    if (!existing || now >= existing.resetAtMs) {
      const next = { count: 1, resetAtMs: now + opts.windowMs };
      runtimeCreateWindows.set(key, next);
      return { ok: true as const, remaining: Math.max(0, opts.limit - 1) };
    }
    if (existing.count >= opts.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
      return { ok: false as const, retryAfterSec };
    }
    existing.count += 1;
    return { ok: true as const, remaining: Math.max(0, opts.limit - existing.count) };
  }

  // Small in-memory cache for same-origin image proxies.
  // This avoids repeated upstream downloads while keeping client responses cacheable.
  const imageResponseCache = new MemoryCache({
    maxEntries: Number(process.env.IMAGE_CACHE_MAX_ENTRIES || 250),
    defaultTtlMs: Number(process.env.IMAGE_CACHE_TTL_MS || 7 * 24 * 60 * 60 * 1000),
  });

  const playService = createPlayService({ storage, artifactsRoot: safeArtifactsRoot() });
  const { playPublisher } = playService;
  const { withPlayPublishLock, resolvePlayCredentialsForApp } = playService;

  app.get("/api/health", async (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString(), uptimeSec: Math.floor(process.uptime()) });
  });

  // Liveness: process is up.
  app.get("/api/health/live", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // Readiness: dependencies reachable (DB when STORAGE=mysql).
  app.get("/api/health/ready", async (_req, res) => {
    try {
      if (String(process.env.STORAGE || "").toLowerCase() === "mysql") {
        const pool = getMysqlPool();
        await pool.query("SELECT 1");
      }
      return res.json({ ok: true, time: new Date().toISOString() });
    } catch (err: any) {
      return res.status(503).json({ ok: false, message: "Not ready", details: err?.message || String(err) });
    }
  });

  // Secure Unsplash proxy (keeps UNSPLASH_ACCESS_KEY server-side)
  app.get("/api/unsplash/image", requireAuth, unsplashLimiter, async (req, res) => {
    const key = String(process.env.UNSPLASH_ACCESS_KEY || "").trim();
    if (!key) return res.status(503).json({ message: "Unsplash is not configured" });

    const parsed = z
      .object({
        query: z.string().min(1).max(80),
        w: z.coerce.number().int().min(200).max(2000).optional(),
        orientation: z.enum(["landscape", "portrait", "squarish"]).optional(),
        variant: z.enum(["hero", "card", "generic"]).optional(),
      })
      .safeParse(req.query);

    if (!parsed.success) return res.status(400).json({ message: "Invalid query" });
    const q = parsed.data.query.trim();
    const w = parsed.data.w ?? 1200;
    const orientation =
      parsed.data.orientation ??
      (parsed.data.variant === "hero" ? "landscape" : parsed.data.variant === "card" ? "squarish" : "portrait");

    try {
      const upstream = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=${encodeURIComponent(orientation)}`,
        {
          headers: {
            Authorization: `Client-ID ${key}`,
            "Accept-Version": "v1",
          },
        },
      );

      if (!upstream.ok) {
        return res.status(502).json({ message: `Unsplash error (${upstream.status})` });
      }

      const json: any = await upstream.json();
      const photo = Array.isArray(json?.results) ? json.results[0] : null;
      if (!photo) return res.status(404).json({ message: "No image found" });

      const rawUrl = String(photo?.urls?.raw || photo?.urls?.regular || "");
      const sep = rawUrl.includes("?") ? "&" : "?";
      const url = rawUrl ? `${rawUrl}${sep}w=${w}&auto=format&fit=crop` : "";

      // Best-effort download tracking (Unsplash API guideline)
      const downloadLocation = String(photo?.links?.download_location || "");
      if (downloadLocation) {
        fetch(downloadLocation, {
          headers: {
            Authorization: `Client-ID ${key}`,
            "Accept-Version": "v1",
          },
        }).catch(() => null);
      }

      res.setHeader("Cache-Control", "private, max-age=86400");
      return res.json({
        url,
        alt: photo?.alt_description ?? photo?.description ?? q,
        credit: {
          name: photo?.user?.name ?? "Unsplash",
          url: photo?.user?.links?.html ?? "https://unsplash.com",
        },
      });
    } catch {
      return res.status(502).json({ message: "Unsplash request failed" });
    }
  });

  // Unsplash -> image bytes proxy (same-origin), for templates that need relevant images.
  // Returns an actual image response instead of JSON.
  app.get("/api/unsplash/proxy", requireAuth, unsplashLimiter, async (req, res) => {
    const key = String(process.env.UNSPLASH_ACCESS_KEY || "").trim();
    if (!key) return res.status(503).json({ message: "Unsplash is not configured" });

    const parsed = z
      .object({
        query: z.string().min(1).max(80),
        w: z.coerce.number().int().min(200).max(2000).optional(),
        orientation: z.enum(["landscape", "portrait", "squarish"]).optional(),
      })
      .safeParse(req.query);

    if (!parsed.success) return res.status(400).json({ message: "Invalid query" });
    const q = parsed.data.query.trim();
    const w = parsed.data.w ?? 900;
    const orientation = parsed.data.orientation ?? "squarish";

    const cacheKey = `unsplash-proxy:${q.toLowerCase()}:${w}:${orientation}`;
    const cached = imageResponseCache.get(cacheKey);
    if (cached) {
      const inm = String(req.headers["if-none-match"] || "").trim();
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "private, max-age=604800");
      res.setHeader("ETag", cached.etag);
      if (inm && inm === cached.etag) return res.status(304).end();
      return res.status(200).send(cached.body);
    }

    try {
      const searchRes = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=${encodeURIComponent(orientation)}`,
        {
          headers: {
            Authorization: `Client-ID ${key}`,
            "Accept-Version": "v1",
          },
        },
      );

      if (!searchRes.ok) {
        return res.status(502).json({ message: `Unsplash error (${searchRes.status})` });
      }

      const json: any = await searchRes.json();
      const photo = Array.isArray(json?.results) ? json.results[0] : null;
      if (!photo) return res.status(404).json({ message: "No image found" });

      const rawUrl = String(photo?.urls?.raw || photo?.urls?.regular || "");
      if (!rawUrl) return res.status(404).json({ message: "No image found" });

      const sep = rawUrl.includes("?") ? "&" : "?";
      const imgUrl = `${rawUrl}${sep}w=${w}&auto=format&fit=crop`;

      // Best-effort download tracking (Unsplash API guideline)
      const downloadLocation = String(photo?.links?.download_location || "");
      if (downloadLocation) {
        fetch(downloadLocation, {
          headers: {
            Authorization: `Client-ID ${key}`,
            "Accept-Version": "v1",
          },
        }).catch(() => null);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const upstream = await fetch(imgUrl, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "SaaS-Architect/1.0 (+unsplash-proxy)",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      }).finally(() => clearTimeout(timeout));

      if (!upstream.ok) {
        return res.status(502).json({ message: `Upstream image error (${upstream.status})` });
      }

      const contentType = String(upstream.headers.get("content-type") || "");
      if (!contentType.toLowerCase().startsWith("image/")) {
        return res.status(415).json({ message: "Upstream is not an image" });
      }

      const arrayBuffer = await upstream.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      if (buf.length > 6 * 1024 * 1024) {
        return res.status(413).json({ message: "Image too large" });
      }

      const stored = imageResponseCache.set(cacheKey, {
        body: buf,
        contentType,
        ttlMs: Number(process.env.IMAGE_CACHE_TTL_MS || 7 * 24 * 60 * 60 * 1000),
      });

      res.setHeader("Content-Type", stored.contentType);
      res.setHeader("Cache-Control", "private, max-age=604800");
      res.setHeader("ETag", stored.etag);
      return res.status(200).send(stored.body);
    } catch (err: any) {
      const msg = String(err?.name || "").includes("Abort") ? "Upstream timeout" : "Unsplash request failed";
      return res.status(502).json({ message: msg });
    }
  });

  // Server-side image proxy (avoid client-side blocking / hotlink rules).
  // NOTE: allowlist only, to prevent SSRF.
  app.get("/api/image-proxy", requireAuth, async (req, res) => {
    const parsed = z
      .object({
        url: z.string().url().max(2000),
      })
      .safeParse(req.query);

    if (!parsed.success) return res.status(400).json({ message: "Invalid url" });

    let target: URL;
    try {
      target = new URL(parsed.data.url);
    } catch {
      return res.status(400).json({ message: "Invalid url" });
    }

    if (target.protocol !== "https:") {
      return res.status(400).json({ message: "Only https URLs are allowed" });
    }

    const allowedHosts = new Set([
      "images.unsplash.com",
      "plus.unsplash.com",
      "source.unsplash.com",
      "picsum.photos",
    ]);

    if (!allowedHosts.has(target.hostname)) {
      return res.status(403).json({ message: "Host not allowed" });
    }

    const cacheKey = `image-proxy:${target.toString()}`;
    const cached = imageResponseCache.get(cacheKey);
    if (cached) {
      const inm = String(req.headers["if-none-match"] || "").trim();
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "private, max-age=604800");
      res.setHeader("ETag", cached.etag);
      if (inm && inm === cached.etag) return res.status(304).end();
      return res.status(200).send(cached.body);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const upstream = await fetch(target.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          // Some CDNs are picky; a normal UA helps.
          "User-Agent": "SaaS-Architect/1.0 (+image-proxy)",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      }).finally(() => clearTimeout(timeout));

      if (!upstream.ok) {
        return res.status(502).json({ message: `Upstream error (${upstream.status})` });
      }

      const contentType = String(upstream.headers.get("content-type") || "");
      if (!contentType.toLowerCase().startsWith("image/")) {
        return res.status(415).json({ message: "Upstream is not an image" });
      }

      const arrayBuffer = await upstream.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      // Safety limit (prevents very large downloads)
      if (buf.length > 6 * 1024 * 1024) {
        return res.status(413).json({ message: "Image too large" });
      }

      const stored = imageResponseCache.set(cacheKey, {
        body: buf,
        contentType,
        ttlMs: Number(process.env.IMAGE_CACHE_TTL_MS || 7 * 24 * 60 * 60 * 1000),
      });

      res.setHeader("Content-Type", stored.contentType);
      res.setHeader("Cache-Control", "private, max-age=604800");
      res.setHeader("ETag", stored.etag);
      return res.status(200).send(stored.body);
    } catch (err: any) {
      const msg = String(err?.name || "").includes("Abort") ? "Upstream timeout" : "Upstream request failed";
      return res.status(502).json({ message: msg });
    }
  });

  app.get("/api/me", (req, res) => {
    const user = getAuthedUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    return res.json(sanitizeUser(user));
  });

  // --- Product analytics (conversion funnel; best-effort) ---
  app.post("/api/analytics/track", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const schema = z
        .object({
          name: z.string().min(1).max(64),
          properties: z.record(z.any()).optional(),
        })
        .strict();

      const { name, properties } = schema.parse(req.body);

      await storage.createAuditLog({
        userId: user.id,
        action: name,
        targetType: "analytics",
        targetId: null,
        metadata: properties ?? null,
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
      });

      return res.status(201).json({ ok: true });
    } catch (err) {
      // Best-effort: never block user flows on analytics.
      try {
        return res.status(201).json({ ok: true });
      } catch {
        return next(err);
      }
    }
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
        metadata: { 
          assigneeId, 
          previousAssignee: existing.assignedTo,
          ticketSubject: existing.subject 
        },
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
        metadata: { ticketSubject: existing.subject },
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

  // Delete ticket (staff only, must be closed)
  app.delete("/api/support/tickets/:id", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user || !isStaff(user)) return res.status(403).json({ message: "Staff access required" });

      const existing = await storage.getSupportTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });

      // Only allow deletion of closed tickets
      if (existing.status !== "closed") {
        return res.status(400).json({ message: "Only closed tickets can be deleted" });
      }

      await storage.deleteSupportTicket(existing.id);
      
      // Log the deletion
      await storage.createAuditLog({
        userId: user.id,
        action: "ticket_deleted",
        targetType: "ticket",
        targetId: existing.id,
        metadata: { 
          ticketSubject: existing.subject,
          requesterId: existing.requesterId,
        },
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
      });

      return res.json({ success: true, message: "Ticket deleted" });
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

  // ===== TICKET MESSAGES (Conversation Thread) =====

  // Get all messages for a ticket
  app.get("/api/support/tickets/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      // Only ticket owner or staff can view messages
      const staff = isStaff(user);
      if (!staff && ticket.requesterId !== user.id) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Staff can see internal notes, users cannot
      const messages = await storage.listTicketMessages(req.params.id, staff);
      
      // Enrich with sender info
      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        const sender = await storage.getUser(msg.senderId);
        return {
          ...msg,
          senderName: sender?.name || sender?.username || "Unknown",
          senderUsername: sender?.username,
        };
      }));

      return res.json(enrichedMessages);
    } catch (err) {
      return next(err);
    }
  });

  // Add a message/reply to a ticket
  app.post("/api/support/tickets/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      // Only ticket owner or staff can reply
      const staff = isStaff(user);
      if (!staff && ticket.requesterId !== user.id) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      const payload = insertTicketMessageSchema.parse({
        ...req.body,
        ticketId: req.params.id,
      });

      // Users cannot send internal messages
      if (!staff && payload.isInternal) {
        return res.status(403).json({ message: "Only staff can send internal notes" });
      }

      const senderRole = staff ? "staff" : "user";
      const message = await storage.createTicketMessage(user.id, senderRole, payload);

      // Update ticket status based on who's replying
      if (staff && !payload.isInternal) {
        // Staff replied, waiting for user
        if (ticket.status !== "closed") {
          await storage.updateSupportTicketStatus(ticket.id, "waiting_user");
        }
      } else if (!staff) {
        // User replied
        if (ticket.status === "waiting_user") {
          await storage.updateSupportTicketStatus(ticket.id, "in_progress");
        } else if (ticket.status === "closed" || ticket.status === "resolved") {
          // Reopen if user replies to closed/resolved ticket
          await storage.reopenTicket(ticket.id);
        }
      }

      // Log the reply
      await storage.createAuditLog({
        userId: user.id,
        action: payload.isInternal ? "ticket_internal_note" : "ticket_reply",
        targetType: "ticket",
        targetId: ticket.id,
        metadata: { 
          ticketSubject: ticket.subject,
          messagePreview: payload.message.substring(0, 100),
        },
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
      });

      // Enrich with sender info for response
      const enrichedMessage = {
        ...message,
        senderName: user.name || user.username,
        senderUsername: user.username,
      };

      return res.status(201).json(enrichedMessage);
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

  // ============================================
  // Google Play OAuth (Phase 2)
  // ============================================

  const getPlayOauthRedirectUrl = (req: any) => {
    const env = typeof process.env.GOOGLE_PLAY_OAUTH_REDIRECT_URL === "string" ? process.env.GOOGLE_PLAY_OAUTH_REDIRECT_URL.trim() : "";
    if (env) return env;

    const proto = (req.headers["x-forwarded-proto"] as string | undefined) || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string | undefined) || req.get("host");
    return `${proto}://${host}/auth/google/play/callback`;
  };

  const buildPlayOauthClient = (redirectUrl: string) => {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth is not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)");
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
  };

  const playScope = "https://www.googleapis.com/auth/androidpublisher";

  const clearPlayOauthSession = (req: any) => {
    try {
      const sess = (req as any).session;
      if (sess?.playOauth) sess.playOauth = null;
    } catch {
      // ignore
    }
  };

  const startPlayOauth = (req: any, res: any) => {
    const user = getAuthedUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (!isGoogleConfigured()) {
      return res.status(503).json({ message: "Google OAuth is not configured" });
    }

    const returnTo = safeReturnTo(req.query.returnTo);
    const redirectUrl = getPlayOauthRedirectUrl(req);
    const oauth2 = buildPlayOauthClient(redirectUrl);

    const nonce = crypto.randomBytes(16).toString("hex");
    (req as any).session.playOauth = {
      nonce,
      returnTo,
      createdAt: Date.now(),
    };

    const authUrl = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [playScope],
      state: nonce,
      include_granted_scopes: true,
    });

    return res.redirect(authUrl);
  };

  app.get("/auth/google/play", requireAuth, playOauthLimiter, startPlayOauth);
  // Alias (some deployments route all auth under /api)
  app.get("/api/auth/google/play", requireAuth, playOauthLimiter, startPlayOauth);

  const playOauthCallback = async (req: any, res: any, next: any) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const sess = (req as any).session;
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const stored = sess?.playOauth;

      const returnTo = safeReturnTo(stored?.returnTo);
      const maxAgeMs = 15 * 60 * 1000;
      const createdAtMs = typeof stored?.createdAt === "number" ? stored.createdAt : 0;
      const expired = !createdAtMs || Date.now() - createdAtMs > maxAgeMs;

      if (!stored?.nonce || state !== stored.nonce || expired) {
        clearPlayOauthSession(req);
        return res.redirect(`/dashboard?error=play_oauth_state`);
      }
      if (!code) {
        clearPlayOauthSession(req);
        return res.redirect(`${returnTo}?error=play_oauth_code`);
      }

      const redirectUrl = getPlayOauthRedirectUrl(req);
      const oauth2 = buildPlayOauthClient(redirectUrl);

      const tokenResp = await oauth2.getToken(code);
      const refresh = String(tokenResp.tokens.refresh_token || "").trim();

      if (refresh) {
        const tokenEnc = encryptToken(refresh);
        await storage.setUserPlayRefreshTokenEnc(user.id, tokenEnc);
      } else {
        // Google often only returns refresh_token the *first* time the user consents.
        // If we already have a stored refresh token, treat this as success.
        const freshUser = await storage.getUser(user.id);
        const existingEnc = typeof (freshUser as any)?.playRefreshTokenEnc === "string" ? String((freshUser as any).playRefreshTokenEnc).trim() : "";
        if (!existingEnc) {
          clearPlayOauthSession(req);
          return res.redirect(`${returnTo}?error=play_oauth_no_refresh`);
        }
      }

      storage.createAuditLog({
        userId: user.id,
        action: "user.play.connected",
        targetType: "user",
        targetId: user.id,
        metadata: { scopes: [playScope] },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});

      // Clear state
      clearPlayOauthSession(req);

      return res.redirect(`${returnTo}?play=connected`);
    } catch (err) {
      clearPlayOauthSession(req);
      return next(err);
    }
  };

  app.get("/auth/google/play/callback", requireAuth, playOauthLimiter, playOauthCallback);
  app.get("/api/auth/google/play/callback", requireAuth, playOauthLimiter, playOauthCallback);

  app.get("/api/auth/google/play/status", requireAuth, async (req, res) => {
    const user = getAuthedUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const fresh = await storage.getUser(user.id);
    const enc = typeof (fresh as any)?.playRefreshTokenEnc === "string" ? String((fresh as any).playRefreshTokenEnc).trim() : "";
    const connectedAt = (fresh as any)?.playConnectedAt ?? null;
    return res.json({ connected: !!enc, connectedAt });
  });

  app.post("/api/auth/google/play/disconnect", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      await storage.setUserPlayRefreshTokenEnc(user.id, null);

      storage.createAuditLog({
        userId: user.id,
        action: "user.play.disconnected",
        targetType: "user",
        targetId: user.id,
        metadata: {},
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/auth/google/play/validate", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const fresh = await storage.getUser(user.id);
      const enc = typeof (fresh as any)?.playRefreshTokenEnc === "string" ? String((fresh as any).playRefreshTokenEnc).trim() : "";
      if (!enc) return res.status(409).json({ ok: false, message: "No Play account connected" });

      let refreshToken: string;
      try {
        refreshToken = decryptToken(enc);
      } catch (err: any) {
        return res.status(503).json({ ok: false, message: "Play token encryption is not configured", details: err?.message || String(err) });
      }

      const result = await playPublisher.validatePlayConnection({ type: "user", oauthRefreshToken: refreshToken });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

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
        industry: (appItem as any).industry ?? null,
        isNativeOnly: (appItem as any).isNativeOnly ?? false,
        editorScreens: (appItem as any).editorScreens ?? null,
        status: appItem.status,
      });
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (end-user) auth ---
  app.post("/api/runtime/:appId/auth/register", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Runtime auth requires MySQL storage" });
      }

      const schema = z
        .object({
          email: z.string().email().max(320),
          password: z.string().min(8).max(200),
          name: z.string().min(1).max(200).optional(),
        })
        .strict();

      const { email, password, name } = schema.parse(req.body);
      const db = getMysqlDb();

      const existing = await db
        .select()
        .from(appCustomers)
        .where(and(eq(appCustomers.appId, appId), eq(appCustomers.email, email.toLowerCase())))
        .limit(1);
      if (existing[0]) {
        return res.status(409).json({ message: "Account already exists" });
      }

      const id = crypto.randomUUID();
      const now = new Date();
      const hashed = await hashPassword(password);
      await db.insert(appCustomers).values({
        id,
        appId,
        email: email.toLowerCase(),
        password: hashed,
        role: "customer",
        name: name ?? null,
        createdAt: now,
        updatedAt: now,
      } as any);

      const ev = authEvents(emitAppEvent);
      await ev.customerSignup(appId, id, { email: email.toLowerCase() });

      const token = signRuntimeToken(appId, { sub: id, role: "customer" });
      return res.status(201).json({
        token,
        customer: { id, appId, email: email.toLowerCase(), role: "customer", name: name ?? null },
      });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/runtime/:appId/auth/login", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Runtime auth requires MySQL storage" });
      }

      const schema = z
        .object({
          email: z.string().email().max(320),
          password: z.string().min(1).max(200),
        })
        .strict();

      const { email, password } = schema.parse(req.body);
      const db = getMysqlDb();

      const rows = await db
        .select()
        .from(appCustomers)
        .where(and(eq(appCustomers.appId, appId), eq(appCustomers.email, email.toLowerCase())))
        .limit(1);
      const row: any = rows[0];
      if (!row) return res.status(401).json({ message: "Invalid credentials" });

      const ok = await verifyPassword(password, row.password);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });

      const ev = authEvents(emitAppEvent);
      await ev.customerLogin(appId, String(row.id), { email: row.email });
      const token = signRuntimeToken(appId, { sub: row.id, role: row.role || "customer" });
      return res.json({
        token,
        customer: { id: row.id, appId, email: row.email, role: row.role || "customer", name: row.name ?? null },
      });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/auth/me", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Runtime auth requires MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appCustomers)
        .where(and(eq(appCustomers.appId, appId), eq(appCustomers.id, String(payload.sub))))
        .limit(1);
      const row: any = rows[0];
      if (!row) return res.status(401).json({ message: "Unauthorized" });

      return res.json({ id: row.id, appId, email: row.email, role: row.role || "customer", name: row.name ?? null });
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (optional) analytics events ---
  app.post("/api/runtime/:appId/events", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      const schema = z
        .object({
          name: z.string().min(1).max(64),
          properties: z.any().optional(),
        })
        .strict();
      const { name, properties } = schema.parse(req.body);

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      const customerId = payload?.sub ? String(payload.sub) : null;

      await emitAppEvent(appId, customerId, name, properties);
      return res.status(201).json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (public) products ---
  app.get("/api/runtime/:appId/products", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Catalog requires MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appProducts)
        .where(and(eq(appProducts.appId, appId), eq(appProducts.active, 1)))
        .orderBy(desc(appProducts.updatedAt));

      return res.json(
        rows.map((p: any) => ({
          id: p.id,
          appId: p.appId,
          name: p.name,
          description: p.description ?? "",
          imageUrl: p.imageUrl ?? null,
          currency: p.currency ?? "INR",
          priceCents: Number(p.priceCents || 0),
          active: p.active === 1 || p.active === true,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (public) salon services ---
  app.get("/api/runtime/:appId/services", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Services require MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appServices)
        .where(and(eq(appServices.appId, appId), eq(appServices.active, 1)))
        .orderBy(desc(appServices.updatedAt));

      return res.json(
        rows.map((s: any) => ({
          id: s.id,
          appId: s.appId,
          name: s.name,
          description: s.description ?? "",
          imageUrl: s.imageUrl ?? null,
          currency: s.currency ?? "INR",
          priceCents: Number(s.priceCents || 0),
          durationMinutes: Number(s.durationMinutes || 30),
          active: s.active === 1 || s.active === true,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (public) posts (news/church/business/music) ---
  app.get("/api/runtime/:appId/posts", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Posts require MySQL storage" });
      }

      const type = String(req.query.type || "").trim().toLowerCase();
      const category = String(req.query.category || "").trim();

      const db = getMysqlDb();
      const where = [eq(appPosts.appId, appId), eq(appPosts.active, 1)] as any[];
      if (type) where.push(eq(appPosts.type, type));
      if (category) where.push(eq(appPosts.category, category));

      const rows = await db
        .select()
        .from(appPosts)
        .where(and(...where))
        .orderBy(desc(appPosts.publishedAt), desc(appPosts.updatedAt));

      return res.json(
        rows.map((p: any) => ({
          id: p.id,
          type: p.type,
          title: p.title,
          excerpt: p.excerpt ?? "",
          content: p.content ?? "",
          imageUrl: p.imageUrl ?? null,
          category: p.category ?? null,
          publishedAt: p.publishedAt ? (p.publishedAt instanceof Date ? p.publishedAt.toISOString() : String(p.publishedAt)) : null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (customer) post bookmarks (news) ---
  app.post("/api/runtime/:appId/posts/:postId/bookmark", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const postId = String(req.params.postId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Bookmarks require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const schema = z.object({ on: z.boolean().optional().default(true) }).strict();
      const { on } = schema.parse(req.body ?? {});

      const db = getMysqlDb();
      const existing = await db
        .select({ id: appPostBookmarks.id })
        .from(appPostBookmarks)
        .where(and(eq(appPostBookmarks.appId, appId), eq(appPostBookmarks.customerId, String(payload.sub)), eq(appPostBookmarks.postId, postId)))
        .limit(1);

      if (on) {
        if (!existing.length) {
          await db.insert(appPostBookmarks).values({
            id: crypto.randomUUID(),
            appId,
            customerId: String(payload.sub),
            postId,
            createdAt: new Date(),
          } as any);
        }
      } else {
        if (existing.length) {
          await db
            .delete(appPostBookmarks)
            .where(and(eq(appPostBookmarks.appId, appId), eq(appPostBookmarks.customerId, String(payload.sub)), eq(appPostBookmarks.postId, postId)));
        }
      }

      return res.json({ ok: true, bookmarked: on });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/bookmarks", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Bookmarks require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const db = getMysqlDb();
      const rows = await db
        .select({
          id: appPosts.id,
          type: appPosts.type,
          title: appPosts.title,
          excerpt: appPosts.excerpt,
          imageUrl: appPosts.imageUrl,
          category: appPosts.category,
          publishedAt: appPosts.publishedAt,
        })
        .from(appPostBookmarks)
        .leftJoin(appPosts, and(eq(appPosts.appId, appId), eq(appPosts.id, appPostBookmarks.postId)))
        .where(and(eq(appPostBookmarks.appId, appId), eq(appPostBookmarks.customerId, String(payload.sub))))
        .orderBy(desc(appPostBookmarks.createdAt));

      return res.json(
        rows
          .filter((r: any) => !!r.id)
          .map((p: any) => ({
            id: p.id,
            type: p.type,
            title: p.title,
            excerpt: p.excerpt ?? "",
            imageUrl: p.imageUrl ?? null,
            category: p.category ?? null,
            publishedAt: p.publishedAt ? (p.publishedAt instanceof Date ? p.publishedAt.toISOString() : String(p.publishedAt)) : null,
          })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (restaurant) reservations ---
  app.post("/api/runtime/:appId/reservations", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Reservations require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const limit = enforceRuntimeCreateLimit(`${appId}:${String(payload.sub)}:reservations`, { windowMs: 60 * 1000, limit: 5 });
      if (!limit.ok) {
        res.setHeader("Retry-After", String(limit.retryAfterSec));
        return res.status(429).json({ message: "Too many requests", requestId: (req as any).requestId });
      }

      const body = createReservationSchema.parse(req.body);
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = restaurantService({ emit: emitAppEvent, audit });
      const out = await svc.createReservation({
        appId,
        customerId: String(payload.sub),
        partySize: body.partySize,
        reservedAtIso: body.reservedAt,
        durationMinutes: body.durationMinutes,
        tableId: body.tableId,
        notes: body.notes,
      });

      return res.status(201).json({ id: out.id, status: out.status });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/reservations", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Reservations require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const svc = restaurantService({ emit: emitAppEvent });
      const rows = await svc.listReservationsForCustomer({ appId, customerId: String(payload.sub) });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (fitness) classes + bookings ---
  app.get("/api/runtime/:appId/classes", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Classes require MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appFitnessClasses)
        .where(and(eq(appFitnessClasses.appId, appId), eq(appFitnessClasses.active, 1)))
        .orderBy(asc(appFitnessClasses.startsAt));

      return res.json(
        rows.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? "",
          startsAt: c.startsAt instanceof Date ? c.startsAt.toISOString() : String(c.startsAt),
          endsAt: c.endsAt instanceof Date ? c.endsAt.toISOString() : String(c.endsAt),
          capacity: Number(c.capacity || 0),
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/runtime/:appId/classes/:classId/book", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const classId = String(req.params.classId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Class booking requires MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const db = getMysqlDb();
      const existing = await db
        .select({ id: appFitnessBookings.id })
        .from(appFitnessBookings)
        .where(and(eq(appFitnessBookings.appId, appId), eq(appFitnessBookings.customerId, String(payload.sub)), eq(appFitnessBookings.classId, classId)))
        .limit(1);
      if (existing.length) return res.status(409).json({ message: "Already booked" });

      const classRows = await db
        .select()
        .from(appFitnessClasses)
        .where(and(eq(appFitnessClasses.appId, appId), eq(appFitnessClasses.id, classId)))
        .limit(1);
      const klass: any = classRows[0];
      if (!klass || !(klass.active === 1 || klass.active === true)) {
        return res.status(400).json({ message: "Invalid class" });
      }

      const id = crypto.randomUUID();
      await db.insert(appFitnessBookings).values({
        id,
        appId,
        customerId: String(payload.sub),
        classId,
        status: "booked",
        createdAt: new Date(),
      } as any);

      const ev = fitnessEvents(emitAppEvent);
      await ev.classBooked(appId, String(payload.sub), { bookingId: id, classId });
      return res.status(201).json({ id, status: "booked" });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/class-bookings", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Class booking requires MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const db = getMysqlDb();
      const rows = await db
        .select({
          id: appFitnessBookings.id,
          status: appFitnessBookings.status,
          createdAt: appFitnessBookings.createdAt,
          classId: appFitnessBookings.classId,
          className: appFitnessClasses.name,
          startsAt: appFitnessClasses.startsAt,
        })
        .from(appFitnessBookings)
        .leftJoin(appFitnessClasses, and(eq(appFitnessClasses.appId, appId), eq(appFitnessClasses.id, appFitnessBookings.classId)))
        .where(and(eq(appFitnessBookings.appId, appId), eq(appFitnessBookings.customerId, String(payload.sub))))
        .orderBy(desc(appFitnessBookings.createdAt));

      return res.json(
        rows.map((b: any) => ({
          id: b.id,
          status: b.status,
          classId: b.classId,
          className: b.className ?? null,
          startsAt: b.startsAt ? (b.startsAt instanceof Date ? b.startsAt.toISOString() : String(b.startsAt)) : null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (education) courses + enrollments ---
  app.get("/api/runtime/:appId/courses", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Courses require MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appCourses)
        .where(and(eq(appCourses.appId, appId), eq(appCourses.active, 1)))
        .orderBy(desc(appCourses.updatedAt));

      return res.json(
        rows.map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description ?? "",
          imageUrl: c.imageUrl ?? null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/courses/:courseId/lessons", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const courseId = String(req.params.courseId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Lessons require MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appCourseLessons)
        .where(and(eq(appCourseLessons.appId, appId), eq(appCourseLessons.courseId, courseId)))
        .orderBy(asc(appCourseLessons.sortOrder), asc(appCourseLessons.createdAt));

      return res.json(
        rows.map((l: any) => ({
          id: l.id,
          courseId: l.courseId,
          title: l.title,
          contentUrl: l.contentUrl ?? null,
          sortOrder: Number(l.sortOrder || 0),
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/runtime/:appId/courses/:courseId/enroll", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const courseId = String(req.params.courseId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Enrollments require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const db = getMysqlDb();
      const existing = await db
        .select({ id: appCourseEnrollments.id })
        .from(appCourseEnrollments)
        .where(and(eq(appCourseEnrollments.appId, appId), eq(appCourseEnrollments.customerId, String(payload.sub)), eq(appCourseEnrollments.courseId, courseId)))
        .limit(1);
      if (existing.length) return res.status(409).json({ message: "Already enrolled" });

      const id = crypto.randomUUID();
      await db.insert(appCourseEnrollments).values({
        id,
        appId,
        customerId: String(payload.sub),
        courseId,
        status: "enrolled",
        createdAt: new Date(),
      } as any);

      const ev = coursesEvents(emitAppEvent);
      await ev.courseEnrolled(appId, String(payload.sub), { enrollmentId: id, courseId });
      return res.status(201).json({ id, status: "enrolled" });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/enrollments", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Enrollments require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const db = getMysqlDb();
      const rows = await db
        .select({
          id: appCourseEnrollments.id,
          status: appCourseEnrollments.status,
          courseId: appCourseEnrollments.courseId,
          courseTitle: appCourses.title,
          createdAt: appCourseEnrollments.createdAt,
        })
        .from(appCourseEnrollments)
        .leftJoin(appCourses, and(eq(appCourses.appId, appId), eq(appCourses.id, appCourseEnrollments.courseId)))
        .where(and(eq(appCourseEnrollments.appId, appId), eq(appCourseEnrollments.customerId, String(payload.sub))))
        .orderBy(desc(appCourseEnrollments.createdAt));

      return res.json(
        rows.map((e: any) => ({
          id: e.id,
          status: e.status,
          courseId: e.courseId,
          courseTitle: e.courseTitle ?? null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (real estate) listings + inquiries + saved ---
  app.get("/api/runtime/:appId/listings", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Listings require MySQL storage" });
      }

      const svc = realEstateService({ emit: emitAppEvent });
      const rows = await svc.listActiveListings({ appId });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/runtime/:appId/listings/:listingId/inquiries", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const listingId = String(req.params.listingId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Inquiries require MySQL storage" });
      }

      const body = createInquirySchema.parse(req.body ?? {});

      // customer token optional
      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;

      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = realEstateService({ emit: emitAppEvent, audit });
      const out = await svc.createInquiry({
        appId,
        listingId,
        customerId: payload?.sub ? String(payload.sub) : null,
        name: body.name,
        email: body.email,
        phone: body.phone,
        message: body.message,
      });

      return res.status(201).json({ id: out.id });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/runtime/:appId/saved", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Saved items require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const schema = z
        .object({
          kind: z.string().min(1).max(24).default("listing"),
          itemId: z.string().min(1),
          on: z.boolean().optional().default(true),
        })
        .strict();
      const { kind, itemId, on } = schema.parse(req.body);

      const db = getMysqlDb();
      const existing = await db
        .select({ id: appSavedItems.id })
        .from(appSavedItems)
        .where(and(eq(appSavedItems.appId, appId), eq(appSavedItems.customerId, String(payload.sub)), eq(appSavedItems.kind, kind), eq(appSavedItems.itemId, itemId)))
        .limit(1);

      if (on) {
        if (!existing.length) {
          await db.insert(appSavedItems).values({
            id: crypto.randomUUID(),
            appId,
            customerId: String(payload.sub),
            kind,
            itemId,
            createdAt: new Date(),
          } as any);
        }
      } else {
        if (existing.length) {
          await db
            .delete(appSavedItems)
            .where(and(eq(appSavedItems.appId, appId), eq(appSavedItems.customerId, String(payload.sub)), eq(appSavedItems.kind, kind), eq(appSavedItems.itemId, itemId)));
        }
      }

      return res.json({ ok: true, saved: on });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/saved", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Saved items require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appSavedItems)
        .where(and(eq(appSavedItems.appId, appId), eq(appSavedItems.customerId, String(payload.sub))))
        .orderBy(desc(appSavedItems.createdAt));

      return res.json(
        rows.map((s: any) => ({
          id: s.id,
          kind: s.kind,
          itemId: s.itemId,
          createdAt: s.createdAt,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (healthcare) doctors + appointments ---
  app.get("/api/runtime/:appId/doctors", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Doctors require MySQL storage" });
      }

      const svc = healthcareService({ emit: emitAppEvent });
      const rows = await svc.listDoctors({ appId });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/runtime/:appId/doctor-appointments", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Doctor appointments require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const body = createAppointmentSchema.parse(req.body);
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = healthcareService({ emit: emitAppEvent, audit });
      const out = await svc.requestAppointment({
        appId,
        customerId: String(payload.sub),
        doctorId: body.doctorId,
        startAtIso: body.startAt,
        appointmentTypeId: body.appointmentTypeId,
        notes: body.notes,
        patient: body.patient
          ? { name: body.patient.name, email: body.patient.email, phone: body.patient.phone, dobIso: body.patient.dob }
          : undefined,
      });

      return res.status(201).json({ id: out.id, status: out.status });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/doctor-appointments", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Doctor appointments require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const svc = healthcareService({ emit: emitAppEvent });
      const rows = await svc.listAppointmentsForCustomer({ appId, customerId: String(payload.sub) });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (radio) stations + episodes ---
  app.get("/api/runtime/:appId/radio/stations", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Radio requires MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appRadioStations)
        .where(and(eq(appRadioStations.appId, appId), eq(appRadioStations.active, 1)))
        .orderBy(desc(appRadioStations.updatedAt));

      return res.json(
        rows.map((s: any) => ({
          id: s.id,
          name: s.name,
          streamUrl: s.streamUrl,
          imageUrl: s.imageUrl ?? null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/radio/episodes", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Podcasts require MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appPodcastEpisodes)
        .where(eq(appPodcastEpisodes.appId, appId))
        .orderBy(desc(appPodcastEpisodes.publishedAt), desc(appPodcastEpisodes.updatedAt));

      return res.json(
        rows.map((e: any) => ({
          id: e.id,
          showTitle: e.showTitle ?? null,
          title: e.title,
          description: e.description ?? "",
          audioUrl: e.audioUrl ?? null,
          publishedAt: e.publishedAt ? (e.publishedAt instanceof Date ? e.publishedAt.toISOString() : String(e.publishedAt)) : null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (music) albums + tracks ---
  app.get("/api/runtime/:appId/music/albums", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Music requires MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appMusicAlbums)
        .where(eq(appMusicAlbums.appId, appId))
        .orderBy(desc(appMusicAlbums.releasedAt), desc(appMusicAlbums.updatedAt));

      return res.json(
        rows.map((a: any) => ({
          id: a.id,
          title: a.title,
          artist: a.artist ?? "",
          imageUrl: a.imageUrl ?? null,
          releasedAt: a.releasedAt ? (a.releasedAt instanceof Date ? a.releasedAt.toISOString() : String(a.releasedAt)) : null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/music/albums/:albumId/tracks", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const albumId = String(req.params.albumId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Music requires MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appMusicTracks)
        .where(and(eq(appMusicTracks.appId, appId), eq(appMusicTracks.albumId, albumId)))
        .orderBy(asc(appMusicTracks.trackNumber), asc(appMusicTracks.createdAt));

      return res.json(
        rows.map((t: any) => ({
          id: t.id,
          albumId: t.albumId,
          title: t.title,
          trackNumber: Number(t.trackNumber || 1),
          durationSeconds: Number(t.durationSeconds || 0),
          audioUrl: t.audioUrl ?? null,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (business) lead capture ---
  app.post("/api/runtime/:appId/leads", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Leads require MySQL storage" });
      }

      const schema = z
        .object({
          name: z.string().max(200).optional(),
          email: z.string().email().max(320).optional(),
          phone: z.string().max(40).optional(),
          message: z.string().max(5000).optional(),
        })
        .strict();
      const body = schema.parse(req.body ?? {});

      const id = crypto.randomUUID();
      const db = getMysqlDb();
      await db.insert(appLeads).values({
        id,
        appId,
        name: body.name ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        message: body.message ?? null,
        createdAt: new Date(),
      } as any);

      const ev = crmEvents(emitAppEvent);
      await ev.leadCreated(appId, { leadId: id });
      return res.status(201).json({ id });
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (customer) salon appointments ---
  app.post("/api/runtime/:appId/appointments", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Appointments require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const limit = enforceRuntimeCreateLimit(`${appId}:${String(payload.sub)}:appointments`, { windowMs: 60 * 1000, limit: 5 });
      if (!limit.ok) {
        res.setHeader("Retry-After", String(limit.retryAfterSec));
        return res.status(429).json({ message: "Too many requests", requestId: (req as any).requestId });
      }

      const schema = z
        .object({
          serviceId: z.string().min(1),
          startAt: z.string().min(1), // ISO string
          notes: z.string().max(2000).optional(),
          paymentProvider: z.enum(["cod", "razorpay", "stripe"]).optional().default("cod"),
        })
        .strict();
      const { serviceId, startAt, notes, paymentProvider } = schema.parse(req.body);

      const start = new Date(startAt);
      if (Number.isNaN(start.getTime())) return res.status(400).json({ message: "Invalid startAt" });
      // Guardrail: disallow bookings in the past (5 min tolerance).
      if (start.getTime() < Date.now() - 5 * 60 * 1000) {
        return res.status(400).json({ message: "Start time must be in the future" });
      }

      const db = getMysqlDb();
      const serviceRows = await db
        .select()
        .from(appServices)
        .where(and(eq(appServices.appId, appId), eq(appServices.id, serviceId)))
        .limit(1);
      const service: any = serviceRows[0];
      if (!service || !(service.active === 1 || service.active === true)) {
        return res.status(400).json({ message: "Invalid service" });
      }

      const durationMinutes = Number(service.durationMinutes || 30);
      const end = new Date(start.getTime() + Math.max(5, durationMinutes) * 60 * 1000);

      // Basic conflict check: same customer cannot overlap their own appointment.
      const conflicts = await db
        .select({ id: appAppointments.id })
        .from(appAppointments)
        .where(
          and(
            eq(appAppointments.appId, appId),
            eq(appAppointments.customerId, String(payload.sub)),
            sql`NOT (${appAppointments.endAt} <= ${start} OR ${appAppointments.startAt} >= ${end})`,
          ),
        )
        .limit(1);
      if (conflicts.length) {
        return res.status(409).json({ message: "You already have a booking around that time" });
      }

      const id = crypto.randomUUID();
      const now = new Date();
      await db.insert(appAppointments).values({
        id,
        appId,
        customerId: String(payload.sub),
        serviceId,
        status: "requested",
        currency: service.currency ?? "INR",
        priceCents: Number(service.priceCents || 0),
        startAt: start,
        endAt: end,
        notes: notes ?? null,
        paymentProvider,
        paymentStatus: paymentProvider === "cod" ? "completed" : "pending",
        createdAt: now,
        updatedAt: now,
      } as any);

      const ev = servicesEvents(emitAppEvent);
      await ev.appointmentCreated(appId, String(payload.sub), {
        appointmentId: id,
        serviceId,
        startAt: start.toISOString(),
      });

      return res.status(201).json({
        id,
        status: "requested",
        serviceId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        paymentProvider,
        paymentStatus: paymentProvider === "cod" ? "completed" : "pending",
      });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/appointments", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Appointments require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const db = getMysqlDb();
      const rows = await db
        .select({
          id: appAppointments.id,
          status: appAppointments.status,
          currency: appAppointments.currency,
          priceCents: appAppointments.priceCents,
          startAt: appAppointments.startAt,
          endAt: appAppointments.endAt,
          serviceId: appAppointments.serviceId,
          paymentProvider: appAppointments.paymentProvider,
          paymentStatus: appAppointments.paymentStatus,
          createdAt: appAppointments.createdAt,
          serviceName: appServices.name,
        })
        .from(appAppointments)
        .leftJoin(appServices, and(eq(appServices.appId, appId), eq(appServices.id, appAppointments.serviceId)))
        .where(and(eq(appAppointments.appId, appId), eq(appAppointments.customerId, String(payload.sub))))
        .orderBy(desc(appAppointments.startAt));

      return res.json(
        rows.map((a: any) => ({
          id: a.id,
          status: a.status,
          serviceId: a.serviceId,
          serviceName: a.serviceName ?? null,
          currency: a.currency ?? "INR",
          priceCents: Number(a.priceCents || 0),
          startAt: a.startAt instanceof Date ? a.startAt.toISOString() : String(a.startAt),
          endAt: a.endAt instanceof Date ? a.endAt.toISOString() : String(a.endAt),
          paymentProvider: a.paymentProvider ?? null,
          paymentStatus: a.paymentStatus,
          createdAt: a.createdAt,
        })),
      );
    } catch (err) {
      return next(err);
    }
  });

  // --- Runtime (customer) orders ---
  app.post("/api/runtime/:appId/orders", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Orders require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const body = ecommerceCreateOrderSchema.parse(req.body);
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = ecommerceService({ emit: emitAppEvent, audit });
      const out = await svc.createOrder({
        appId,
        customerId: String(payload.sub),
        items: body.items,
        notes: body.notes,
        paymentProvider: body.paymentProvider,
        couponCode: body.couponCode,
        shippingMethodId: body.shippingMethodId,
        shippingAddress: body.shippingAddress,
      });

      return res.status(201).json({
        id: out.id,
        status: out.status,
        totalCents: out.totalCents,
        currency: out.currency,
        paymentProvider: out.paymentProvider,
        paymentStatus: out.paymentStatus,
      });
    } catch (err) {
      return next(err);
    }
  });

  // Initiate Razorpay payment for an order (runtime)
  app.post("/api/runtime/:appId/orders/:orderId/pay/razorpay", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const orderId = String(req.params.orderId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Payments require MySQL storage" });
      }

      const authz = String(req.headers.authorization || "");
      const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: "Payment gateway not configured" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appOrders)
        .where(and(eq(appOrders.appId, appId), eq(appOrders.id, orderId), eq(appOrders.customerId, String(payload.sub))))
        .limit(1);
      const order: any = rows[0];
      if (!order) return res.status(404).json({ message: "Order not found" });
      if ((order.paymentProvider || "") !== "razorpay") {
        return res.status(400).json({ message: "Order is not configured for Razorpay" });
      }
      if ((order.currency || "INR") !== "INR") {
        return res.status(400).json({ message: "Only INR is supported for Razorpay" });
      }
      if (order.paymentStatus === "completed") {
        return res.status(400).json({ message: "Order is already paid" });
      }

      const amountInPaise = Number(order.totalCents || 0);
      if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
        return res.status(400).json({ message: "Invalid order amount" });
      }

      const orderPayload = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `runtime_order_${appId}_${orderId}_${Date.now()}`,
        notes: {
          kind: "runtime_order",
          appId,
          orderId,
          customerId: String(payload.sub),
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
        console.error("[Runtime Razorpay] order creation failed:", errText);
        return res.status(502).json({ message: "Payment gateway error" });
      }

      const rzpOrder = (await rzpRes.json()) as { id: string; amount: number; currency: string };
      await db
        .update(appOrders)
        .set({ paymentRef: rzpOrder.id, paymentStatus: "pending", updatedAt: new Date() } as any)
        .where(and(eq(appOrders.appId, appId), eq(appOrders.id, orderId)));

      const ev = paymentsEvents(emitAppEvent);
      await ev.razorpayOrderCreatedForRuntimeOrder(appId, String(payload.sub), { orderId, razorpayOrderId: rzpOrder.id });

      return res.json({
        provider: "razorpay",
        keyId: razorpayKeyId,
        order: rzpOrder,
      });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/runtime/:appId/orders/:orderId/pay/razorpay/verify", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const orderId = String(req.params.orderId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Payments require MySQL storage" });
      }

      const authz = String(req.headers.authorization || "");
      const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: "Payment gateway not configured" });
      }

      const schema = z
        .object({
          razorpay_order_id: z.string().min(1),
          razorpay_payment_id: z.string().min(1),
          razorpay_signature: z.string().min(1),
        })
        .strict();
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = schema.parse(req.body);

      const expectedSignature = crypto
        .createHmac("sha256", razorpayKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      const sigBuffer = Buffer.from(razorpay_signature, "utf8");
      const expectedBuffer = Buffer.from(expectedSignature, "utf8");
      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return res.status(400).json({ message: "Invalid signature" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appOrders)
        .where(and(eq(appOrders.appId, appId), eq(appOrders.id, orderId), eq(appOrders.customerId, String(payload.sub))))
        .limit(1);
      const order: any = rows[0];
      if (!order) return res.status(404).json({ message: "Order not found" });

      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = ecommerceService({ emit: emitAppEvent, audit });
      await svc.markOrderPaid({
        appId,
        orderId,
        customerId: String(payload.sub),
        provider: "razorpay",
        ref: razorpay_order_id,
        eventProperties: {
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
        },
      });

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/runtime/:appId/orders", async (req, res, next) => {
    try {
      const appId = String(req.params.appId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Orders require MySQL storage" });
      }

      const auth = String(req.headers.authorization || "");
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const payload = token ? verifyRuntimeToken(appId, token) : null;
      if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

      const svc = ecommerceService({ emit: emitAppEvent });
      const rows = await svc.listOrdersForCustomer({ appId, customerId: String(payload.sub) });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  // --- Owner Admin (CRUD) for products and orders ---
  app.get("/api/apps/:id/admin/products", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin products require MySQL storage" });
      }

      const svc = ecommerceService({ emit: emitAppEvent });
      const rows = await svc.adminListProducts({ appId });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/products", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin products require MySQL storage" });
      }

      const schema = z
        .object({
          name: z.string().min(1).max(200),
          description: z.string().max(5000).optional(),
          imageUrl: z.string().max(2000).optional(),
          priceCents: z.number().int().min(0).max(10_000_00),
          currency: z.string().max(8).optional().default("INR"),
          active: z.boolean().optional().default(true),
        })
        .strict();

      const payload = schema.parse(req.body);

      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = ecommerceService({ emit: emitAppEvent, audit });
      const out = await svc.adminCreateProduct({
        appId,
        actorUserId: user.id,
        name: payload.name,
        description: payload.description ?? null,
        imageUrl: payload.imageUrl ?? null,
        priceCents: payload.priceCents,
        currency: payload.currency,
        active: payload.active,
      });

      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.patch("/api/apps/:id/admin/products/:productId", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const productId = String(req.params.productId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin products require MySQL storage" });
      }

      const schema = z
        .object({
          name: z.string().min(1).max(200).optional(),
          description: z.string().max(5000).optional().nullable(),
          imageUrl: z.string().max(2000).optional().nullable(),
          priceCents: z.number().int().min(0).max(10_000_00).optional(),
          currency: z.string().max(8).optional(),
          active: z.boolean().optional(),
        })
        .strict();
      const patch = schema.parse(req.body);

      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = ecommerceService({ emit: emitAppEvent, audit });
      await svc.adminUpdateProduct({ appId, productId, actorUserId: user.id, patch });
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/apps/:id/admin/orders", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin orders require MySQL storage" });
      }

      const svc = ecommerceService({ emit: emitAppEvent });
      const orders = await svc.adminListOrders({ appId });
      return res.json(orders);
    } catch (err) {
      return next(err);
    }
  });

  app.patch("/api/apps/:id/admin/orders/:orderId", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const orderId = String(req.params.orderId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin orders require MySQL storage" });
      }

      const rawSchema = z
        .object({
          status: z
            .enum(["created", "pending", "paid", "packed", "shipped", "delivered", "cancelled", "canceled", "refunded"])
            .optional(),
          carrier: z.string().max(64).optional(),
          trackingNumber: z.string().max(128).optional(),
        })
        .strict();
      const raw = rawSchema.parse(req.body);

      if (!raw.status) return res.json({ ok: true });

      const mappedStatus = raw.status === "created" ? "pending" : raw.status === "cancelled" ? "canceled" : raw.status;
      const patch = updateOrderStatusSchema.parse({ status: mappedStatus, carrier: raw.carrier, trackingNumber: raw.trackingNumber });

      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = ecommerceService({ emit: emitAppEvent, audit });
      await svc.transitionOrderStatus({
        appId,
        orderId,
        actorUserId: user.id,
        targetStatus: patch.status,
        carrier: patch.carrier,
        trackingNumber: patch.trackingNumber,
      });

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/orders/:orderId/refunds", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const orderId = String(req.params.orderId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin refunds require MySQL storage" });
      }

      const body = createRefundSchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = ecommerceService({ emit: emitAppEvent, audit });
      const refund = await svc.createRefund({
        appId,
        orderId,
        actorUserId: user.id,
        amountCents: body.amountCents,
        reason: body.reason,
      });

      return res.status(201).json(refund);
    } catch (err) {
      return next(err);
    }
  });

  // --- Owner Admin (Vertical Ops) restaurant ---
  app.get("/api/apps/:id/admin/restaurant/kitchen-tickets", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Restaurant kitchen requires MySQL storage" });
      }

      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = restaurantService({ emit: emitAppEvent, audit });
      const rows = await svc.listKitchenTickets({ appId });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.patch("/api/apps/:id/admin/restaurant/orders/:orderId/kitchen", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const orderId = String(req.params.orderId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Restaurant kitchen requires MySQL storage" });
      }

      const body = updateKitchenStatusSchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = restaurantService({ emit: emitAppEvent, audit });
      const out = await svc.updateKitchenStatus({ appId, orderId, actorUserId: user.id, kitchenStatus: body.kitchenStatus });
      return res.json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/restaurant/tables", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Restaurant tables require MySQL storage" });
      }

      const body = createRestaurantTableSchema.parse(req.body ?? {});
      const svc = restaurantService({ emit: emitAppEvent });
      const out = await svc.createRestaurantTable({ appId, name: body.name, capacity: body.capacity, active: body.active });
      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/restaurant/menu-categories", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Restaurant menu requires MySQL storage" });
      }

      const body = createMenuCategorySchema.parse(req.body ?? {});
      const svc = restaurantService({ emit: emitAppEvent });
      const out = await svc.createMenuCategory({ appId, name: body.name, sortOrder: body.sortOrder, active: body.active });
      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/restaurant/menu-items", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Restaurant menu requires MySQL storage" });
      }

      const body = createMenuItemSchema.parse(req.body ?? {});
      const svc = restaurantService({ emit: emitAppEvent });
      const out = await svc.createMenuItem({
        appId,
        categoryId: body.categoryId,
        name: body.name,
        description: body.description,
        imageUrl: body.imageUrl,
        currency: body.currency,
        priceCents: body.priceCents,
        prepTimeMinutes: body.prepTimeMinutes,
        active: body.active,
      });
      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  // --- Owner Admin (Vertical Ops) real estate ---
  app.post("/api/apps/:id/admin/realestate/listings", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Real estate requires MySQL storage" });
      }

      const body = createListingSchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = realEstateService({ emit: emitAppEvent, audit });
      const out = await svc.createListing({
        appId,
        title: body.title,
        description: body.description,
        address: body.address,
        propertyType: body.propertyType,
        latitude: body.latitude,
        longitude: body.longitude,
        amenities: body.amenities,
        currency: body.currency,
        priceCents: body.priceCents,
        availabilityStatus: body.availabilityStatus,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
        areaSqft: body.areaSqft,
        imageUrl: body.imageUrl,
        active: body.active,
        actorUserId: user.id,
      });
      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/realestate/inquiries/:inquiryId/assign", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const inquiryId = String(req.params.inquiryId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Real estate requires MySQL storage" });
      }

      const body = assignInquirySchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = realEstateService({ emit: emitAppEvent, audit });
      const out = await svc.assignInquiry({ appId, inquiryId, agentId: body.agentId, actorUserId: user.id });
      return res.json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.patch("/api/apps/:id/admin/realestate/inquiries/:inquiryId", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const inquiryId = String(req.params.inquiryId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Real estate requires MySQL storage" });
      }

      const body = updateInquiryStatusSchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = realEstateService({ emit: emitAppEvent, audit });
      const out = await svc.updateInquiryStatus({ appId, inquiryId, status: body.status as any, actorUserId: user.id });
      return res.json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/realestate/listings/:listingId/tours", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const listingId = String(req.params.listingId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Real estate requires MySQL storage" });
      }

      const body = scheduleTourSchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = realEstateService({ emit: emitAppEvent, audit });
      const out = await svc.scheduleTour({
        appId,
        listingId,
        agentId: body.agentId,
        startAtIso: body.startAt,
        endAtIso: body.endAt,
        inquiryId: body.inquiryId,
        actorUserId: user.id,
      });
      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  // --- Owner Admin (Vertical Ops) healthcare ---
  app.post("/api/apps/:id/admin/healthcare/appointment-types", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Healthcare requires MySQL storage" });
      }

      const body = createAppointmentTypeSchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = healthcareService({ emit: emitAppEvent, audit });
      const out = await svc.createAppointmentType({
        appId,
        name: body.name,
        durationMinutes: body.durationMinutes,
        bufferBeforeMinutes: body.bufferBeforeMinutes,
        bufferAfterMinutes: body.bufferAfterMinutes,
        cancellationPolicyHours: body.cancellationPolicyHours,
        currency: body.currency,
        priceCents: body.priceCents,
        active: body.active,
        actorUserId: user.id,
      });
      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/healthcare/availability", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Healthcare requires MySQL storage" });
      }

      const body = createAvailabilitySchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = healthcareService({ emit: emitAppEvent, audit });
      const out = await svc.addAvailability({
        appId,
        doctorId: body.doctorId,
        startAtIso: body.startAt,
        endAtIso: body.endAt,
        active: body.active,
        actorUserId: user.id,
      });
      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.patch("/api/apps/:id/admin/healthcare/doctor-appointments/:appointmentId", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appointmentId = String(req.params.appointmentId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Healthcare requires MySQL storage" });
      }

      const body = transitionAppointmentSchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = healthcareService({ emit: emitAppEvent, audit });
      const out = await svc.transitionAppointment({ appId, appointmentId, status: body.status as any, actorUserId: user.id });
      return res.json(out);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/healthcare/invoices/:invoiceId/payments", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const invoiceId = String(req.params.invoiceId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Healthcare requires MySQL storage" });
      }

      const body = createInvoicePaymentSchema.parse(req.body ?? {});
      const audit = async (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => {
        await storage.createAuditLog({
          userId: log.userId ?? null,
          action: log.action,
          targetType: log.targetType ?? null,
          targetId: log.targetId ?? null,
          metadata: log.metadata ?? null,
          ipAddress: (req.ip || null) as any,
          userAgent: String(req.headers["user-agent"] || "") || null,
        } as any);
      };

      const svc = healthcareService({ emit: emitAppEvent, audit });
      const out = await svc.markInvoicePaid({
        appId,
        invoiceId,
        provider: body.provider,
        providerRef: body.providerRef,
        amountCents: body.amountCents,
        actorUserId: user.id,
      });
      return res.status(201).json(out);
    } catch (err) {
      return next(err);
    }
  });

  // --- Owner Admin (Integrations) webhooks ---
  app.get("/api/apps/:id/admin/webhooks", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Webhooks require MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appWebhooks)
        .where(eq(appWebhooks.appId, appId))
        .orderBy(desc(appWebhooks.updatedAt));
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/webhooks", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Webhooks require MySQL storage" });
      }

      const schema = z
        .object({
          name: z.string().min(1).max(100),
          url: z.string().min(1).max(2000),
          secret: z.string().max(128).optional(),
          enabled: z.boolean().optional().default(true),
          events: z.array(z.string().min(1).max(64)).optional().default([]),
        })
        .strict();

      const body = schema.parse(req.body);
      if (!isHttpishUrl(body.url)) return res.status(400).json({ message: "Invalid webhook URL" });

      const db = getMysqlDb();
      const now = new Date();
      const id = crypto.randomUUID();
      await db.insert(appWebhooks).values({
        id,
        appId,
        name: body.name,
        url: body.url,
        secret: body.secret ?? null,
        events: JSON.stringify(body.events || []),
        enabled: body.enabled ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      } as any);

      return res.status(201).json({ id });
    } catch (err) {
      return next(err);
    }
  });

  app.patch("/api/apps/:id/admin/webhooks/:hookId", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const hookId = String(req.params.hookId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Webhooks require MySQL storage" });
      }

      const schema = z
        .object({
          name: z.string().min(1).max(100).optional(),
          url: z.string().min(1).max(2000).optional(),
          secret: z.string().max(128).optional().nullable(),
          enabled: z.boolean().optional(),
          events: z.array(z.string().min(1).max(64)).optional(),
        })
        .strict();
      const patch = schema.parse(req.body);
      if (patch.url && !isHttpishUrl(patch.url)) return res.status(400).json({ message: "Invalid webhook URL" });

      const db = getMysqlDb();
      const update: any = { updatedAt: new Date() };
      if (typeof patch.name === "string") update.name = patch.name;
      if (typeof patch.url === "string") update.url = patch.url;
      if (typeof patch.secret !== "undefined") update.secret = patch.secret;
      if (typeof patch.enabled === "boolean") update.enabled = patch.enabled ? 1 : 0;
      if (typeof patch.events !== "undefined") update.events = JSON.stringify(patch.events || []);

      await db
        .update(appWebhooks)
        .set(update)
        .where(and(eq(appWebhooks.appId, appId), eq(appWebhooks.id, hookId)));

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.delete("/api/apps/:id/admin/webhooks/:hookId", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const hookId = String(req.params.hookId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Webhooks require MySQL storage" });
      }

      const db = getMysqlDb();
      await db.delete(appWebhooks).where(and(eq(appWebhooks.appId, appId), eq(appWebhooks.id, hookId)));
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/webhooks/:hookId/test", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const hookId = String(req.params.hookId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Webhooks require MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appWebhooks)
        .where(and(eq(appWebhooks.appId, appId), eq(appWebhooks.id, hookId)))
        .limit(1);
      const hook: any = rows[0];
      if (!hook) return res.status(404).json({ message: "Webhook not found" });

      await deliverAppWebhooks(appId, {
        id: crypto.randomUUID(),
        appId,
        customerId: null,
        name: "webhook.test",
        properties: { hookId },
        createdAt: new Date().toISOString(),
      }, hookId);

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // --- Owner Admin runtime analytics (events + orders) ---
  app.get("/api/apps/:id/admin/runtime-analytics", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Runtime analytics require MySQL storage" });
      }

      const range = String((req.query as any)?.range || "7d");
      const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const db = getMysqlDb();

      const mode = getEventNamingMode();
      const excludeAliasWhere =
        mode === "dual"
          ? sql`(${appEvents.properties} is null OR ${appEvents.properties} NOT LIKE '%"__isAlias":true%')`
          : sql`1=1`;

      const [{ count: customersTotal } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(appCustomers)
        .where(eq(appCustomers.appId, appId));

      const [{ count: ordersCount, revenueCents } = { count: 0, revenueCents: 0 }] = await db
        .select({
          count: sql<number>`count(*)`,
          revenueCents: sql<number>`coalesce(sum(${appOrders.totalCents}), 0)`,
        })
        .from(appOrders)
        .where(and(eq(appOrders.appId, appId), gte(appOrders.createdAt, since)));

      const topEvents = await db
        .select({ name: appEvents.name, count: sql<number>`count(*)` })
        .from(appEvents)
        .where(and(eq(appEvents.appId, appId), gte(appEvents.createdAt, since), excludeAliasWhere))
        .groupBy(appEvents.name)
        .orderBy(desc(sql`count(*)`))
        .limit(20);

      const dayExpr = sql<string>`date(${appEvents.createdAt})`;
      const eventsByDay = await db
        .select({ day: dayExpr, count: sql<number>`count(*)` })
        .from(appEvents)
        .where(and(eq(appEvents.appId, appId), gte(appEvents.createdAt, since), excludeAliasWhere))
        .groupBy(dayExpr)
        .orderBy(asc(dayExpr));

      return res.json({
        range: `${days}d`,
        since: since.toISOString(),
        customersTotal: Number(customersTotal || 0),
        ordersCount: Number(ordersCount || 0),
        revenueCents: Number(revenueCents || 0),
        topEvents: (topEvents as any[]).map((r) => ({ name: r.name, count: Number((r as any).count || 0) })),
        eventsByDay: (eventsByDay as any[]).map((r) => ({ day: String((r as any).day), count: Number((r as any).count || 0) })),
      });
    } catch (err) {
      return next(err);
    }
  });

  // --- Publish pack export (store metadata) ---
  app.get("/api/apps/:id/publish-pack", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem: any = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      const modules = Array.isArray(appItem.modules) ? appItem.modules : [];
      const publishing = modules.find((m: any) => m?.type === "publishing");
      const storeAssets = publishing?.config?.storeAssets || {};

      const features = {
        auth: modules.some((m: any) => m?.type === "auth"),
        payments: modules.some((m: any) => m?.type === "payments"),
        analytics: modules.some((m: any) => m?.type === "analytics"),
        push: modules.some((m: any) => m?.type === "notifications"),
      };

      return res.json({
        generatedAt: new Date().toISOString(),
        app: {
          id: appItem.id,
          name: appItem.name,
          url: appItem.url,
          packageName: appItem.packageName ?? null,
          iconUrl: appItem.iconUrl ?? null,
          primaryColor: appItem.primaryColor ?? null,
        },
        storeAssets: {
          supportEmail: storeAssets.supportEmail ?? "",
          privacyPolicyUrl: storeAssets.privacyPolicyUrl ?? "",
          termsUrl: storeAssets.termsUrl ?? "",
          shortDescription: storeAssets.shortDescription ?? "",
          fullDescription: storeAssets.fullDescription ?? "",
          screenshots: Array.isArray(storeAssets.screenshots) ? storeAssets.screenshots : [],
        },
        features,
        checklist: Array.isArray(publishing?.config?.checklist) ? publishing.config.checklist : [],
      });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const publicBaseUrlFromReq = (req: any) => {
        const xfProto = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0]?.trim();
        const xfHost = String(req.headers?.["x-forwarded-host"] || "").split(",")[0]?.trim();
        const host = xfHost || String(req.headers?.host || "");
        const proto = xfProto || (req.secure ? "https" : String(req.protocol || "http"));
        if (!host) return "";
        return `${proto}://${host}`.replace(/\/$/, "");
      };

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

      // If the client created a "native-only" app (typically from prompt/scratch mode),
      // we still want a REAL app experience. We do that by pointing the wrapper WebView
      // at our hosted runtime URL instead of leaving a placeholder like native://app.
      try {
        const rawUrl = String((created as any)?.url || "");
        const isNativePlaceholder = rawUrl.toLowerCase().startsWith("native://") || rawUrl.toLowerCase().startsWith("runtime://");
        const isNativeOnly = Boolean((created as any)?.isNativeOnly);
        if (isNativeOnly || isNativePlaceholder) {
          const base = publicBaseUrlFromReq(req);
          if (base) {
            const runtimeUrl = `${base}/runtime/${created.id}`;
            const updated = await storage.updateApp(created.id, { url: runtimeUrl } as any);
            if (updated) {
              (created as any).url = runtimeUrl;
            }
          }
        }
      } catch {
        // Best-effort only; do not block app creation.
      }

      // Best-effort runtime seeding for certain industries.
      // This is what turns “pretty preview screens” into a functional runtime experience.
      try {
        const industry = String((created as any)?.industry || "").toLowerCase();
        if (process.env.DATABASE_URL?.startsWith("mysql://") && industry) {
          const db = getMysqlDb();
          const now = new Date();

          const hasAny = async (table: any) => {
            const r = await db.select({ id: table.id }).from(table).where(eq(table.appId, created.id)).limit(1);
            return r.length > 0;
          };

          if (industry === "salon" || industry === "photography" || industry === "business") {
            if (!(await hasAny(appServices))) {
              await db.insert(appServices).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: industry === "photography" ? "Portrait Session" : "Haircut & Styling",
                  description: industry === "photography" ? "60-minute guided portrait session" : "Consultation, wash, cut and styling",
                  imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800",
                  currency: "INR",
                  priceCents: 79900,
                  durationMinutes: 60,
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: industry === "business" ? "Consultation Call" : "Facial & Cleanup",
                  description: industry === "business" ? "30-minute discovery call" : "Deep cleanse, exfoliation and glow",
                  imageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=800",
                  currency: "INR",
                  priceCents: 129900,
                  durationMinutes: 30,
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: industry === "photography" ? "Wedding Package" : "Manicure & Pedicure",
                  description: industry === "photography" ? "Full-day coverage + edited gallery" : "Nail care, massage and polish",
                  imageUrl: "https://images.unsplash.com/photo-1512207846876-bb54ef5056fe?w=800",
                  currency: "INR",
                  priceCents: 99900,
                  durationMinutes: 90,
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
          }

          if (industry === "ecommerce" || industry === "restaurant" || industry === "music") {
            if (!(await hasAny(appProducts))) {
              const items = industry === "restaurant"
                ? [
                    {
                      name: "Butter Chicken",
                      description: "Creamy tomato gravy, served with naan",
                      imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc500f?w=800",
                      priceCents: 29900,
                    },
                    {
                      name: "Veg Biryani",
                      description: "Aromatic basmati rice with vegetables",
                      imageUrl: "https://images.unsplash.com/photo-1631515243342-4c8dbb2fbc2f?w=800",
                      priceCents: 22900,
                    },
                    {
                      name: "Gulab Jamun",
                      description: "Classic Indian dessert",
                      imageUrl: "https://images.unsplash.com/photo-1600849995740-2d08a4b2cfb8?w=800",
                      priceCents: 9900,
                    },
                  ]
                : industry === "music"
                  ? [
                      {
                        name: "Band T-Shirt",
                        description: "Official merch — 100% cotton",
                        imageUrl: "https://images.unsplash.com/photo-1520975916090-3105956dac38?w=800",
                        priceCents: 69900,
                      },
                      {
                        name: "Vinyl Record",
                        description: "Limited edition vinyl pressing",
                        imageUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800",
                        priceCents: 149900,
                      },
                    ]
                  : [
                      {
                        name: "Premium Product",
                        description: "High quality item with fast shipping",
                        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
                        priceCents: 129900,
                      },
                      {
                        name: "Everyday Essential",
                        description: "Best value for daily use",
                        imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800",
                        priceCents: 59900,
                      },
                      {
                        name: "Gift Pack",
                        description: "Perfect for special occasions",
                        imageUrl: "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800",
                        priceCents: 89900,
                      },
                    ];

              await db.insert(appProducts).values(
                items.map((i) => ({
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: i.name,
                  description: i.description,
                  imageUrl: i.imageUrl,
                  currency: "INR",
                  priceCents: i.priceCents,
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                })) as any,
              );
            }
          }

          if (industry === "news") {
            if (!(await hasAny(appPosts))) {
              await db.insert(appPosts).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  type: "news",
                  title: "Breaking: New update available",
                  excerpt: "Your app is live with real runtime modules.",
                  content: "This is a seeded example article. Replace it with your content using the admin panel endpoints.",
                  imageUrl: "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?w=800",
                  category: "General",
                  active: 1,
                  publishedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  type: "news",
                  title: "Top 5 tips for productivity",
                  excerpt: "Short, practical steps you can apply today.",
                  content: "Seeded content for the news template.",
                  imageUrl: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800",
                  category: "Tips",
                  active: 1,
                  publishedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
          }

          if (industry === "church") {
            if (!(await hasAny(appPosts))) {
              await db.insert(appPosts).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  type: "sermon",
                  title: "Sunday Message: Hope & Purpose",
                  excerpt: "A short reflection on hope.",
                  content: "Seed sermon text. You can attach audio/video URLs via content fields later.",
                  imageUrl: "https://images.unsplash.com/photo-1520697222869-fc1fbcf6c36e?w=800",
                  category: "Sermons",
                  active: 1,
                  publishedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  type: "event",
                  title: "Community Gathering",
                  excerpt: "Join us this week for fellowship.",
                  content: "Seed event details. You can store structured event data later.",
                  imageUrl: "https://images.unsplash.com/photo-1520975958225-85f94c6620f8?w=800",
                  category: "Events",
                  active: 1,
                  publishedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
          }

          if (industry === "fitness") {
            if (!(await hasAny(appFitnessClasses))) {
              const start1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
              start1.setMinutes(0, 0, 0);
              const end1 = new Date(start1.getTime() + 45 * 60 * 1000);
              const start2 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
              start2.setMinutes(0, 0, 0);
              const end2 = new Date(start2.getTime() + 60 * 60 * 1000);

              await db.insert(appFitnessClasses).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: "HIIT Basics",
                  description: "Beginner-friendly high intensity interval training",
                  startsAt: start1,
                  endsAt: end1,
                  capacity: 25,
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: "Yoga Flow",
                  description: "Full body mobility and flexibility",
                  startsAt: start2,
                  endsAt: end2,
                  capacity: 30,
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
          }

          if (industry === "education") {
            if (!(await hasAny(appCourses))) {
              const course1 = crypto.randomUUID();
              const course2 = crypto.randomUUID();

              await db.insert(appCourses).values([
                {
                  id: course1,
                  appId: created.id,
                  title: "Getting Started",
                  description: "A starter course with a few lessons",
                  imageUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800",
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: course2,
                  appId: created.id,
                  title: "Advanced Concepts",
                  description: "Go deeper with structured lessons",
                  imageUrl: "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=800",
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);

              await db.insert(appCourseLessons).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  courseId: course1,
                  title: "Welcome",
                  contentUrl: "https://example.com/lesson/welcome",
                  sortOrder: 1,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  courseId: course1,
                  title: "Lesson 1",
                  contentUrl: "https://example.com/lesson/1",
                  sortOrder: 2,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
          }

          if (industry === "realestate") {
            if (!(await hasAny(appRealEstateListings))) {
              await db.insert(appRealEstateListings).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  title: "2BHK Apartment",
                  description: "Bright apartment near city center",
                  address: "City Center",
                  currency: "INR",
                  priceCents: 650000000,
                  imageUrl: "https://images.unsplash.com/photo-1560185127-6a8c0b2b7f5e?w=800",
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  title: "Villa with Garden",
                  description: "Spacious villa with private garden",
                  address: "Suburbs",
                  currency: "INR",
                  priceCents: 1800000000,
                  imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
          }

          if (industry === "healthcare") {
            if (!(await hasAny(appDoctors))) {
              await db.insert(appDoctors).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: "Dr. A. Sharma",
                  specialty: "General Physician",
                  bio: "Consultation for common illnesses and health advice",
                  imageUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800",
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: "Dr. R. Patel",
                  specialty: "Dermatologist",
                  bio: "Skin and hair specialist",
                  imageUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=800",
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
          }

          if (industry === "radio") {
            if (!(await hasAny(appRadioStations))) {
              await db.insert(appRadioStations).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  name: "Live Station",
                  streamUrl: "https://example.com/stream/live",
                  imageUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800",
                  active: 1,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
            if (!(await hasAny(appPodcastEpisodes))) {
              await db.insert(appPodcastEpisodes).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  showTitle: "Weekly Show",
                  title: "Episode 1: Welcome",
                  description: "Seeded podcast episode",
                  audioUrl: "https://example.com/podcast/episode1.mp3",
                  publishedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
            }
          }

          if (industry === "music") {
            if (!(await hasAny(appMusicAlbums))) {
              const albumId = crypto.randomUUID();
              await db.insert(appMusicAlbums).values([
                {
                  id: albumId,
                  appId: created.id,
                  title: "Debut Album",
                  artist: created.name,
                  imageUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800",
                  releasedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              ] as any);
              await db.insert(appMusicTracks).values([
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  albumId,
                  title: "Track One",
                  trackNumber: 1,
                  durationSeconds: 210,
                  audioUrl: "https://example.com/audio/track1.mp3",
                  createdAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  appId: created.id,
                  albumId,
                  title: "Track Two",
                  trackNumber: 2,
                  durationSeconds: 195,
                  audioUrl: "https://example.com/audio/track2.mp3",
                  createdAt: now,
                },
              ] as any);
            }
          }
        }
      } catch {
        // Ignore seeding failures; app creation must succeed even if runtime data is not seeded.
      }

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

  // --- Owner Admin (CRUD) for salon services ---
  app.get("/api/apps/:id/admin/services", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin services require MySQL storage" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appServices)
        .where(eq(appServices.appId, appId))
        .orderBy(desc(appServices.updatedAt));
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/admin/services", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin services require MySQL storage" });
      }

      const schema = z
        .object({
          name: z.string().min(1).max(200),
          description: z.string().max(5000).optional(),
          imageUrl: z.string().max(2000).optional(),
          durationMinutes: z.number().int().min(5).max(12 * 60).optional().default(30),
          priceCents: z.number().int().min(0).max(50_000_00).optional().default(0),
          currency: z.string().max(8).optional().default("INR"),
          active: z.boolean().optional().default(true),
        })
        .strict();

      const payload = schema.parse(req.body);
      const db = getMysqlDb();
      const id = crypto.randomUUID();
      const now = new Date();

      await db.insert(appServices).values({
        id,
        appId,
        name: payload.name,
        description: payload.description ?? null,
        imageUrl: payload.imageUrl ?? null,
        currency: payload.currency,
        priceCents: payload.priceCents,
        durationMinutes: payload.durationMinutes,
        active: payload.active ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      } as any);

      return res.status(201).json({ id });
    } catch (err) {
      return next(err);
    }
  });

  app.patch("/api/apps/:id/admin/services/:serviceId", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const appId = String(req.params.id || "");
      const serviceId = String(req.params.serviceId || "");
      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin services require MySQL storage" });
      }

      const schema = z
        .object({
          name: z.string().min(1).max(200).optional(),
          description: z.string().max(5000).optional().nullable(),
          imageUrl: z.string().max(2000).optional().nullable(),
          durationMinutes: z.number().int().min(5).max(12 * 60).optional(),
          priceCents: z.number().int().min(0).max(50_000_00).optional(),
          currency: z.string().max(8).optional(),
          active: z.boolean().optional(),
        })
        .strict();
      const patch = schema.parse(req.body);

      const db = getMysqlDb();
      const update: any = { ...patch, updatedAt: new Date() };
      if (typeof patch.active === "boolean") update.active = patch.active ? 1 : 0;

      await db
        .update(appServices)
        .set(update)
        .where(and(eq(appServices.appId, appId), eq(appServices.id, serviceId)));

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // Extended update schema that includes editorScreens for visual editor
  const updateAppSchema = insertAppSchema.omit({ status: true }).partial().extend({
    editorScreens: editorScreensSchema,
  });

  // --- Website import wizard (extract links) ---
  app.get("/api/import/website-links", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const raw = typeof req.query.url === "string" ? req.query.url : "";
      if (!raw || !isHttpishUrl(raw)) {
        return res.status(400).json({ message: "Invalid url" });
      }

      const inputUrl = new URL(raw);
      const baseUrl = `${inputUrl.protocol}//${inputUrl.host}`;

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12_000);
      const resp = await fetch(raw, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SaaS-Architect/1.0; +https://example.com)",
          Accept: "text/html,application/xhtml+xml",
        },
      }).finally(() => clearTimeout(t));

      if (!resp.ok) {
        return res.status(400).json({ message: `Fetch failed (${resp.status})` });
      }

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return res.status(400).json({ message: "URL did not return HTML" });
      }

      const htmlRaw = await resp.text();
      const html = htmlRaw.length > 1_200_000 ? htmlRaw.slice(0, 1_200_000) : htmlRaw;

      const seen: Record<string, boolean> = {};
      const links: Array<{ title: string; url: string }> = [];

      const aRe = /<a\s+[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = aRe.exec(html)) && links.length < 200) {
        const hrefCandidate = (m[2] || m[3] || m[4] || "").trim();
        const titleRaw = m[5] || "";
        const urlStr = normalizeImportedLink(hrefCandidate, baseUrl);
        if (!urlStr) continue;

        let u: URL;
        try {
          u = new URL(urlStr);
        } catch {
          continue;
        }

        // Keep same-host links only (reduces noise)
        if (u.host !== inputUrl.host) continue;

        const key = u.toString();
        if (seen[key]) continue;
        seen[key] = true;

        const title = stripHtml(titleRaw).slice(0, 120);
        links.push({ title, url: key });
      }

      // Always include homepage
      if (!seen[baseUrl + "/"]) {
        links.unshift({ title: "Home", url: baseUrl + "/" });
      }

      // Rank + take top N
      links.sort((a, b) => rankLink(b.url) - rankLink(a.url));

      const maxOut = 20;
      const out: Array<{ title: string; url: string }> = [];
      for (let i = 0; i < links.length && out.length < maxOut; i++) {
        const item = links[i];
        out.push({
          title: item.title || new URL(item.url).pathname || item.url,
          url: item.url,
        });
      }

      return res.json({ baseUrl, links: out });
    } catch (err) {
      return next(err);
    }
  });

  // Apply an import result to an app (create webviewPages module + optional navigation)
  app.post("/api/apps/:id/apply-import", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      const schema = z.object({
        baseUrl: z.string().url(),
        createNav: z.boolean().optional().default(true),
        links: z
          .array(
            z.object({
              title: z.string().max(200).optional().default(""),
              url: z.string().url(),
            }),
          )
          .max(30),
      });
      const body = schema.parse(req.body);

      const existingModules = (appItem as any).modules && Array.isArray((appItem as any).modules) ? (appItem as any).modules : [];
      const modules = existingModules.slice();

      let webviewModuleIndex = -1;
      for (let i = 0; i < modules.length; i++) {
        if (modules[i]?.type === "webviewPages") {
          webviewModuleIndex = i;
          break;
        }
      }

      const webviewModule =
        webviewModuleIndex >= 0
          ? { ...modules[webviewModuleIndex] }
          : {
              id: crypto.randomUUID(),
              type: "webviewPages",
              name: "Webview Pages",
              enabled: true,
              config: { pages: [] },
            };

      const config = (webviewModule as any).config && typeof (webviewModule as any).config === "object" ? { ...(webviewModule as any).config } : {};
      const existingPages: any[] = Array.isArray((config as any).pages) ? (config as any).pages.slice() : [];

      const byUrl: Record<string, boolean> = {};
      for (let i = 0; i < existingPages.length; i++) {
        const u = typeof existingPages[i]?.url === "string" ? existingPages[i].url : "";
        if (u) byUrl[u] = true;
      }

      const newPages: any[] = [];
      for (let i = 0; i < body.links.length; i++) {
        const link = body.links[i];
        const normalized = normalizeImportedLink(link.url, body.baseUrl);
        if (!normalized) continue;
        if (byUrl[normalized]) continue;
        byUrl[normalized] = true;
        newPages.push({
          id: crypto.randomUUID(),
          label: (link.title || new URL(normalized).pathname || normalized).slice(0, 80),
          url: normalized,
          icon: "globe",
        });
      }

      (config as any).pages = existingPages.concat(newPages);
      (webviewModule as any).config = config;
      (webviewModule as any).enabled = true;

      if (webviewModuleIndex >= 0) modules[webviewModuleIndex] = webviewModule;
      else modules.push(webviewModule);

      const existingNav = (appItem as any).navigation && typeof (appItem as any).navigation === "object" ? (appItem as any).navigation : null;
      const navigation = existingNav
        ? { ...existingNav, items: Array.isArray(existingNav.items) ? existingNav.items.slice() : [] }
        : { style: "bottom-tabs", items: [] };

      if (body.createNav) {
        const navSeen: Record<string, boolean> = {};
        for (let i = 0; i < navigation.items.length; i++) {
          const u = typeof navigation.items[i]?.url === "string" ? navigation.items[i].url : "";
          if (u) navSeen[u] = true;
        }
        for (let i = 0; i < newPages.length; i++) {
          const p = newPages[i];
          if (!p?.url || navSeen[p.url]) continue;
          navSeen[p.url] = true;
          navigation.items.push({
            id: crypto.randomUUID(),
            kind: "webview",
            label: p.label,
            icon: p.icon,
            url: p.url,
          });
        }
      }

      const updated = await storage.updateApp(req.params.id, { modules, navigation } as any);
      return res.json(updated ? sanitizeAppForViewer(updated as any, user) : updated);
    } catch (err) {
      return next(err);
    }
  });

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

  app.post("/api/apps/:id/build", requireAuth, buildLimiter, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appId = String((req as any).params?.id || "");

      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "Not found" });
      }

      // --- Enforce plan entitlements (single source of truth; staff bypass) ---
      if (!isStaff(user)) {
        try {
          assertCanQueueBuild(user, ((appItem as any).platform || "android") as any);
        } catch (e: any) {
          return res.status(403).json({ message: e?.message || "Forbidden" });
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
  app.post("/api/apps/:id/retry-build", requireAuth, buildLimiter, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appId = String((req as any).params?.id || "");

      const appItem = await storage.getApp(appId);
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

      // Enforce plan entitlements (single source of truth; staff bypass)
      if (!isStaff(user)) {
        try {
          assertCanQueueBuild(user, ((appItem as any).platform || "android") as any);
        } catch (e: any) {
          return res.status(403).json({ message: e?.message || "Forbidden" });
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
        const staffOnly = rows.filter((u: any) => u.role === "admin" || u.role === "support" || u.role === "staff");
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

  // --- Admin: Google Play production approval queue ---
  app.get("/api/admin/play/production-requests", requireAuth, requireRole(["admin", "support"]), async (req, res, next) => {
    try {
      const parsed = z
        .object({
          limit: z.coerce.number().int().min(1).max(200).optional(),
          offset: z.coerce.number().int().min(0).max(5000).optional(),
        })
        .safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid query" });
      }

      const limit = parsed.data.limit ?? 50;
      const offset = parsed.data.offset ?? 0;

      const whereClause = and(
        eq(apps.playPublishingMode, "central" as any),
        eq(apps.playProductionStatus, "requested" as any),
      );

      const totalRow = await getMysqlDb()
        .select({ totalCount: sql<number>`count(*)` })
        .from(apps)
        .where(whereClause);

      const totalCount = Number(totalRow?.[0]?.totalCount ?? 0);

      const rows = await getMysqlDb()
        .select({
          id: apps.id,
          ownerId: apps.ownerId,
          ownerUsername: usersTable.username,
          name: apps.name,
          url: apps.url,
          status: apps.status,
          packageName: apps.packageName,
          playPublishingMode: apps.playPublishingMode,
          playProductionStatus: apps.playProductionStatus,
          playProductionRequestedAt: apps.playProductionRequestedAt,
          lastPlayPublishedAt: apps.lastPlayPublishedAt,
          lastPlayTrack: apps.lastPlayTrack,
          lastPlayVersionCode: apps.lastPlayVersionCode,
        })
        .from(apps)
        .leftJoin(usersTable, eq(usersTable.id, apps.ownerId))
        .where(whereClause)
        .orderBy(desc(apps.playProductionRequestedAt))
        .limit(limit)
        .offset(offset);

      return res.json({ items: rows, limit, offset, totalCount });
    } catch (err) {
      return next(err);
    }
  });

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
          return res.status(400).json({ message: "Team member role must be admin, staff, or support" });
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

  // --- Admin: Set staff permissions (RBAC) ---
  app.patch(
    ["/api/admin/users/:id/permissions", "/api/admin/team-members/:id/permissions"],
    requireAuth,
    requirePermission("manage_users"),
    async (req, res, next) => {
      try {
        const targetId = String(req.params.id || "");
        const parsed = z
          .object({ permissions: z.array(z.string()).max(200) })
          .strict()
          .safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "Invalid request" });

        const target = await storage.getUser(targetId);
        if (!target) return res.status(404).json({ message: "User not found" });

        const role = (target as any)?.role;
        if (!(role === "admin" || role === "support" || role === "staff")) {
          return res.status(400).json({ message: "Permissions can only be set for staff accounts" });
        }

        const normalized = normalizeAndValidatePermissions(parsed.data.permissions);
        if (!normalized.ok) return res.status(400).json({ message: normalized.message });

        const updated = await storage.setUserPermissions(targetId, normalized.permissions);
        if (!updated) return res.status(404).json({ message: "User not found" });
        const { password: _pw, ...safeUser } = updated as any;

        return res.json({ user: safeUser, permissions: normalized.permissions });
      } catch (err) {
        return next(err);
      }
    },
  );

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
        amountPaise: amountInPaise,
        // Legacy (rupees) field retained for older rows/clients
        amountInr: Math.floor(amountInPaise / 100),
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
  
  app.post("/api/webhooks/razorpay", razorpayWebhookLimiter, async (req, res) => {
    try {
      if (!RAZORPAY_WEBHOOK_SECRET) {
        console.log("[Razorpay Webhook] Webhook secret not configured, skipping");
        return res.status(200).json({ ok: true, message: "Webhook not configured" });
      }

      // Verify webhook signature
      const signature = req.headers["x-razorpay-signature"] as string;
      if (!signature) {
        logger.critical("razorpay.webhook.missing_signature", { requestId: (req as any).requestId, ip: req.ip });
        return res.status(400).json({ message: "Missing signature" });
      }

      const rawBody = (req as any).rawBody;
      if (!Buffer.isBuffer(rawBody)) {
        logger.critical("razorpay.webhook.missing_raw_body", { requestId: (req as any).requestId, ip: req.ip });
        return res.status(400).json({ message: "Invalid request" });
      }
      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      // Timing-safe comparison
      const sigBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        logger.critical("razorpay.webhook.invalid_signature", { requestId: (req as any).requestId, ip: req.ip });
        return res.status(400).json({ message: "Invalid signature" });
      }

      const event = req.body;
      console.log(`[Razorpay Webhook] Received event: ${event.event}`);

      // Handle payment.captured event
      if (event.event === "payment.captured") {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id && payment?.id && payment?.status === "captured") {
          // Runtime order payments
          const notes: any = payment?.notes || {};
          if (notes?.kind === "runtime_order" && typeof notes.appId === "string" && typeof notes.orderId === "string") {
            try {
              if (process.env.DATABASE_URL?.startsWith("mysql://")) {
                const db = getMysqlDb();
                const result = await db
                  .update(appOrders)
                  .set({ paymentStatus: "completed", updatedAt: new Date() } as any)
                  .where(and(eq(appOrders.appId, notes.appId), eq(appOrders.id, notes.orderId), ne(appOrders.paymentStatus, "completed")));

                const affected =
                  (result as any)?.rowsAffected ??
                  (result as any)?.affectedRows ??
                  (result as any)?.[0]?.affectedRows ??
                  0;
                const ev = ecommerceEvents(emitAppEvent);
                if (Number(affected) > 0) {
                  await ev.orderPaid(notes.appId, notes.customerId ? String(notes.customerId) : null, {
                    orderId: notes.orderId,
                    razorpayOrderId: payment.order_id,
                    razorpayPaymentId: payment.id,
                  });
                }
              }
            } catch (e) {
              console.error("[Razorpay Webhook] Failed to update runtime order:", e);
            }
          }

          // Subscription/plan payments: lookup by provider order id (reliable; no "all" hacks)
          const dbPayment = await storage.getPaymentByOrderId(String(payment.order_id));
          if (dbPayment && dbPayment.status === "pending") {
            const { updated } = await storage.updatePaymentStatus(dbPayment.id, "completed", String(payment.id));
            if (updated) {
              await storage.applyEntitlementsIfNeeded(dbPayment.id);
              console.log(`[Razorpay Webhook] Payment ${dbPayment.id} marked as completed via webhook`);
            }
          }
        }
      }

      // Handle payment.failed event
      if (event.event === "payment.failed") {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id) {
          // Runtime order payments
          const notes: any = payment?.notes || {};
          if (notes?.kind === "runtime_order" && typeof notes.appId === "string" && typeof notes.orderId === "string") {
            try {
              if (process.env.DATABASE_URL?.startsWith("mysql://")) {
                const db = getMysqlDb();
                const result = await db
                  .update(appOrders)
                  .set({ paymentStatus: "failed", updatedAt: new Date() } as any)
                  .where(
                    and(
                      eq(appOrders.appId, notes.appId),
                      eq(appOrders.id, notes.orderId),
                      ne(appOrders.paymentStatus, "failed"),
                      ne(appOrders.paymentStatus, "completed"),
                    ),
                  );

                const affected =
                  (result as any)?.rowsAffected ??
                  (result as any)?.affectedRows ??
                  (result as any)?.[0]?.affectedRows ??
                  0;
                const ev = ecommerceEvents(emitAppEvent);
                if (Number(affected) === 1) {
                  await ev.orderPaymentFailed(notes.appId, notes.customerId ? String(notes.customerId) : null, {
                    orderId: notes.orderId,
                    razorpayOrderId: payment.order_id,
                  });
                }
              }
            } catch (e) {
              console.error("[Razorpay Webhook] Failed to update runtime order:", e);
            }
          }

          const dbPayment = await storage.getPaymentByOrderId(String(payment.order_id));
          if (dbPayment && dbPayment.status === "pending") {
            const { updated } = await storage.updatePaymentStatus(dbPayment.id, "failed");
            if (updated) {
              console.log(`[Razorpay Webhook] Payment ${dbPayment.id} marked as failed via webhook`);
            }
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
        amountPaise: 0,
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

  app.post("/api/payments/verify", requireAuth, paymentsVerifyLimiter, async (req, res, next) => {
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

      // Bind verify payload to the stored provider order id (prevents cross-binding / replay abuse).
      if (existingPayment.providerOrderId !== razorpay_order_id) {
        console.log(
          `[Payment Verify] providerOrderId mismatch for payment ${paymentId}: expected ${existingPayment.providerOrderId}, got ${razorpay_order_id}`,
        );
        return res.status(400).json({ message: "Payment/order mismatch" });
      }

      // Idempotency: never re-apply entitlements for already-processed payments.
      if (existingPayment.status === "completed") {
        await storage.applyEntitlementsIfNeeded(existingPayment.id);
        return res.json({ ok: true, payment: existingPayment, message: "Already verified" });
      }
      if (existingPayment.status === "failed") {
        return res.status(409).json({ message: "Payment already failed" });
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
        // Only transition pending -> failed (atomic; safe under replay).
        await storage.updatePaymentStatus(paymentId, "failed");
        return res.status(400).json({ message: "Payment verification failed" });
      }

      // Update payment status
      const { payment, updated } = await storage.updatePaymentStatus(paymentId, "completed", razorpay_payment_id);
      if (!payment) {
        return res.status(404).json({ message: "Payment record not found" });
      }

      if (!updated) {
        // Another request/webhook already processed it.
        return res.json({ ok: true, payment, message: "Already processed" });
      }

      await storage.applyEntitlementsIfNeeded(payment.id);

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

  // --- Admin inspection (read-only) ---
  // Minimal pagination via limit + cursor (createdAt).
  app.get(["/api/admin/payments", "/admin/payments"], requireAuth, requirePermission("view_payments"), async (req, res, next) => {
    try {
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin inspection requires MySQL storage" });
      }

      const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50));
      const cursorRaw = typeof req.query.cursor === "string" ? req.query.cursor : null;
      const cursor = cursorRaw ? new Date(cursorRaw) : null;
      if (cursorRaw && (!cursor || Number.isNaN(cursor.getTime()))) {
        return res.status(400).json({ message: "Invalid cursor" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select({
          id: paymentsTable.id,
          userId: paymentsTable.userId,
          appId: paymentsTable.appId,
          provider: paymentsTable.provider,
          providerOrderId: paymentsTable.providerOrderId,
          providerPaymentId: paymentsTable.providerPaymentId,
          amountPaise: paymentsTable.amountPaise,
          amountInr: paymentsTable.amountInr,
          plan: paymentsTable.plan,
          status: paymentsTable.status,
          createdAt: paymentsTable.createdAt,
          updatedAt: paymentsTable.updatedAt,
        })
        .from(paymentsTable)
        .where(cursor ? lt(paymentsTable.createdAt, cursor) : undefined)
        .orderBy(desc(paymentsTable.createdAt))
        .limit(limit + 1);

      const items = rows.slice(0, limit);
      const nextCursor = items.length === limit ? (items[items.length - 1] as any)?.createdAt : null;
      return res.json({ items, nextCursor });
    } catch (err) {
      return next(err);
    }
  });

  app.get(["/api/admin/orders", "/admin/orders"], requireAuth, requirePermission("view_orders"), async (req, res, next) => {
    try {
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin inspection requires MySQL storage" });
      }

      const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50));
      const cursorRaw = typeof req.query.cursor === "string" ? req.query.cursor : null;
      const cursor = cursorRaw ? new Date(cursorRaw) : null;
      if (cursorRaw && (!cursor || Number.isNaN(cursor.getTime()))) {
        return res.status(400).json({ message: "Invalid cursor" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select({
          id: appOrders.id,
          appId: appOrders.appId,
          customerId: appOrders.customerId,
          status: appOrders.status,
          paymentProvider: appOrders.paymentProvider,
          paymentStatus: appOrders.paymentStatus,
          totalCents: appOrders.totalCents,
          createdAt: appOrders.createdAt,
          updatedAt: appOrders.updatedAt,
        })
        .from(appOrders)
        .where(cursor ? lt(appOrders.createdAt, cursor) : undefined)
        .orderBy(desc(appOrders.createdAt))
        .limit(limit + 1);

      const items = rows.slice(0, limit);
      const nextCursor = items.length === limit ? (items[items.length - 1] as any)?.createdAt : null;
      return res.json({ items, nextCursor });
    } catch (err) {
      return next(err);
    }
  });

  app.get(["/api/admin/reservations", "/admin/reservations"], requireAuth, requirePermission("view_reservations"), async (req, res, next) => {
    try {
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin inspection requires MySQL storage" });
      }

      const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50));
      const cursorRaw = typeof req.query.cursor === "string" ? req.query.cursor : null;
      const cursor = cursorRaw ? new Date(cursorRaw) : null;
      if (cursorRaw && (!cursor || Number.isNaN(cursor.getTime()))) {
        return res.status(400).json({ message: "Invalid cursor" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select({
          id: appRestaurantReservations.id,
          appId: appRestaurantReservations.appId,
          customerId: appRestaurantReservations.customerId,
          tableId: appRestaurantReservations.tableId,
          status: appRestaurantReservations.status,
          reservedAt: appRestaurantReservations.reservedAt,
          durationMinutes: appRestaurantReservations.durationMinutes,
          createdAt: appRestaurantReservations.createdAt,
          updatedAt: appRestaurantReservations.updatedAt,
        })
        .from(appRestaurantReservations)
        .where(cursor ? lt(appRestaurantReservations.createdAt, cursor) : undefined)
        .orderBy(desc(appRestaurantReservations.createdAt))
        .limit(limit + 1);

      const items = rows.slice(0, limit);
      const nextCursor = items.length === limit ? (items[items.length - 1] as any)?.createdAt : null;
      return res.json({ items, nextCursor });
    } catch (err) {
      return next(err);
    }
  });

  app.get(["/api/admin/appointments", "/admin/appointments"], requireAuth, requirePermission("view_appointments"), async (req, res, next) => {
    try {
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Admin inspection requires MySQL storage" });
      }

      const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50));
      const cursorRaw = typeof req.query.cursor === "string" ? req.query.cursor : null;
      const cursor = cursorRaw ? new Date(cursorRaw) : null;
      if (cursorRaw && (!cursor || Number.isNaN(cursor.getTime()))) {
        return res.status(400).json({ message: "Invalid cursor" });
      }

      const db = getMysqlDb();
      const rows = await db
        .select({
          id: appDoctorAppointments.id,
          appId: appDoctorAppointments.appId,
          customerId: appDoctorAppointments.customerId,
          doctorId: appDoctorAppointments.doctorId,
          status: appDoctorAppointments.status,
          startAt: appDoctorAppointments.startAt,
          endAt: appDoctorAppointments.endAt,
          createdAt: appDoctorAppointments.createdAt,
          updatedAt: appDoctorAppointments.updatedAt,
        })
        .from(appDoctorAppointments)
        .where(cursor ? lt(appDoctorAppointments.createdAt, cursor) : undefined)
        .orderBy(desc(appDoctorAppointments.createdAt))
        .limit(limit + 1);

      const items = rows.slice(0, limit);
      const nextCursor = items.length === limit ? (items[items.length - 1] as any)?.createdAt : null;
      return res.json({ items, nextCursor });
    } catch (err) {
      return next(err);
    }
  });

  // --- Admin metrics (minimal) ---
  app.get("/api/admin/metrics", requireAuth, requirePermission("view_metrics"), async (_req, res, next) => {
    try {
      if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
        return res.status(503).json({ message: "Metrics require MySQL storage" });
      }

      const db = getMysqlDb();
      const now = new Date();
      const since1h = new Date(now.getTime() - 60 * 60 * 1000);
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const payments24h = await Promise.all([
        db.select({ c: sql<number>`count(*)` }).from(paymentsTable).where(and(gte(paymentsTable.createdAt, since24h), eq(paymentsTable.status, "pending" as any))),
        db.select({ c: sql<number>`count(*)` }).from(paymentsTable).where(and(gte(paymentsTable.createdAt, since24h), eq(paymentsTable.status, "completed" as any))),
        db.select({ c: sql<number>`count(*)` }).from(paymentsTable).where(and(gte(paymentsTable.createdAt, since24h), eq(paymentsTable.status, "failed" as any))),
      ]);

      const builds1h = await Promise.all([
        db.select({ c: sql<number>`count(*)` }).from(buildJobs).where(and(gte(buildJobs.createdAt, since1h), eq(buildJobs.status, "queued" as any))),
        db.select({ c: sql<number>`count(*)` }).from(buildJobs).where(and(gte(buildJobs.createdAt, since1h), eq(buildJobs.status, "running" as any))),
        db.select({ c: sql<number>`count(*)` }).from(buildJobs).where(and(gte(buildJobs.createdAt, since1h), eq(buildJobs.status, "succeeded" as any))),
        db.select({ c: sql<number>`count(*)` }).from(buildJobs).where(and(gte(buildJobs.createdAt, since1h), eq(buildJobs.status, "failed" as any))),
      ]);

      return res.json({
        time: now.toISOString(),
        windows: {
          since1h: since1h.toISOString(),
          since24h: since24h.toISOString(),
        },
        payments: {
          last24h: {
            pending: Number(payments24h[0]?.[0]?.c ?? 0),
            completed: Number(payments24h[1]?.[0]?.c ?? 0),
            failed: Number(payments24h[2]?.[0]?.c ?? 0),
          },
        },
        builds: {
          last1h: {
            queued: Number(builds1h[0]?.[0]?.c ?? 0),
            running: Number(builds1h[1]?.[0]?.c ?? 0),
            succeeded: Number(builds1h[2]?.[0]?.c ?? 0),
            failed: Number(builds1h[3]?.[0]?.c ?? 0),
          },
        },
      });
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
      const amountPaise = (payment as any).amountPaise != null ? Number((payment as any).amountPaise) : Number((payment.amountInr || 0) * 100);
      doc.text(`₹${(amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, rowTop + 10, { align: 'right', width: 90 });

      doc.moveDown(4);

      // Subtotal and Total
      const subtotalY = doc.y;
      doc.fontSize(10).fillColor('#666666');
      doc.text('Subtotal:', 350, subtotalY);
      doc.fillColor('#1a1a1a').text(`₹${(amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, subtotalY, { align: 'right', width: 90 });
      
      doc.moveDown(0.5);
      doc.fillColor('#666666').text('GST (Included):', 350, doc.y);
      doc.fillColor('#1a1a1a').text('₹0.00', 450, doc.y, { align: 'right', width: 90 });
      
      doc.moveDown(0.5);
      doc.strokeColor('#e5e5e5').lineWidth(1).moveTo(350, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      
      doc.fontSize(12).fillColor('#1a1a1a').text('Total:', 350, doc.y, { continued: false });
      doc.fontSize(12).fillColor('#06b6d4').text(`₹${(amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, doc.y - 14, { align: 'right', width: 90 });

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

      const baseEntitlements = getEntitlements(user);
      const entitlements = {
        ...baseEntitlements,
        canPublishPlay:
          baseEntitlements.isActive &&
          (baseEntitlements.plan === "standard" || baseEntitlements.plan === "pro" || baseEntitlements.plan === "agency"),
      };
      const plan = (entitlements.plan || "starter") as any;

      if (!entitlements.canPublishPlay) {
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
        hasAabOutput: entitlements.canPublishPlay && appItem.status === "live",
        targetSdk: 34,
        hasDebugFlags: false,
        hasInternetPermission: true,
        iconSize: appItem.iconUrl ? 512 : 48, // Custom icons are larger
      };

      const result = validatePlayStoreReadiness(appItem, buildInfo);

      return res.json({
        ...result,
        plan,
        canSubmit: result.ready && entitlements.canPublishPlay,
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

      const baseEntitlements = getEntitlements(user);
      const entitlements = {
        ...baseEntitlements,
        canPublishPlay:
          baseEntitlements.isActive &&
          (baseEntitlements.plan === "standard" || baseEntitlements.plan === "pro" || baseEntitlements.plan === "agency"),
      };
      const plan = (entitlements.plan || "starter") as any;

      // Check if AAB is allowed for this plan
      if (!entitlements.canPublishPlay) {
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

  // Publish the latest AAB to Google Play Internal Testing (Standard/Pro)
  app.post("/api/apps/:id/publish/play/internal", requireAuth, publishLimiter, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!appId) return res.status(400).json({ message: "Missing app id" });

      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const baseEntitlements = getEntitlements(user);
      const entitlements = {
        ...baseEntitlements,
        canPublishPlay:
          baseEntitlements.isActive &&
          (baseEntitlements.plan === "standard" || baseEntitlements.plan === "pro" || baseEntitlements.plan === "agency"),
      };
      const plan = (entitlements.plan || "starter") as any;

      if (!entitlements.canPublishPlay) {
        return res.status(403).json({
          message: "Google Play publishing requires Standard plan or above.",
          requiresUpgrade: true,
          minimumPlan: "standard",
        });
      }

      if (appItem.status !== "live") {
        return res.status(409).json({ message: "Build not ready. Please build the app first." });
      }

      const pkg = String(appItem.packageName || "").trim();
      if (!pkg) {
        return res.status(400).json({ message: "Missing package name. Set a valid package name first." });
      }

      let credentials: PlayCredentials;
      try {
        credentials = await resolvePlayCredentialsForApp(appItem, user);
      } catch (err: any) {
        const msg = err?.message ? String(err.message) : "Missing Google Play credentials";
        return res.status(409).json({ message: msg });
      }

      let result: any;
      try {
        result = await withPlayPublishLock(appItem.id, () => playPublisher.publishToInternalTrack(appItem.id, credentials));
      } catch (err: any) {
        if (err?.status === 409) return res.status(409).json({ message: err.message || "Publish already in progress" });
        const msg = err?.message ? String(err.message) : "Google Play publish failed";
        if (msg.toLowerCase().includes("missing google play credentials")) {
          return res.status(503).json({
            message: "Google Play publishing is not configured on the server.",
            details: "Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (or GOOGLE_PLAY_SERVICE_ACCOUNT_B64) and grant the service account access in Play Console.",
          });
        }
        return res.status(500).json({ message: "Google Play publish failed", details: msg });
      }

      // Persist last publish info (best-effort)
      storage.updateApp(appItem.id, {
        lastPlayTrack: result.track,
        lastPlayVersionCode: result.versionCode,
        lastPlayPublishedAt: new Date(),
        lastPlayReleaseStatus: "completed",
      } as any).catch(() => {});

      // Audit log (best-effort)
      storage.createAuditLog({
        userId: user.id,
        action: "app.play.publish.internal",
        targetType: "app",
        targetId: appItem.id,
        metadata: { packageName: pkg, versionCode: result.versionCode, track: result.track },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});

      return res.json({
        message: "Published to Google Play Internal Testing",
        ...result,
        plan,
      });
    } catch (err) {
      return next(err);
    }
  });

  // Preflight publish checks (Phase 3)
  app.get("/api/apps/:id/publish/preflight", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const validation = validateForPublish(appItem);
      const policy = scanPolicy(appItem);

      const riskThreshold = Number(process.env.PUBLISH_POLICY_RISK_THRESHOLD || 0.7);
      const policyBlocked = policy.riskScore >= riskThreshold;

      return res.json({
        validation,
        policy,
        policyBlocked,
        policyRiskThreshold: riskThreshold,
      });
    } catch (err) {
      return next(err);
    }
  });

  // Phase 1: Owner requests production publishing (central mode only)
  app.post("/api/apps/:id/request-production", requireAuth, publishLimiter, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!appId) return res.status(400).json({ message: "Missing app id" });

      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const mode = (appItem as any)?.playPublishingMode === "user" ? "user" : "central";
      if (mode !== "central") {
        return res.status(409).json({ message: "Production approval is only required for Platform-managed publishing." });
      }

      const updated = await storage.updateApp(appItem.id, {
        playProductionStatus: "requested",
        playProductionRequestedAt: new Date(),
        playProductionDecisionAt: null,
        playProductionDecisionBy: null,
        playProductionDecisionReason: null,
      } as any);

      storage.createAuditLog({
        userId: user.id,
        action: "app.play.request_production",
        targetType: "app",
        targetId: appItem.id,
        metadata: { mode },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});

      return res.json({ ok: true, app: updated });
    } catch (err) {
      return next(err);
    }
  });

  // Phase 1: Admin approves/rejects production publish
  app.post("/api/apps/:id/admin/production-decision", requireAuth, publishLimiter, requireRole(["admin", "support"]), async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const body = z
        .object({
          approved: z.boolean(),
          reason: z.string().max(2000).optional(),
        })
        .strict()
        .parse(req.body);

      const appId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!appId) return res.status(400).json({ message: "Missing app id" });

      const appItem = await storage.getApp(appId);
      if (!appItem) return res.status(404).json({ message: "App not found" });

      const nextStatus = body.approved ? "approved" : "rejected";
      const updated = await storage.updateApp(appItem.id, {
        playProductionStatus: nextStatus,
        playProductionDecisionAt: new Date(),
        playProductionDecisionBy: user.id,
        playProductionDecisionReason: body.reason || null,
      } as any);

      storage.createAuditLog({
        userId: user.id,
        action: body.approved ? "app.play.approve_production" : "app.play.reject_production",
        targetType: "app",
        targetId: appItem.id,
        metadata: { reason: body.reason || null },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});

      return res.json({ ok: true, app: updated });
    } catch (err) {
      return next(err);
    }
  });

  // Phase 1+2+3: Publish to Google Play Production
  app.post("/api/apps/:id/publish/play/production", requireAuth, publishLimiter, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!appId) return res.status(400).json({ message: "Missing app id" });

      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const baseEntitlements = getEntitlements(user);
      const entitlements = {
        ...baseEntitlements,
        canPublishPlay:
          baseEntitlements.isActive &&
          (baseEntitlements.plan === "standard" || baseEntitlements.plan === "pro" || baseEntitlements.plan === "agency"),
      };
      const plan = (entitlements.plan || "starter") as any;

      if (!entitlements.canPublishPlay) {
        return res.status(403).json({
          message: "Google Play publishing requires Standard plan or above.",
          requiresUpgrade: true,
          minimumPlan: "standard",
        });
      }

      if (appItem.status !== "live") {
        return res.status(409).json({ message: "Build not ready. Please build the app first." });
      }

      const pkg = String(appItem.packageName || "").trim();
      if (!pkg) return res.status(400).json({ message: "Missing package name." });

      // Phase 3: validation + policy scan
      const validation = validateForPublish(appItem);
      if (!validation.isValid) {
        return res.status(422).json({
          message: "Publish blocked: validation failed",
          validation,
        });
      }

      const policy = scanPolicy(appItem);
      const riskThreshold = Number(process.env.PUBLISH_POLICY_RISK_THRESHOLD || 0.7);
      const policyBlocked = policy.riskScore >= riskThreshold;
      if (policyBlocked && !isStaff(user)) {
        return res.status(422).json({
          message: "Publish blocked: policy risk too high",
          policy,
          policyRiskThreshold: riskThreshold,
        });
      }

      const mode = (appItem as any)?.playPublishingMode === "user" ? "user" : "central";
      if (mode === "central") {
        const status = String((appItem as any)?.playProductionStatus || "none");
        if (status !== "approved") {
          return res.status(409).json({
            message: "Production publishing requires admin approval. Request production approval first.",
            playProductionStatus: status,
          });
        }
      }

      let credentials: PlayCredentials;
      try {
        credentials = await resolvePlayCredentialsForApp(appItem, user);
      } catch (err: any) {
        return res.status(409).json({ message: err?.message || "Missing Google Play credentials" });
      }

      let result: any;
      try {
        result = await withPlayPublishLock(appItem.id, () => playPublisher.publishToProduction(appItem.id, credentials));
      } catch (err: any) {
        if (err?.status === 409) return res.status(409).json({ message: err.message || "Publish already in progress" });
        const msg = err?.message ? String(err.message) : "Google Play publish failed";
        return res.status(500).json({ message: "Google Play publish failed", details: msg });
      }

      await storage.updateApp(appItem.id, {
        lastPlayTrack: result.track,
        lastPlayVersionCode: result.versionCode,
        lastPlayPublishedAt: new Date(),
        lastPlayReleaseStatus: "completed",
      } as any);

      storage.createAuditLog({
        userId: user.id,
        action: "app.play.publish.production",
        targetType: "app",
        targetId: appItem.id,
        metadata: { packageName: pkg, versionCode: result.versionCode, track: result.track, mode },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});

      return res.json({
        message: "Published to Google Play Production",
        ...result,
        plan,
      });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/apps/:id/publish/play/promote", requireAuth, publishLimiter, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!appId) return res.status(400).json({ message: "Missing app id" });

      const appItem = await storage.getApp(appId);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const body = z
        .object({
          fromTrack: z.enum(["internal", "alpha", "beta", "production"]),
          toTrack: z.enum(["internal", "alpha", "beta", "production"]),
        })
        .strict()
        .parse(req.body);

      let credentials: PlayCredentials;
      try {
        credentials = await resolvePlayCredentialsForApp(appItem, user);
      } catch (err: any) {
        return res.status(409).json({ message: err?.message || "Missing Google Play credentials" });
      }

      const result = await withPlayPublishLock(appItem.id, () => playPublisher.promoteTrack(appItem.id, body.fromTrack as PlayTrack, body.toTrack as PlayTrack, credentials));

      storage.createAuditLog({
        userId: user.id,
        action: "app.play.promote",
        targetType: "app",
        targetId: appItem.id,
        metadata: result,
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  // Health endpoint (Phase 3)
  app.get("/api/apps/:id/health", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthedUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const appItem = await storage.getApp(req.params.id);
      if (!appItem || (!isStaff(user) && appItem.ownerId !== user.id)) {
        return res.status(404).json({ message: "App not found" });
      }

      const pkg = String(appItem.packageName || "").trim();
      let release: any = null;
      let releaseError: string | null = null;

      if (pkg) {
        try {
          const credentials = await resolvePlayCredentialsForApp(appItem, user);
          release = await playPublisher.checkReleaseStatus(pkg, credentials);
        } catch (err: any) {
          releaseError = err?.message ? String(err.message) : "Failed to fetch release status";
        }
      }

      storage.createAuditLog({
        userId: user.id,
        action: "app.health.check",
        targetType: "app",
        targetId: appItem.id,
        metadata: { hasPackageName: !!pkg },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {});

      return res.json({
        appId: appItem.id,
        crashRate7d: (appItem as any).crashRate7d ?? null,
        lastCrashAt: (appItem as any).lastCrashAt ?? null,
        publishing: {
          mode: (appItem as any)?.playPublishingMode || "central",
          productionStatus: (appItem as any)?.playProductionStatus || "none",
          lastTrack: (appItem as any)?.lastPlayTrack || null,
          lastVersionCode: (appItem as any)?.lastPlayVersionCode || null,
          lastPublishedAt: (appItem as any)?.lastPlayPublishedAt || null,
          lastReleaseStatus: (appItem as any)?.lastPlayReleaseStatus || null,
        },
        release,
        releaseError,
      });
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
          return res.status(402).json({
            code: "plan_required",
            requiresUpgrade: true,
            feature: "push_notifications",
            requiredPlan: "standard",
            message: "Push notifications are not available on Starter plan. Upgrade to Standard or Pro.",
          });
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
          return res.status(402).json({
            code: "plan_required",
            requiresUpgrade: true,
            feature: "push_notifications",
            requiredPlan: "standard",
            message: "Push notifications are not available on Starter plan. Upgrade to Standard or Pro.",
          });
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
            const matches = Array.from(html.matchAll(pattern));
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
            const matches = Array.from(html.matchAll(pattern));
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
          const styleMatches = Array.from(html.matchAll(/style=["'][^"']*(?:background(?:-color)?|color|border-color):\s*([#][0-9A-Fa-f]{3,6})[^"']*["']/gi));
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
            const matches = Array.from(styleTagContent.matchAll(pattern));
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
          for (const match of Array.from(allHexColors)) {
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
                const fillMatches = Array.from(svgText.matchAll(/(?:fill|stroke)=["']#([0-9A-Fa-f]{3,6})["']/gi));
                for (const match of fillMatches) {
                  const normalized = normalizeHexColor(`#${match[1]}`);
                  if (normalized && !isGenericColor(normalized)) {
                    svgColors.push(normalized);
                  }
                }
                // Also check style attributes
                const styleMatches = Array.from(svgText.matchAll(/(?:fill|stroke):\s*#([0-9A-Fa-f]{3,6})/gi));
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
              const imageBuffer = Buffer.from(await logoRes.arrayBuffer());
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
          // Get unique colors that aren't the primary (avoid downlevel Set iteration)
          const uniqueColors: string[] = [];
          for (const c of allExtractedColors) {
            if (!c || c === primaryColor) continue;
            if (!uniqueColors.includes(c)) uniqueColors.push(c);
          }
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

  // 6b. Visual Editor Agent (structured edit operations)
  app.post("/api/ai/visual-editor/command", requireAuth, aiRateLimit, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        prompt: z.string().min(1).max(1200),
        context: z.any().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { generateVisualEditorCommand } = await import("./llm");
      const result = await generateVisualEditorCommand({
        prompt: parsed.data.prompt,
        context: (parsed.data.context ?? {}) as any,
      });

      return res.json(result);
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

  // 8. Parse App Prompt (AI App Builder)
  app.post("/api/ai/parse-prompt", aiRateLimit, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        prompt: z.string().min(10).max(2000),
        industryHint: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input. Prompt must be 10-2000 characters." });
      }

      const { parseAppPrompt } = await import("./llm");
      const result = await parseAppPrompt(parsed.data.prompt, parsed.data.industryHint);
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  // 9. Generate Screen Content (for native screens)
  app.post("/api/ai/generate-screen", aiRateLimit, async (req, res, next) => {
    try {
      if (!isLLMConfigured()) {
        return res.status(503).json({ message: "AI features not available" });
      }

      const schema = z.object({
        screenType: z.string(),
        appName: z.string(),
        appDescription: z.string(),
        businessInfo: z.object({
          name: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
        }).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { generateScreenContent } = await import("./llm");
      const result = await generateScreenContent(
        parsed.data.screenType,
        parsed.data.appName,
        parsed.data.appDescription,
        parsed.data.businessInfo
      );
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  return httpServer;

}
