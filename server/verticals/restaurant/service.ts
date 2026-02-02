import crypto from "crypto";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { getMysqlDb } from "../../db-mysql";
import {
  appRestaurantAvailabilityWindows,
  appRestaurantMenuCategories,
  appRestaurantMenuItems,
  appRestaurantOrderItems,
  appRestaurantOrders,
  appRestaurantReservations,
  appRestaurantTables,
} from "@shared/db.mysql";
import type { EmitAppEvent } from "./events";
import { restaurantEvents } from "./events";
import {
  assertKitchenTransition,
  assertReservationTransition,
  normalizeKitchenStatus,
  normalizeReservationStatus,
  type KitchenStatus,
  type ReservationStatus,
} from "./state";

type Audit = (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => Promise<void>;

function parseIsoDate(s: string) {
  const d = new Date(s);
  if (!(d instanceof Date) || isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

function dayOfWeek(date: Date) {
  return date.getDay();
}

function hhmm(date: Date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function timeInRange(t: string, start: string, end: string) {
  // assumes same-day window; 24h wrap not supported
  return t >= start && t <= end;
}

function overlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

export function restaurantService(deps: { emit: EmitAppEvent; audit?: Audit }) {
  const events = restaurantEvents(deps.emit);

  return {
    async listReservationsForCustomer(input: { appId: string; customerId: string }) {
      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appRestaurantReservations)
        .where(and(eq(appRestaurantReservations.appId, input.appId), eq(appRestaurantReservations.customerId, input.customerId)))
        .orderBy(desc(appRestaurantReservations.reservedAt));

      return (rows as any[]).map((r) => ({
        id: String(r.id),
        status: String(r.status),
        partySize: Number(r.partySize || 2),
        reservedAt: (r.reservedAt instanceof Date ? r.reservedAt.toISOString() : String(r.reservedAt)),
        notes: r.notes ?? "",
      }));
    },

    async createReservation(input: {
      appId: string;
      customerId: string;
      partySize: number;
      reservedAtIso: string;
      durationMinutes?: number;
      tableId?: string;
      notes?: string;
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const reservedAt = parseIsoDate(input.reservedAtIso);
      // 5-minute tolerance for client clock skew
      if (reservedAt.getTime() < now.getTime() - 5 * 60 * 1000) throw new Error("Reservation must be in the future");

      // Availability windows (best-effort): if configured, enforce.
      const windows = await db
        .select()
        .from(appRestaurantAvailabilityWindows)
        .where(and(eq(appRestaurantAvailabilityWindows.appId, input.appId), eq(appRestaurantAvailabilityWindows.active, 1), eq(appRestaurantAvailabilityWindows.kind, "reservation")));

      if (windows.length > 0) {
        const t = hhmm(reservedAt);
        const dow = dayOfWeek(reservedAt);
        const ok = windows.some((w: any) => Number(w.dayOfWeek) === dow && timeInRange(t, String(w.startTime), String(w.endTime)));
        if (!ok) throw new Error("Restaurant is not available for reservations at this time");
      }

      const durationMinutes = Math.max(15, Math.min(360, Math.trunc(input.durationMinutes ?? 90)));
      const endAt = new Date(reservedAt.getTime() + durationMinutes * 60 * 1000);

      const result = await db.transaction(async (tx) => {
        const reservationId = crypto.randomUUID();

        let tables: any[] = [];
        if (input.tableId) {
          const rows = await tx
            .select({ id: appRestaurantTables.id, capacity: appRestaurantTables.capacity })
            .from(appRestaurantTables)
            .where(and(eq(appRestaurantTables.appId, input.appId), eq(appRestaurantTables.id, input.tableId), eq(appRestaurantTables.active, 1)))
            .limit(1);
          const t: any = rows[0];
          if (!t) throw new Error("Invalid table");
          tables = [t];
        } else {
          tables = (await tx
            .select({ id: appRestaurantTables.id, capacity: appRestaurantTables.capacity })
            .from(appRestaurantTables)
            .where(and(eq(appRestaurantTables.appId, input.appId), eq(appRestaurantTables.active, 1)))
            .orderBy(desc(appRestaurantTables.capacity))) as any[];
        }

        let chosenTableId: string | null = null;

        for (const table of tables) {
          const cap = Number(table.capacity || 0);
          if (cap < input.partySize) continue;

          // Row-level lock: serialize reservations per table to prevent check-then-insert races.
          await tx
            .update(appRestaurantTables)
            .set({ updatedAt: sql`${appRestaurantTables.updatedAt}` } as any)
            .where(and(eq(appRestaurantTables.appId, input.appId), eq(appRestaurantTables.id, String(table.id))));

          const conflicts = await tx
            .select({ id: appRestaurantReservations.id, reservedAt: appRestaurantReservations.reservedAt, durationMinutes: appRestaurantReservations.durationMinutes })
            .from(appRestaurantReservations)
            .where(
              and(
                eq(appRestaurantReservations.appId, input.appId),
                eq(appRestaurantReservations.tableId, String(table.id)),
                or(
                  eq(appRestaurantReservations.status, "requested"),
                  eq(appRestaurantReservations.status, "confirmed"),
                  eq(appRestaurantReservations.status, "seated"),
                ),
                // quick bounding box to limit rows
                gte(appRestaurantReservations.reservedAt, new Date(reservedAt.getTime() - 6 * 60 * 60 * 1000)),
                lte(appRestaurantReservations.reservedAt, new Date(reservedAt.getTime() + 6 * 60 * 60 * 1000)),
              ),
            );

          const hasOverlap = (conflicts as any[]).some((r) => {
            const startB = r.reservedAt as Date;
            const dur = Number(r.durationMinutes || 90);
            const endB = new Date(startB.getTime() + dur * 60 * 1000);
            return overlap(reservedAt, endAt, startB, endB);
          });

          if (!hasOverlap) {
            chosenTableId = String(table.id);
            break;
          }
        }

        if (!chosenTableId) {
          if (input.tableId) throw new Error("Selected table is already booked for that time");
          throw new Error("No table available for the selected time");
        }

        await tx.insert(appRestaurantReservations).values({
          id: reservationId,
          appId: input.appId,
          customerId: input.customerId,
          tableId: chosenTableId,
          partySize: input.partySize,
          reservedAt,
          durationMinutes,
          notes: input.notes ?? null,
          status: "requested",
          createdAt: now,
          updatedAt: now,
        } as any);

        return { reservationId, tableId: chosenTableId };
      });

      await events.reservationCreated(input.appId, input.customerId, {
        reservationId: result.reservationId,
        reservedAt: reservedAt.toISOString(),
        partySize: input.partySize,
      });

      if (deps.audit) {
        await deps.audit({
          userId: null,
          action: "restaurant.reservation.created",
          targetType: "reservation",
          targetId: result.reservationId,
          metadata: { appId: input.appId, customerId: input.customerId, reservedAt: reservedAt.toISOString() },
        });
      }

      return { id: result.reservationId, status: "requested" as const, tableId: result.tableId };
    },

    async transitionReservationStatus(input: {
      appId: string;
      reservationId: string;
      actorUserId?: string | null;
      status: ReservationStatus;
      tableId?: string;
    }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({ id: appRestaurantReservations.id, status: appRestaurantReservations.status, customerId: appRestaurantReservations.customerId })
        .from(appRestaurantReservations)
        .where(and(eq(appRestaurantReservations.appId, input.appId), eq(appRestaurantReservations.id, input.reservationId)))
        .limit(1);
      const row: any = rows[0];
      if (!row) throw new Error("Reservation not found");

      const from = normalizeReservationStatus(row.status);
      assertReservationTransition(from, input.status);

      const result = await db
        .update(appRestaurantReservations)
        .set({ status: input.status, tableId: input.tableId ?? undefined, updatedAt: now } as any)
        .where(
          and(
            eq(appRestaurantReservations.appId, input.appId),
            eq(appRestaurantReservations.id, input.reservationId),
            eq(appRestaurantReservations.status, String(row.status)),
          ),
        );

      const affected =
        (result as any)?.rowsAffected ??
        (result as any)?.affectedRows ??
        (result as any)?.[0]?.affectedRows ??
        0;

      if (input.status === "confirmed" && Number(affected) === 1) {
        await events.reservationConfirmed(input.appId, String(row.customerId), { reservationId: input.reservationId });
      }

      if (deps.audit && Number(affected) === 1) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "restaurant.reservation.status_changed",
          targetType: "reservation",
          targetId: input.reservationId,
          metadata: { appId: input.appId, from, to: input.status },
        });
      }

      return { ok: true as const, from, to: input.status };
    },

    async createMenuCategory(input: { appId: string; name: string; sortOrder?: number; active?: boolean }) {
      const db = getMysqlDb();
      const now = new Date();
      const id = crypto.randomUUID();
      await db.insert(appRestaurantMenuCategories).values({
        id,
        appId: input.appId,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
        active: input.active === false ? 0 : 1,
        createdAt: now,
        updatedAt: now,
      } as any);
      return { id };
    },

    async createMenuItem(input: {
      appId: string;
      categoryId?: string;
      name: string;
      description?: string;
      imageUrl?: string;
      currency?: string;
      priceCents: number;
      prepTimeMinutes?: number;
      active?: boolean;
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const id = crypto.randomUUID();
      await db.insert(appRestaurantMenuItems).values({
        id,
        appId: input.appId,
        categoryId: input.categoryId ?? null,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        currency: (input.currency || "INR").slice(0, 8).toUpperCase(),
        priceCents: input.priceCents,
        prepTimeMinutes: input.prepTimeMinutes ?? 15,
        active: input.active === false ? 0 : 1,
        createdAt: now,
        updatedAt: now,
      } as any);
      return { id };
    },

    async createRestaurantTable(input: { appId: string; name: string; capacity: number; active?: boolean }) {
      const db = getMysqlDb();
      const now = new Date();
      const id = crypto.randomUUID();
      await db.insert(appRestaurantTables).values({
        id,
        appId: input.appId,
        name: input.name,
        capacity: input.capacity,
        active: input.active === false ? 0 : 1,
        createdAt: now,
        updatedAt: now,
      } as any);
      return { id };
    },

    async createOrder(input: {
      appId: string;
      customerId: string | null;
      fulfillmentType: "dine_in" | "pickup" | "delivery";
      scheduledAtIso?: string;
      notes?: string;
      items: Array<{ itemId: string; quantity: number; modifiers?: any }>;
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const orderId = crypto.randomUUID();

      const scheduledAt = input.scheduledAtIso ? parseIsoDate(input.scheduledAtIso) : null;

      return await db.transaction(async (tx) => {
        const itemIds = Array.from(new Set(input.items.map((i) => i.itemId)));
        const menuItems = await tx
          .select()
          .from(appRestaurantMenuItems)
          .where(and(eq(appRestaurantMenuItems.appId, input.appId), inArray(appRestaurantMenuItems.id, itemIds)));
        const byId = new Map(menuItems.map((m: any) => [String(m.id), m]));
        const missing = input.items.find((i) => !byId.has(String(i.itemId)));
        if (missing) throw new Error("Invalid menu item");

        let totalCents = 0;
        const lineRows = input.items.map((i) => {
          const m: any = byId.get(String(i.itemId));
          if (!m || Number(m.active) !== 1) throw new Error("Menu item unavailable");
          const qty = Math.max(1, Math.min(99, Math.trunc(i.quantity || 1)));
          const unit = Number(m.priceCents || 0);
          const line = unit * qty;
          totalCents += line;
          return {
            id: crypto.randomUUID(),
            orderId,
            itemId: String(m.id),
            name: String(m.name),
            quantity: qty,
            unitPriceCents: unit,
            lineTotalCents: line,
            modifiers: i.modifiers ? JSON.stringify(i.modifiers) : null,
            createdAt: now,
          };
        });

        await tx.insert(appRestaurantOrders).values({
          id: orderId,
          appId: input.appId,
          customerId: input.customerId,
          fulfillmentType: input.fulfillmentType,
          status: "created",
          kitchenStatus: "queued",
          scheduledAt,
          currency: "INR",
          totalCents,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        } as any);

        await tx.insert(appRestaurantOrderItems).values(lineRows as any);
        return { id: orderId, totalCents, kitchenStatus: "queued" as const };
      });
    },

    async updateKitchenStatus(input: { appId: string; orderId: string; actorUserId?: string | null; kitchenStatus: KitchenStatus }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({ id: appRestaurantOrders.id, kitchenStatus: appRestaurantOrders.kitchenStatus, customerId: appRestaurantOrders.customerId })
        .from(appRestaurantOrders)
        .where(and(eq(appRestaurantOrders.appId, input.appId), eq(appRestaurantOrders.id, input.orderId)))
        .limit(1);
      const row: any = rows[0];
      if (!row) throw new Error("Order not found");

      const from = normalizeKitchenStatus(row.kitchenStatus);
      assertKitchenTransition(from, input.kitchenStatus);

      await db
        .update(appRestaurantOrders)
        .set({ kitchenStatus: input.kitchenStatus, updatedAt: now } as any)
        .where(and(eq(appRestaurantOrders.appId, input.appId), eq(appRestaurantOrders.id, input.orderId)));

      if (input.kitchenStatus === "ready") {
        await events.orderKitchenReady(input.appId, row.customerId ? String(row.customerId) : null, { orderId: input.orderId });
      }

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "restaurant.order.kitchen_status_changed",
          targetType: "restaurant_order",
          targetId: input.orderId,
          metadata: { appId: input.appId, from, to: input.kitchenStatus },
        });
      }

      return { ok: true as const, from, to: input.kitchenStatus };
    },

    async listKitchenTickets(input: { appId: string }) {
      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appRestaurantOrders)
        .where(
          and(
            eq(appRestaurantOrders.appId, input.appId),
            or(
              eq(appRestaurantOrders.kitchenStatus, "queued"),
              eq(appRestaurantOrders.kitchenStatus, "preparing"),
              eq(appRestaurantOrders.kitchenStatus, "ready"),
            ),
          ),
        )
        .orderBy(desc(appRestaurantOrders.createdAt));
      return rows;
    },
  };
}
