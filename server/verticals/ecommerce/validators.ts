import { z } from "zod";

export const moneyCentsSchema = z.number().int().min(0).max(2_000_000_000);

export const createOrderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1),
            variantId: z.string().min(1).optional(),
            quantity: z.number().int().min(1).max(999),
          })
          .strict(),
      )
      .min(1),
    notes: z.string().max(2000).optional(),
    paymentProvider: z.enum(["cod", "razorpay", "stripe"]).optional().default("cod"),
    couponCode: z.string().max(64).optional(),
    shippingMethodId: z.string().min(1).optional(),
    shippingAddress: z
      .object({
        name: z.string().min(1).max(200),
        phone: z.string().min(5).max(40).optional(),
        line1: z.string().min(1).max(255),
        line2: z.string().max(255).optional(),
        city: z.string().min(1).max(120),
        state: z.string().max(120).optional(),
        postalCode: z.string().max(32).optional(),
        country: z.string().max(2).optional().default("IN"),
      })
      .strict()
      .optional(),
  })
  .strict();

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(["pending", "paid", "packed", "shipped", "delivered", "canceled", "refunded"]),
    trackingNumber: z.string().max(128).optional(),
    carrier: z.string().max(64).optional(),
  })
  .strict();

export const createRefundSchema = z
  .object({
    amountCents: moneyCentsSchema.optional(),
    reason: z.string().min(1).max(5000).optional(),
  })
  .strict();
