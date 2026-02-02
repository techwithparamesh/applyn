import { z } from "zod";

export const createInquirySchema = z
  .object({
    name: z.string().max(200).optional(),
    email: z.string().email().max(320).optional(),
    phone: z.string().max(40).optional(),
    message: z.string().max(5000).optional(),
  })
  .strict();

export const assignInquirySchema = z
  .object({
    agentId: z.string().uuid(),
  })
  .strict();

export const scheduleTourSchema = z
  .object({
    agentId: z.string().uuid(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    inquiryId: z.string().uuid().optional(),
  })
  .strict();

export const inquiryStatusSchema = z.enum(["new", "assigned", "contacted", "tour_scheduled", "converted", "lost"]);

export const updateInquiryStatusSchema = z
  .object({
    status: inquiryStatusSchema,
  })
  .strict();

export const createListingSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().max(20000).optional(),
    address: z.string().max(5000).optional(),
    propertyType: z.string().max(32).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    amenities: z.any().optional(),
    currency: z.string().min(1).max(8).optional().default("INR"),
    priceCents: z.number().int().min(0).max(2_000_000_000).optional().default(0),
    availabilityStatus: z.string().max(24).optional().default("available"),
    bedrooms: z.number().int().min(0).max(100).optional(),
    bathrooms: z.number().int().min(0).max(100).optional(),
    areaSqft: z.number().int().min(0).max(100_000_000).optional(),
    imageUrl: z.string().max(5000).optional(),
    active: z.boolean().optional().default(true),
  })
  .strict();
