import type { NextFunction, Request, Response } from "express";
import type { User } from "@shared/schema";

export const ALLOWED_PERMISSIONS = [
  "view_metrics",
  "view_payments",
  "view_orders",
  "view_reservations",
  "view_appointments",
  "manage_users",
  "manage_refunds",
  "manage_builds",
] as const;

export type AllowedPermission = (typeof ALLOWED_PERMISSIONS)[number];

function roleOf(user: User | null): "admin" | "staff" | "user" {
  const raw = (user as any)?.role;
  if (raw === "admin") return "admin";
  // Backward compatibility: role="support" is treated as staff.
  if (raw === "staff" || raw === "support") return "staff";
  return "user";
}

function permissionsOf(user: User | null): string[] {
  const raw: unknown = (user as any)?.permissions;
  if (Array.isArray(raw)) return raw.filter((p) => typeof p === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((p) => typeof p === "string");
    } catch {
      // ignore
    }
  }
  return [];
}

export function hasPermission(user: User | null, permission: string): boolean {
  const role = roleOf(user);
  if (role === "admin") return true;
  if (role !== "staff") return false;
  return permissionsOf(user).includes(permission);
}

export function requirePermission(permission: AllowedPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = ((req as any).user as User | undefined) ?? null;
    if (!(req as any).isAuthenticated?.() || !user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!hasPermission(user, permission)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

export function isStaffUser(user: User | null): boolean {
  return roleOf(user) === "staff";
}

export function normalizeAndValidatePermissions(input: unknown): { ok: true; permissions: AllowedPermission[] } | { ok: false; message: string } {
  if (!Array.isArray(input)) return { ok: false, message: "permissions must be an array" };
  const perms = input.filter((p) => typeof p === "string") as string[];
  const invalid = perms.filter((p) => !(ALLOWED_PERMISSIONS as readonly string[]).includes(p));
  if (invalid.length) {
    return { ok: false, message: `Invalid permissions: ${invalid.slice(0, 10).join(", ")}` };
  }
  return { ok: true, permissions: perms as AllowedPermission[] };
}
