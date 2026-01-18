import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStoreFactory from "memorystore";
import MySQLStoreFactory from "express-mysql-session";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { verifyPassword } from "./auth";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { parseMysqlUrl } from "./db-mysql";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
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

function safeJsonStringify(value: unknown) {
  try {
    const json = JSON.stringify(
      value,
      (key, v) => {
        const lower = key.toLowerCase();
        if (
          lower.includes("password") ||
          lower.includes("token") ||
          lower.includes("secret")
        ) {
          return "[REDACTED]";
        }
        return v;
      },
      0,
    );
    // Avoid massive log lines
    return json.length > 4000 ? `${json.slice(0, 4000)}…(truncated)` : json;
  } catch {
    return "[unstringifiable]";
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${safeJsonStringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

const MemoryStore = MemoryStoreFactory(session);
const MysqlSession = MySQLStoreFactory(session);

const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-me";
if (isProd && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required in production");
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

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
      const pretty = fromZodError(err);
      if (res.headersSent) return next(err);
      return res.status(400).json({
        message: "Invalid request",
        details: pretty.message,
        issues: err.issues,
      });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

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
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
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
  });
})();
