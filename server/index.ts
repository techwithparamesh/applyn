import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import MemoryStoreFactory from "memorystore";
import MySQLStoreFactory from "express-mysql-session";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./auth";
import { parseMysqlUrl } from "./db-mysql";
import { randomBytes } from "crypto";
import { runWorkerLoop } from "./worker";
import { startSubscriptionCronInterval } from "./subscription-cron";
import { errorHandler, requestIdMiddleware, requestLoggingMiddleware } from "./logger";

if (!process.env.APP_CUSTOMER_TOKEN_SECRET) {
  throw new Error("APP_CUSTOMER_TOKEN_SECRET must be set");
}

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const app = express();
const httpServer = createServer(app);

// Dev-only diagnostics: the dev server has been observed exiting with code 1
// after printing "serving on port ..." on some Windows setups.
if (process.env.NODE_ENV !== "production") {
  process.on("uncaughtException", (err) => {
    console.error("uncaughtException", err);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("unhandledRejection", reason);
  });
  httpServer.on("error", (err) => {
    console.error("httpServer error", err);
  });
}

declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Always attach a requestId (useful for tracing errors and admin support)
app.use(requestIdMiddleware);

// Basic security headers (lightweight, no extra deps)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const MemoryStore = MemoryStoreFactory(session);
const MysqlSession = MySQLStoreFactory(session);

const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET!;

function getAllowedOrigins() {
  const raw = (process.env.APP_ORIGINS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hostMatches(req: Request, urlString: string) {
  try {
    const u = new URL(urlString);
    const host = req.get("host");
    return !!host && u.host === host;
  } catch {
    return false;
  }
}

function isCsrfAllowed(req: Request) {
  // CSRF protection for cookie-based auth.
  // For state-changing requests, require Origin/Referer to match this host
  // or an explicit allowlist (APP_ORIGINS).
  const allowed = getAllowedOrigins();
  const origin = req.get("origin");
  if (origin) {
    if (hostMatches(req, origin)) return true;
    return allowed.includes(origin);
  }

  // Some clients may omit Origin; fall back to Referer.
  const referer = req.get("referer");
  if (referer) {
    if (hostMatches(req, referer)) return true;
    return allowed.some((o) => referer.startsWith(o));
  }

  // In production, reject requests with no Origin/Referer.
  return !isProd;
}

const sessionStore =
  process.env.SESSION_STORE === "mysql" && process.env.DATABASE_URL?.startsWith("mysql://")
    ? new MysqlSession({
        ...parseMysqlUrl(process.env.DATABASE_URL),
        createDatabaseTable: true,
        schema: {
          tableName: "sessions",
        },
      })
    : new MemoryStore({ checkPeriod: 1000 * 60 * 30 });

app.set("trust proxy", 1);

// CSRF mitigation for cookie sessions (production): block cross-origin state-changing requests.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (!isProd) return next();
  if (!isCsrfAllowed(req)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
});

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
    store: sessionStore,
  }),
);

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const normalized = username.trim().toLowerCase();
      const user = await storage.getUserByUsername(normalized);
      if (!user) return done(null, false, { message: "Invalid credentials" });
      const ok = await verifyPassword(password, user.password);
      if (!ok) return done(null, false, { message: "Invalid credentials" });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }),
);

const googleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
const googleClientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
const googleCallbackUrl = (process.env.GOOGLE_CALLBACK_URL || "").trim();

if (googleClientId && googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl || "/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.trim().toLowerCase();
          const displayName = (profile.displayName || "").trim();

          let user = await storage.getUserByGoogleId(googleId);

          // Link an existing email/password account if it matches the Google email.
          if (!user && email) {
            const existing = await storage.getUserByUsername(email);
            if (existing) {
              user = await storage.linkGoogleId(existing.id, googleId);
            }
          }

          if (!user) {
            if (!email) {
              return done(null, false, { message: "Google account has no email" });
            }

            const temp = `Google-${randomBytes(24).toString("hex")}`;
            const passwordHash = await hashPassword(temp);

            user = await storage.createUser({
              name: displayName || null,
              username: email,
              password: passwordHash,
              role: "user",
              googleId,
            } as any);
          }

          return done(null, user);
        } catch (err) {
          return done(err as any);
        }
      },
    ),
  );
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

app.use(passport.initialize());
app.use(passport.session());

// Structured request logging (only selected important routes)
app.use(requestLoggingMiddleware);

(async () => {
  await registerRoutes(httpServer, app);

  // Central error handler (safe JSON responses, requestId, structured logging)
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5004 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5004", 10);
  const listenOptions: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: "0.0.0.0",
  };

  // Windows doesn't support SO_REUSEPORT; Node throws ENOTSUP.
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  httpServer.listen(listenOptions, () => {
    log(`serving on port ${port}`);

    // Start subscription cron job (runs daily to handle expirations and reminders)
    if (isProd) {
      startSubscriptionCronInterval();
    }

    // Dev-only convenience: run the worker loop in-process.
    // This is primarily for local E2E sanity checks on machines without MySQL/Docker.
    if (!isProd) {
      const raw = (process.env.INLINE_WORKER || "").trim().toLowerCase();
      const enabled = raw === "1" || raw === "true" || raw === "yes";
      if (enabled) {
        if (!process.env.DATABASE_URL) {
          runWorkerLoop().catch((err) => {
            console.error("Inline worker crashed", err);
          });
        } else {
          console.warn(
            "INLINE_WORKER is ignored when DATABASE_URL is set; run `npm run worker` as a separate process instead.",
          );
        }
      }
    }
  });
})();
