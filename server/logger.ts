import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

function levelValue(level: LogLevel): number {
  switch (level) {
    case "debug":
      return 10;
    case "info":
      return 20;
    case "warn":
      return 30;
    case "error":
      return 40;
    case "critical":
      return 50;
    default:
      return 20;
  }
}

const isProd = process.env.NODE_ENV === "production";
const minLevel: LogLevel = ((process.env.LOG_LEVEL || "") as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return levelValue(level) >= levelValue(minLevel);
}

function nowIso(): string {
  return new Date().toISOString();
}

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  const id = u?.id;
  return typeof id === "string" ? id : id ? String(id) : null;
}

type LogPayload = Record<string, unknown> & {
  level: LogLevel;
  time: string;
  msg: string;
};

function writeLog(payload: LogPayload) {
  if (!shouldLog(payload.level)) return;
  const line = JSON.stringify(payload);
  if (payload.level === "error" || payload.level === "critical") console.error(line);
  else console.log(line);
}

export const logger = {
  info(msg: string, fields?: Record<string, unknown>) {
    writeLog({ level: "info", time: nowIso(), msg, ...(fields || {}) });
  },
  critical(msg: string, fields?: Record<string, unknown>) {
    writeLog({ level: "critical", time: nowIso(), msg, ...(fields || {}) });
  },
  error(msg: string, fields?: Record<string, unknown>) {
    writeLog({ level: "error", time: nowIso(), msg, ...(fields || {}) });
  },
};

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

function shouldLogInfoRoute(req: Request): boolean {
  const p = req.path;
  if (p === "/api/payments/verify") return true;
  if (p === "/api/webhooks/razorpay") return true;

  // Build queue
  if (/^\/api\/apps\/[^/]+\/build$/.test(p)) return true;

  // Runtime create flows
  if (req.method === "POST" && /^\/api\/runtime\/[^/]+\/reservations$/.test(p)) return true;
  if (req.method === "POST" && /^\/api\/runtime\/[^/]+\/appointments$/.test(p)) return true;

  return false;
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!shouldLogInfoRoute(req)) return next();

  const startMs = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startMs;
    logger.info("request", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      userId: getUserId(req),
      status: res.statusCode,
      durationMs,
    });
  });

  next();
}

let errorHook: ((err: unknown, ctx: { requestId?: string; userId?: string | null; path?: string }) => void) | null = null;

// Optional Sentry-style hook (no dependency required)
export function setErrorHook(
  hook: (err: unknown, ctx: { requestId?: string; userId?: string | null; path?: string }) => void,
) {
  errorHook = hook;
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  const requestId = req.requestId;
  const userId = getUserId(req);

  if (err instanceof ZodError) {
    const pretty = fromZodError(err);
    logger.error("request.validation_error", {
      requestId,
      userId,
      method: req.method,
      path: req.path,
      message: pretty.message,
      issues: err.issues,
    });
    return res.status(400).json({ message: "Invalid request", requestId });
  }

  const status = Number(err?.status || err?.statusCode || 500);
  const message = typeof err?.message === "string" && err.message ? err.message : "Internal Server Error";

  const fields: Record<string, unknown> = {
    requestId,
    userId,
    method: req.method,
    path: req.path,
    status,
    message,
  };

  if (!isProd && err?.stack) fields.stack = String(err.stack);

  logger.error("request.error", fields);

  try {
    errorHook?.(err, { requestId, userId, path: req.path });
  } catch {
    // Never allow the hook to crash the request.
  }

  // Safe responses: no stack traces in production.
  if (isProd && status >= 500) {
    return res.status(status).json({ message: "Internal Server Error", requestId });
  }

  return res.status(status).json({ message, requestId });
}
