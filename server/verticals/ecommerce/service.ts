import crypto from "crypto";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { getMysqlDb } from "../../db-mysql";
import {
  appCoupons,
  appEcommerceSettings,
  appInventory,
  appInventoryMovements,
  appOrderAddresses,
  appOrderItems,
  appOrderRefunds,
  appOrders,
  appProductVariants,
  appProducts,
  appShippingMethods,
} from "@shared/db.mysql";
import { assertEcommerceOrderTransition, normalizeEcommerceOrderStatus, type EcommerceOrderStatus } from "./state";
import type { EmitAppEvent } from "./events";
import { ecommerceEvents } from "./events";

type Audit = (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => Promise<void>;

function clampInt(n: number) {
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function calcPercent(value: number, bps: number) {
  const v = clampInt(value);
  const bp = clampInt(bps);
  if (bp <= 0) return 0;
  return Math.max(0, Math.floor((v * bp) / 10_000));
}

async function getTaxRateBps(appId: string) {
  const db = getMysqlDb();
  const rows = await db
    .select({ taxRateBps: appEcommerceSettings.taxRateBps })
    .from(appEcommerceSettings)
    .where(eq(appEcommerceSettings.appId, appId))
    .limit(1);
  const raw = rows[0]?.taxRateBps;
  const n = typeof raw === "number" ? raw : Number(raw || 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(10_000, Math.trunc(n))) : 0;
}

export function ecommerceService(deps: { emit: EmitAppEvent; audit?: Audit }) {
  const events = ecommerceEvents(deps.emit);

  return {
    async listOrdersForCustomer(input: { appId: string; customerId: string }) {
      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appOrders)
        .where(and(eq(appOrders.appId, input.appId), eq(appOrders.customerId, input.customerId)))
        .orderBy(desc(appOrders.createdAt));

      return (rows as any[]).map((o) => ({
        id: String(o.id),
        status: String(o.status),
        totalCents: Number(o.totalCents || 0),
        currency: String(o.currency || "INR"),
        paymentProvider: o.paymentProvider ?? null,
        paymentStatus: String(o.paymentStatus || "pending"),
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }));
    },

    async adminListProducts(input: { appId: string }) {
      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appProducts)
        .where(eq(appProducts.appId, input.appId))
        .orderBy(desc(appProducts.updatedAt));
      return rows as any[];
    },

    async adminCreateProduct(input: {
      appId: string;
      actorUserId?: string | null;
      name: string;
      description?: string | null;
      imageUrl?: string | null;
      sku?: string | null;
      priceCents: number;
      currency?: string;
      active?: boolean;
    }) {
      const db = getMysqlDb();
      const id = crypto.randomUUID();
      const now = new Date();

      await db.insert(appProducts).values({
        id,
        appId: input.appId,
        sku: input.sku ?? null,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        currency: input.currency || "INR",
        priceCents: clampInt(input.priceCents),
        active: input.active === false ? 0 : 1,
        createdAt: now,
        updatedAt: now,
      } as any);

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "ecommerce.product.created",
          targetType: "product",
          targetId: id,
          metadata: { appId: input.appId },
        });
      }

      return { id };
    },

    async adminUpdateProduct(input: {
      appId: string;
      productId: string;
      actorUserId?: string | null;
      patch: {
        name?: string;
        description?: string | null;
        imageUrl?: string | null;
        sku?: string | null;
        priceCents?: number;
        currency?: string;
        active?: boolean;
      };
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const update: any = { updatedAt: now };

      if (typeof input.patch.name === "string") update.name = input.patch.name;
      if (input.patch.description !== undefined) update.description = input.patch.description;
      if (input.patch.imageUrl !== undefined) update.imageUrl = input.patch.imageUrl;
      if (input.patch.sku !== undefined) update.sku = input.patch.sku;
      if (typeof input.patch.priceCents === "number") update.priceCents = clampInt(input.patch.priceCents);
      if (typeof input.patch.currency === "string") update.currency = input.patch.currency;
      if (typeof input.patch.active === "boolean") update.active = input.patch.active ? 1 : 0;

      await db
        .update(appProducts)
        .set(update)
        .where(and(eq(appProducts.appId, input.appId), eq(appProducts.id, input.productId)));

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "ecommerce.product.updated",
          targetType: "product",
          targetId: input.productId,
          metadata: { appId: input.appId },
        });
      }

      return { ok: true as const };
    },

    async adminListOrders(input: { appId: string }) {
      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appOrders)
        .where(eq(appOrders.appId, input.appId))
        .orderBy(desc(appOrders.createdAt));
      return rows as any[];
    },

    async createOrder(input: {
      appId: string;
      customerId: string;
      items: Array<{ productId: string; variantId?: string; quantity: number }>;
      notes?: string;
      paymentProvider: "cod" | "razorpay" | "stripe";
      couponCode?: string;
      shippingMethodId?: string;
      shippingAddress?: {
        name: string;
        phone?: string;
        line1: string;
        line2?: string;
        city: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const orderId = crypto.randomUUID();

      const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
      const variantIds = Array.from(new Set(input.items.map((i) => i.variantId).filter(Boolean) as string[]));

      const result = await db.transaction(async (tx) => {
        const products = await tx
          .select()
          .from(appProducts)
          .where(and(eq(appProducts.appId, input.appId), inArray(appProducts.id, productIds)));
        const byProductId = new Map(products.map((p: any) => [String(p.id), p]));

        if (variantIds.length > 0) {
          const variants = await tx
            .select()
            .from(appProductVariants)
            .where(and(eq(appProductVariants.appId, input.appId), inArray(appProductVariants.id, variantIds)));
          const byVariantId = new Map(variants.map((v: any) => [String(v.id), v]));

          const missingVariant = variantIds.find((id) => !byVariantId.has(String(id)));
          if (missingVariant) throw new Error("Invalid variant");

          for (const item of input.items) {
            if (item.variantId) {
              const v: any = byVariantId.get(String(item.variantId));
              if (String(v.productId) !== String(item.productId)) throw new Error("Variant does not match product");
            }
          }

          // Load inventory for variants/products in one go
          const invRows = await tx
            .select()
            .from(appInventory)
            .where(and(eq(appInventory.appId, input.appId), inArray(appInventory.productId, productIds)));

          const invKey = (productId: string, variantId?: string) => `${productId}:${variantId || ""}`;
          const invByKey = new Map(invRows.map((r: any) => [invKey(String(r.productId), r.variantId ? String(r.variantId) : ""), r]));

          // Pricing + stock validation
          let subtotalCents = 0;
          const lineRows = input.items.map((item) => {
            const p: any = byProductId.get(String(item.productId));
            if (!p) throw new Error("Invalid product");
            if (Number(p.active) !== 1) throw new Error("Product inactive");

            const v: any = item.variantId ? byVariantId.get(String(item.variantId)) : null;
            if (v && Number(v.active) !== 1) throw new Error("Variant inactive");

            const unit = v?.priceCents != null ? Number(v.priceCents) : Number(p.priceCents || 0);
            const qty = Math.max(1, Math.min(999, Math.trunc(item.quantity)));
            const line = unit * qty;
            subtotalCents += line;

            // Stock check (variant preferred, else product-level)
            const key = invKey(String(item.productId), item.variantId);
            const inv: any = invByKey.get(key) ?? invByKey.get(invKey(String(item.productId), "")) ?? null;
            if (inv) {
              const stock = Number(inv.stock ?? 0);
              const backorderAllowed = Number(inv.backorderAllowed ?? 0) === 1;
              if (!backorderAllowed && stock < qty) throw new Error("Insufficient stock");
            }

            return {
              id: crypto.randomUUID(),
              orderId,
              productId: String(p.id),
              variantId: item.variantId ? String(item.variantId) : null,
              name: String(v?.name || p.name),
              sku: v?.sku ? String(v.sku) : null,
              quantity: qty,
              unitPriceCents: unit,
              lineTotalCents: line,
              createdAt: now,
            };
          });

          // Coupon + shipping + tax
          let discountCents = 0;
          if (input.couponCode) {
            const code = input.couponCode.trim().toUpperCase();
            const coupons = await tx
              .select()
              .from(appCoupons)
              .where(and(eq(appCoupons.appId, input.appId), eq(appCoupons.code, code), eq(appCoupons.active, 1)))
              .limit(1);
            const c: any = coupons[0];
            if (c) {
              if (c.type === "percent") {
                discountCents = calcPercent(subtotalCents, Number(c.percentBps || 0));
              } else if (c.type === "fixed") {
                discountCents = Math.min(subtotalCents, Number(c.amountCents || 0));
              }
            }
          }

          let shippingCents = 0;
          if (input.shippingMethodId) {
            const rows = await tx
              .select()
              .from(appShippingMethods)
              .where(and(eq(appShippingMethods.appId, input.appId), eq(appShippingMethods.id, input.shippingMethodId), eq(appShippingMethods.active, 1)))
              .limit(1);
            shippingCents = Number((rows[0] as any)?.deliveryFeeCents || 0);
          }

          const taxRateBps = await getTaxRateBps(input.appId);
          const taxCents = calcPercent(Math.max(0, subtotalCents - discountCents), taxRateBps);

          const grandTotalCents = Math.max(0, subtotalCents - discountCents + shippingCents + taxCents);

          await tx.insert(appOrders).values({
            id: orderId,
            appId: input.appId,
            customerId: input.customerId,
            status: "pending",
            currency: "INR",
            subtotalCents,
            discountCents,
            shippingCents,
            taxCents,
            totalCents: grandTotalCents,
            paymentProvider: input.paymentProvider,
            paymentStatus: input.paymentProvider === "cod" ? "completed" : "pending",
            notes: input.notes ?? null,
            createdAt: now,
            updatedAt: now,
          } as any);

          if (input.shippingAddress) {
            await tx.insert(appOrderAddresses).values({
              id: crypto.randomUUID(),
              orderId,
              kind: "shipping",
              name: input.shippingAddress.name,
              phone: input.shippingAddress.phone ?? null,
              line1: input.shippingAddress.line1,
              line2: input.shippingAddress.line2 ?? null,
              city: input.shippingAddress.city,
              state: input.shippingAddress.state ?? null,
              postalCode: input.shippingAddress.postalCode ?? null,
              country: (input.shippingAddress.country || "IN").slice(0, 2).toUpperCase(),
              createdAt: now,
            } as any);
          }

          await tx.insert(appOrderItems).values(lineRows as any);

          // Stock decrement + movements
          for (const row of lineRows as any[]) {
            const key = invKey(String(row.productId), row.variantId ? String(row.variantId) : undefined);
            const inv: any = invByKey.get(key) ?? invByKey.get(invKey(String(row.productId), "")) ?? null;
            if (!inv) continue;

            const stock = Number(inv.stock ?? 0);
            const next = stock - Number(row.quantity || 0);
            await tx
              .update(appInventory)
              .set({ stock: next, updatedAt: now } as any)
              .where(eq(appInventory.id, String(inv.id)));

            await tx.insert(appInventoryMovements).values({
              id: crypto.randomUUID(),
              appId: input.appId,
              productId: String(row.productId),
              variantId: row.variantId ? String(row.variantId) : null,
              delta: -Number(row.quantity || 0),
              reason: "order.create",
              refType: "order",
              refId: orderId,
              createdAt: now,
            } as any);

            const low = Number(inv.lowStockThreshold ?? 0);
            if (low > 0 && next <= low) {
              await events.stockLow(input.appId, {
                productId: String(row.productId),
                variantId: row.variantId ? String(row.variantId) : null,
                stock: next,
                lowStockThreshold: low,
              });
            }
          }

          if (deps.audit) {
            await deps.audit({
              userId: null,
              action: "ecommerce.order.created",
              targetType: "order",
              targetId: orderId,
              metadata: { appId: input.appId, customerId: input.customerId, totalCents: grandTotalCents },
            });
          }

          return {
            id: orderId,
            status: "pending" as const,
            currency: "INR" as const,
            subtotalCents,
            discountCents,
            shippingCents,
            taxCents,
            totalCents: grandTotalCents,
            paymentProvider: input.paymentProvider,
            paymentStatus: input.paymentProvider === "cod" ? "completed" : "pending",
          };
        }

        // No variants: behave like legacy flow (but store pending)
        let subtotalCents = 0;
        const lineRows = input.items.map((i) => {
          const p: any = byProductId.get(String(i.productId));
          if (!p) throw new Error("Invalid product");
          if (Number(p.active) !== 1) throw new Error("Product inactive");
          const unit = Number(p.priceCents || 0);
          const qty = Math.max(1, Math.min(999, Math.trunc(i.quantity)));
          const line = unit * qty;
          subtotalCents += line;
          return {
            id: crypto.randomUUID(),
            orderId,
            productId: String(p.id),
            variantId: null,
            name: String(p.name),
            sku: null,
            quantity: qty,
            unitPriceCents: unit,
            lineTotalCents: line,
            createdAt: now,
          };
        });

        const taxRateBps = await getTaxRateBps(input.appId);
        const taxCents = calcPercent(subtotalCents, taxRateBps);
        const grandTotalCents = Math.max(0, subtotalCents + taxCents);

        await tx.insert(appOrders).values({
          id: orderId,
          appId: input.appId,
          customerId: input.customerId,
          status: "pending",
          currency: "INR",
          subtotalCents,
          discountCents: 0,
          shippingCents: 0,
          taxCents,
          totalCents: grandTotalCents,
          paymentProvider: input.paymentProvider,
          paymentStatus: input.paymentProvider === "cod" ? "completed" : "pending",
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        } as any);

        await tx.insert(appOrderItems).values(lineRows as any);

        if (deps.audit) {
          await deps.audit({
            userId: null,
            action: "ecommerce.order.created",
            targetType: "order",
            targetId: orderId,
            metadata: { appId: input.appId, customerId: input.customerId, totalCents: grandTotalCents },
          });
        }

        return {
          id: orderId,
          status: "pending" as const,
          currency: "INR" as const,
          subtotalCents,
          discountCents: 0,
          shippingCents: 0,
          taxCents,
          totalCents: grandTotalCents,
          paymentProvider: input.paymentProvider,
          paymentStatus: input.paymentProvider === "cod" ? "completed" : "pending",
        };
      });

      await events.orderCreated(input.appId, input.customerId, {
        orderId: String(result.id),
        totalCents: Number((result as any).totalCents || 0),
        paymentProvider: input.paymentProvider,
      });

      return result;
    },

    async transitionOrderStatus(input: {
      appId: string;
      orderId: string;
      actorUserId?: string | null;
      targetStatus: EcommerceOrderStatus;
      carrier?: string;
      trackingNumber?: string;
    }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({ id: appOrders.id, status: appOrders.status, customerId: appOrders.customerId })
        .from(appOrders)
        .where(and(eq(appOrders.appId, input.appId), eq(appOrders.id, input.orderId)))
        .limit(1);
      const row: any = rows[0];
      if (!row) throw new Error("Order not found");

      const from = normalizeEcommerceOrderStatus(row.status);
      assertEcommerceOrderTransition(from, input.targetStatus);

      const result = await db
        .update(appOrders)
        .set({ status: input.targetStatus, updatedAt: now } as any)
        .where(
          and(
            eq(appOrders.appId, input.appId),
            eq(appOrders.id, input.orderId),
            eq(appOrders.status, String(row.status)),
          ),
        );

      const affected =
        (result as any)?.rowsAffected ??
        (result as any)?.affectedRows ??
        (result as any)?.[0]?.affectedRows ??
        0;

      if (input.targetStatus === "shipped" && Number(affected) === 1) {
        await events.orderShipped(input.appId, row.customerId ? String(row.customerId) : null, {
          orderId: input.orderId,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
        });
      }

      if (deps.audit && Number(affected) === 1) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "ecommerce.order.status_changed",
          targetType: "order",
          targetId: input.orderId,
          metadata: { appId: input.appId, from, to: input.targetStatus },
        });
      }

      return { ok: true as const, from, to: input.targetStatus };
    },

    async markOrderPaid(input: {
      appId: string;
      orderId: string;
      customerId: string;
      provider: string;
      ref: string;
      eventProperties?: Record<string, any>;
    }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({ id: appOrders.id, status: appOrders.status, paymentStatus: appOrders.paymentStatus })
        .from(appOrders)
        .where(and(eq(appOrders.appId, input.appId), eq(appOrders.id, input.orderId), eq(appOrders.customerId, input.customerId)))
        .limit(1);
      const order: any = rows[0];
      if (!order) throw new Error("Order not found");

      const from = normalizeEcommerceOrderStatus(order.status);
      // allow legacy order.paid flow to move to paid
      const to: EcommerceOrderStatus = "paid";
      if (from !== "paid") assertEcommerceOrderTransition(from === "created" ? "pending" : from, to);

      const result = await db
        .update(appOrders)
        .set({ paymentStatus: "completed", paymentRef: input.ref, status: "paid", updatedAt: now } as any)
        .where(
          and(
            eq(appOrders.appId, input.appId),
            eq(appOrders.id, input.orderId),
            // Only treat this as a paid transition once.
            or(ne(appOrders.status, "paid"), ne(appOrders.paymentStatus, "completed")),
          ),
        );

      const affected =
        (result as any)?.rowsAffected ??
        (result as any)?.affectedRows ??
        (result as any)?.[0]?.affectedRows ??
        0;

      if (from !== "paid" && Number(affected) > 0) {
        await events.orderPaid(input.appId, input.customerId, {
          ...(input.eventProperties ?? {}),
          provider: input.provider,
          ref: input.ref,
          orderId: input.orderId,
        });
      }

      if (deps.audit) {
        await deps.audit({
          userId: null,
          action: "ecommerce.order.paid",
          targetType: "order",
          targetId: input.orderId,
          metadata: { appId: input.appId, provider: input.provider },
        });
      }

      return { ok: true as const };
    },

    async createRefund(input: { appId: string; orderId: string; actorUserId?: string | null; amountCents?: number; reason?: string }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({
          id: appOrders.id,
          status: appOrders.status,
          totalCents: appOrders.totalCents,
          customerId: appOrders.customerId,
        })
        .from(appOrders)
        .where(and(eq(appOrders.appId, input.appId), eq(appOrders.id, input.orderId)))
        .limit(1);

      const order: any = rows[0];
      if (!order) throw new Error("Order not found");

      const from = normalizeEcommerceOrderStatus(order.status);
      assertEcommerceOrderTransition(from, "refunded");

      const amount = input.amountCents != null ? Math.min(Number(order.totalCents || 0), Number(input.amountCents || 0)) : Number(order.totalCents || 0);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid refund amount");

      const refundId = crypto.randomUUID();

      await db.transaction(async (tx) => {
        await tx.insert(appOrderRefunds).values({
          id: refundId,
          appId: input.appId,
          orderId: input.orderId,
          amountCents: amount,
          reason: input.reason ?? null,
          status: "processed",
          createdAt: now,
          processedAt: now,
        } as any);

        await tx
          .update(appOrders)
          .set({ status: "refunded", updatedAt: now } as any)
          .where(and(eq(appOrders.appId, input.appId), eq(appOrders.id, input.orderId)));

        // If this is a full refund, restock inventory for items (best-effort)
        if (amount === Number(order.totalCents || 0)) {
          const items = await tx
            .select({ productId: appOrderItems.productId, variantId: (appOrderItems as any).variantId, quantity: appOrderItems.quantity })
            .from(appOrderItems)
            .where(eq(appOrderItems.orderId, input.orderId));

          for (const it of items as any[]) {
            const invRows = await tx
              .select()
              .from(appInventory)
              .where(
                and(
                  eq(appInventory.appId, input.appId),
                  eq(appInventory.productId, String(it.productId)),
                  it.variantId ? eq(appInventory.variantId, String(it.variantId)) : isNull(appInventory.variantId),
                ),
              )
              .limit(1);
            const inv: any = invRows[0];
            if (!inv) continue;

            const next = Number(inv.stock || 0) + Number(it.quantity || 0);
            await tx.update(appInventory).set({ stock: next, updatedAt: now } as any).where(eq(appInventory.id, String(inv.id)));
            await tx.insert(appInventoryMovements).values({
              id: crypto.randomUUID(),
              appId: input.appId,
              productId: String(it.productId),
              variantId: it.variantId ? String(it.variantId) : null,
              delta: Number(it.quantity || 0),
              reason: "order.refund",
              refType: "refund",
              refId: refundId,
              createdAt: now,
            } as any);
          }
        }
      });

      await events.orderRefunded(input.appId, order.customerId ? String(order.customerId) : null, {
        orderId: input.orderId,
        refundId,
        amountCents: amount,
      });

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "ecommerce.order.refunded",
          targetType: "order",
          targetId: input.orderId,
          metadata: { appId: input.appId, refundId, amountCents: amount },
        });
      }

      return { id: refundId, amountCents: amount };
    },
  };
}
