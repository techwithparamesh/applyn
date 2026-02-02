import crypto from "crypto";
import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import { getMysqlDb } from "../../db-mysql";
import {
  appRealEstateAgentAvailability,
  appRealEstateInquiries,
  appRealEstateInquiryFollowups,
  appRealEstateListings,
  appRealEstateTours,
} from "@shared/db.mysql";
import { assertInquiryTransition, assertTourTransition, normalizeInquiryStatus, normalizeTourStatus, type InquiryStatus, type TourStatus } from "./state";
import type { EmitAppEvent } from "./events";
import { realEstateEvents } from "./events";

type Audit = (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => Promise<void>;

function parseDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid datetime");
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function realEstateService(deps: { emit: EmitAppEvent; audit?: Audit }) {
  const events = realEstateEvents(deps.emit);

  return {
    async listActiveListings(input: { appId: string }) {
      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appRealEstateListings)
        .where(and(eq(appRealEstateListings.appId, input.appId), eq(appRealEstateListings.active, 1)))
        .orderBy(desc(appRealEstateListings.updatedAt));

      return (rows as any[]).map((l) => ({
        id: String(l.id),
        title: String(l.title),
        description: l.description ?? "",
        address: l.address ?? "",
        currency: l.currency ?? "INR",
        priceCents: Number(l.priceCents || 0),
        imageUrl: l.imageUrl ?? null,
      }));
    },

    async createInquiry(input: {
      appId: string;
      listingId: string;
      customerId: string | null;
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
    }) {
      const db = getMysqlDb();
      const now = new Date();

      const listing = await db
        .select({ id: appRealEstateListings.id })
        .from(appRealEstateListings)
        .where(and(eq(appRealEstateListings.appId, input.appId), eq(appRealEstateListings.id, input.listingId)))
        .limit(1);
      if (!listing[0]) throw new Error("Invalid listing");

      const id = crypto.randomUUID();
      const slaDueAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      await db.insert(appRealEstateInquiries).values({
        id,
        appId: input.appId,
        listingId: input.listingId,
        customerId: input.customerId,
        name: input.name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        message: input.message ?? null,
        status: "new",
        assignedAgentId: null,
        slaDueAt,
        lastFollowUpAt: null,
        nextFollowUpAt: null,
        createdAt: now,
        updatedAt: now,
      } as any);

      await events.inquiryCreated(input.appId, input.customerId, { inquiryId: id, listingId: input.listingId });

      if (deps.audit) {
        await deps.audit({
          userId: null,
          action: "realestate.inquiry.created",
          targetType: "inquiry",
          targetId: id,
          metadata: { appId: input.appId, listingId: input.listingId },
        });
      }

      return { id };
    },

    async assignInquiry(input: { appId: string; inquiryId: string; agentId: string; actorUserId?: string | null }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({ id: appRealEstateInquiries.id, status: appRealEstateInquiries.status, listingId: appRealEstateInquiries.listingId })
        .from(appRealEstateInquiries)
        .where(and(eq(appRealEstateInquiries.appId, input.appId), eq(appRealEstateInquiries.id, input.inquiryId)))
        .limit(1);
      const row: any = rows[0];
      if (!row) throw new Error("Inquiry not found");

      const from = normalizeInquiryStatus(row.status);
      assertInquiryTransition(from, "assigned");

      await db
        .update(appRealEstateInquiries)
        .set({ status: "assigned", assignedAgentId: input.agentId, updatedAt: now } as any)
        .where(and(eq(appRealEstateInquiries.appId, input.appId), eq(appRealEstateInquiries.id, input.inquiryId)));

      // Follow-up due in 24h by default
      const followupId = crypto.randomUUID();
      const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await db.insert(appRealEstateInquiryFollowups).values({
        id: followupId,
        appId: input.appId,
        inquiryId: input.inquiryId,
        note: "Initial follow-up",
        dueAt,
        doneAt: null,
        createdAt: now,
      } as any);

      await db
        .update(appRealEstateInquiries)
        .set({ nextFollowUpAt: dueAt, updatedAt: now } as any)
        .where(and(eq(appRealEstateInquiries.appId, input.appId), eq(appRealEstateInquiries.id, input.inquiryId)));

      await events.inquiryAssigned(input.appId, { inquiryId: input.inquiryId, listingId: String(row.listingId), agentId: input.agentId });

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "realestate.inquiry.assigned",
          targetType: "inquiry",
          targetId: input.inquiryId,
          metadata: { appId: input.appId, agentId: input.agentId },
        });
      }

      return { ok: true as const, from, to: "assigned" as const };
    },

    async updateInquiryStatus(input: { appId: string; inquiryId: string; status: InquiryStatus; actorUserId?: string | null }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({ id: appRealEstateInquiries.id, status: appRealEstateInquiries.status, listingId: appRealEstateInquiries.listingId })
        .from(appRealEstateInquiries)
        .where(and(eq(appRealEstateInquiries.appId, input.appId), eq(appRealEstateInquiries.id, input.inquiryId)))
        .limit(1);
      const row: any = rows[0];
      if (!row) throw new Error("Inquiry not found");

      const from = normalizeInquiryStatus(row.status);
      assertInquiryTransition(from, input.status);

      await db
        .update(appRealEstateInquiries)
        .set({ status: input.status, updatedAt: now } as any)
        .where(and(eq(appRealEstateInquiries.appId, input.appId), eq(appRealEstateInquiries.id, input.inquiryId)));

      if (input.status === "converted") {
        await events.leadConverted(input.appId, { inquiryId: input.inquiryId, listingId: String(row.listingId) });
      }

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "realestate.inquiry.status_changed",
          targetType: "inquiry",
          targetId: input.inquiryId,
          metadata: { appId: input.appId, from, to: input.status },
        });
      }

      return { ok: true as const, from, to: input.status };
    },

    async scheduleTour(input: {
      appId: string;
      listingId: string;
      agentId: string;
      startAtIso: string;
      endAtIso: string;
      inquiryId?: string;
      actorUserId?: string | null;
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const startAt = parseDate(input.startAtIso);
      const endAt = parseDate(input.endAtIso);
      if (endAt.getTime() <= startAt.getTime()) throw new Error("Invalid endAt");
      if (startAt.getTime() <= now.getTime()) throw new Error("Tour must be in the future");

      const availability = await db
        .select()
        .from(appRealEstateAgentAvailability)
        .where(and(eq(appRealEstateAgentAvailability.appId, input.appId), eq(appRealEstateAgentAvailability.agentId, input.agentId), eq(appRealEstateAgentAvailability.active, 1), lte(appRealEstateAgentAvailability.startAt, startAt), gte(appRealEstateAgentAvailability.endAt, endAt)));

      if (availability.length === 0) throw new Error("Agent is not available for that slot");

      const existingTours = await db
        .select({ id: appRealEstateTours.id, startAt: appRealEstateTours.startAt, endAt: appRealEstateTours.endAt })
        .from(appRealEstateTours)
        .where(and(eq(appRealEstateTours.appId, input.appId), eq(appRealEstateTours.agentId, input.agentId), gte(appRealEstateTours.startAt, new Date(startAt.getTime() - 24 * 60 * 60 * 1000)), lte(appRealEstateTours.startAt, new Date(endAt.getTime() + 24 * 60 * 60 * 1000))));

      const conflict = (existingTours as any[]).some((t) => overlaps(startAt, endAt, t.startAt as Date, t.endAt as Date));
      if (conflict) throw new Error("Agent already has a tour in that time window");

      const tourId = crypto.randomUUID();

      await db.insert(appRealEstateTours).values({
        id: tourId,
        appId: input.appId,
        listingId: input.listingId,
        inquiryId: input.inquiryId ?? null,
        agentId: input.agentId,
        status: "scheduled",
        startAt,
        endAt,
        createdAt: now,
        updatedAt: now,
      } as any);

      if (input.inquiryId) {
        // Move inquiry to tour_scheduled if possible
        const rows = await db
          .select({ status: appRealEstateInquiries.status })
          .from(appRealEstateInquiries)
          .where(and(eq(appRealEstateInquiries.appId, input.appId), eq(appRealEstateInquiries.id, input.inquiryId)))
          .limit(1);
        const statusRaw: any = rows[0]?.status;
        const from = normalizeInquiryStatus(statusRaw);
        if (from !== "tour_scheduled") {
          assertInquiryTransition(from, "tour_scheduled");
          await db
            .update(appRealEstateInquiries)
            .set({ status: "tour_scheduled", updatedAt: now } as any)
            .where(and(eq(appRealEstateInquiries.appId, input.appId), eq(appRealEstateInquiries.id, input.inquiryId)));
        }
      }

      await events.tourScheduled(input.appId, { tourId, listingId: input.listingId, agentId: input.agentId, startAt: startAt.toISOString() });

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "realestate.tour.scheduled",
          targetType: "tour",
          targetId: tourId,
          metadata: { appId: input.appId, listingId: input.listingId, agentId: input.agentId },
        });
      }

      return { id: tourId, status: "scheduled" as TourStatus };
    },

    async createListing(input: {
      appId: string;
      title: string;
      description?: string;
      address?: string;
      propertyType?: string;
      latitude?: number;
      longitude?: number;
      amenities?: any;
      currency: string;
      priceCents: number;
      availabilityStatus?: string;
      bedrooms?: number;
      bathrooms?: number;
      areaSqft?: number;
      imageUrl?: string;
      active: boolean;
      actorUserId?: string | null;
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const id = crypto.randomUUID();

      await db.insert(appRealEstateListings).values({
        id,
        appId: input.appId,
        title: input.title,
        description: input.description ?? null,
        address: input.address ?? null,
        propertyType: input.propertyType ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        amenities: input.amenities ? JSON.stringify(input.amenities) : null,
        currency: (input.currency || "INR").slice(0, 8).toUpperCase(),
        priceCents: input.priceCents,
        availabilityStatus: input.availabilityStatus ?? "available",
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        areaSqft: input.areaSqft ?? null,
        imageUrl: input.imageUrl ?? null,
        active: input.active ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      } as any);

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "realestate.listing.created",
          targetType: "listing",
          targetId: id,
          metadata: { appId: input.appId },
        });
      }

      return { id };
    },
  };
}
