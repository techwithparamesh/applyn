import { z } from "zod";

export const createAppointmentSchema = z
  .object({
    doctorId: z.string().min(1),
    startAt: z.string().min(1),
    appointmentTypeId: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
    patient: z
      .object({
        name: z.string().min(1).max(200),
        email: z.string().email().max(320).optional(),
        phone: z.string().max(40).optional(),
        dob: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const transitionAppointmentSchema = z
  .object({
    status: z.enum(["requested", "confirmed", "cancelled", "completed", "no_show"]),
  })
  .strict();

export const createAppointmentTypeSchema = z
  .object({
    name: z.string().min(1).max(200),
    durationMinutes: z.number().int().min(5).max(600).default(15),
    bufferBeforeMinutes: z.number().int().min(0).max(120).optional().default(0),
    bufferAfterMinutes: z.number().int().min(0).max(120).optional().default(0),
    cancellationPolicyHours: z.number().int().min(0).max(365 * 24).optional().default(0),
    currency: z.string().min(1).max(8).optional().default("INR"),
    priceCents: z.number().int().min(0).max(2_000_000_000).optional().default(0),
    active: z.boolean().optional().default(true),
  })
  .strict();

export const createAvailabilitySchema = z
  .object({
    doctorId: z.string().uuid(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    active: z.boolean().optional().default(true),
  })
  .strict();

export const createInvoicePaymentSchema = z
  .object({
    provider: z.string().max(24).optional().default("manual"),
    providerRef: z.string().max(128).optional(),
    amountCents: z.number().int().min(0).max(2_000_000_000).optional(),
  })
  .strict();
