import { z } from "zod";

export const createReservationSchema = z
  .object({
    partySize: z.number().int().min(1).max(50).default(2),
    reservedAt: z.string().min(1),
    durationMinutes: z.number().int().min(15).max(360).optional(),
    tableId: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const updateReservationStatusSchema = z
  .object({
    status: z.enum(["requested", "confirmed", "seated", "completed", "cancelled", "no_show"]),
    tableId: z.string().min(1).optional(),
  })
  .strict();

export const createMenuCategorySchema = z
  .object({
    name: z.string().min(1).max(120),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const createMenuItemSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    imageUrl: z.string().max(5000).optional(),
    currency: z.string().min(1).max(8).optional(),
    priceCents: z.number().int().min(0).max(2_000_000_000),
    prepTimeMinutes: z.number().int().min(0).max(600).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const createRestaurantTableSchema = z
  .object({
    name: z.string().min(1).max(80),
    capacity: z.number().int().min(1).max(50).default(2),
    active: z.boolean().optional(),
  })
  .strict();

export const createRestaurantOrderSchema = z
  .object({
    fulfillmentType: z.enum(["dine_in", "pickup", "delivery"]).optional().default("dine_in"),
    scheduledAt: z.string().optional(),
    notes: z.string().max(2000).optional(),
    items: z
      .array(
        z
          .object({
            itemId: z.string().min(1),
            quantity: z.number().int().min(1).max(99).default(1),
            modifiers: z.any().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const updateKitchenStatusSchema = z
  .object({
    kitchenStatus: z.enum(["queued", "preparing", "ready", "served", "cancelled"]),
  })
  .strict();
