import crypto from "crypto";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { getMysqlDb } from "../../db-mysql";
import {
  appDoctorAppointments,
  appDoctors,
  appHealthcareAppointmentTypes,
  appHealthcareProviderAvailability,
  appInvoicePayments,
  appInvoices,
  appPatients,
  appPatientVisits,
} from "@shared/db.mysql";
import type { EmitAppEvent } from "./events";
import { healthcareEvents } from "./events";
import { assertAppointmentTransition, normalizeAppointmentStatus, type HealthcareAppointmentStatus } from "./state";

type Audit = (log: { userId: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata?: any }) => Promise<void>;

function parseDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid datetime");
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function healthcareService(deps: { emit: EmitAppEvent; audit?: Audit }) {
  const events = healthcareEvents(deps.emit);

  return {
    async listDoctors(input: { appId: string }) {
      const db = getMysqlDb();
      const rows = await db
        .select()
        .from(appDoctors)
        .where(and(eq(appDoctors.appId, input.appId), eq(appDoctors.active, 1)))
        .orderBy(desc(appDoctors.updatedAt));

      return (rows as any[]).map((d) => ({
        id: String(d.id),
        name: String(d.name),
        specialty: d.specialty ?? "",
        bio: d.bio ?? "",
        imageUrl: d.imageUrl ?? null,
      }));
    },

    async listAppointmentsForCustomer(input: { appId: string; customerId: string }) {
      const db = getMysqlDb();
      const rows = await db
        .select({
          id: appDoctorAppointments.id,
          status: appDoctorAppointments.status,
          startAt: appDoctorAppointments.startAt,
          endAt: appDoctorAppointments.endAt,
          doctorId: appDoctorAppointments.doctorId,
          doctorName: appDoctors.name,
          specialty: appDoctors.specialty,
        })
        .from(appDoctorAppointments)
        .leftJoin(appDoctors, and(eq(appDoctors.appId, input.appId), eq(appDoctors.id, appDoctorAppointments.doctorId)))
        .where(and(eq(appDoctorAppointments.appId, input.appId), eq(appDoctorAppointments.customerId, input.customerId)))
        .orderBy(desc(appDoctorAppointments.startAt));

      return (rows as any[]).map((a) => ({
        id: String(a.id),
        status: String(a.status),
        doctorId: String(a.doctorId),
        doctorName: a.doctorName ?? null,
        specialty: a.specialty ?? null,
        startAt: a.startAt instanceof Date ? a.startAt.toISOString() : String(a.startAt),
        endAt: a.endAt instanceof Date ? a.endAt.toISOString() : String(a.endAt),
      }));
    },

    async requestAppointment(input: {
      appId: string;
      customerId: string;
      doctorId: string;
      startAtIso: string;
      appointmentTypeId?: string;
      notes?: string;
      patient?: { name: string; email?: string; phone?: string; dobIso?: string };
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const startAt = parseDate(input.startAtIso);
      if (startAt.getTime() < Date.now() - 5 * 60 * 1000) throw new Error("Start time must be in the future");

      const docRows = await db
        .select({ id: appDoctors.id, active: appDoctors.active })
        .from(appDoctors)
        .where(and(eq(appDoctors.appId, input.appId), eq(appDoctors.id, input.doctorId)))
        .limit(1);
      const doc: any = docRows[0];
      if (!doc || !(doc.active === 1 || doc.active === true)) throw new Error("Invalid doctor");

      // Appointment type and buffers
      let durationMinutes = 30;
      let bufferBeforeMinutes = 0;
      let bufferAfterMinutes = 0;
      let priceCents = 0;

      if (input.appointmentTypeId) {
        const typeRows = await db
          .select()
          .from(appHealthcareAppointmentTypes)
          .where(and(eq(appHealthcareAppointmentTypes.appId, input.appId), eq(appHealthcareAppointmentTypes.id, input.appointmentTypeId)))
          .limit(1);
        const t: any = typeRows[0];
        if (!t || !(t.active === 1 || t.active === true)) throw new Error("Invalid appointment type");
        durationMinutes = Number(t.durationMinutes || 15);
        bufferBeforeMinutes = Number(t.bufferBeforeMinutes || 0);
        bufferAfterMinutes = Number(t.bufferAfterMinutes || 0);
        priceCents = Number(t.priceCents || 0);
      }

      const apptStart = new Date(startAt.getTime() - bufferBeforeMinutes * 60 * 1000);
      const apptEnd = new Date(startAt.getTime() + (durationMinutes + bufferAfterMinutes) * 60 * 1000);

      // Availability validation: if availability rows exist, enforce; else allow (back-compat)
      const availabilityRows = await db
        .select({ id: appHealthcareProviderAvailability.id, startAt: appHealthcareProviderAvailability.startAt, endAt: appHealthcareProviderAvailability.endAt })
        .from(appHealthcareProviderAvailability)
        .where(and(eq(appHealthcareProviderAvailability.appId, input.appId), eq(appHealthcareProviderAvailability.doctorId, input.doctorId), eq(appHealthcareProviderAvailability.active, 1), lte(appHealthcareProviderAvailability.startAt, apptStart), gte(appHealthcareProviderAvailability.endAt, apptEnd)));

      const anyAvailabilityConfigured = await db
        .select({ id: appHealthcareProviderAvailability.id })
        .from(appHealthcareProviderAvailability)
        .where(and(eq(appHealthcareProviderAvailability.appId, input.appId), eq(appHealthcareProviderAvailability.doctorId, input.doctorId)))
        .limit(1);

      if (anyAvailabilityConfigured.length > 0 && availabilityRows.length === 0) {
        throw new Error("Provider is not available for that time slot");
      }

      const result = await db.transaction(async (tx) => {
        // Row-level lock: serialize appointment booking per doctor.
        const lockResult = await tx
          .update(appDoctors)
          .set({ updatedAt: sql`${appDoctors.updatedAt}` } as any)
          .where(and(eq(appDoctors.appId, input.appId), eq(appDoctors.id, input.doctorId)));
        const locked =
          (lockResult as any)?.rowsAffected ??
          (lockResult as any)?.affectedRows ??
          (lockResult as any)?.[0]?.affectedRows ??
          0;
        if (Number(locked) === 0) throw new Error("Doctor not found");

        // Conflict check (inside the lock/transaction to prevent races)
        const existing = await tx
          .select({ id: appDoctorAppointments.id, startAt: appDoctorAppointments.startAt, endAt: appDoctorAppointments.endAt, status: appDoctorAppointments.status })
          .from(appDoctorAppointments)
          .where(
            and(
              eq(appDoctorAppointments.appId, input.appId),
              eq(appDoctorAppointments.doctorId, input.doctorId),
              or(eq(appDoctorAppointments.status, "requested"), eq(appDoctorAppointments.status, "confirmed")),
              gte(appDoctorAppointments.startAt, new Date(apptStart.getTime() - 24 * 60 * 60 * 1000)),
              lte(appDoctorAppointments.startAt, new Date(apptEnd.getTime() + 24 * 60 * 60 * 1000)),
            ),
          );

        const conflict = (existing as any[]).some((a) => overlaps(apptStart, apptEnd, a.startAt as Date, a.endAt as Date));
        if (conflict) throw new Error("Time slot is not available");

        let patientId: string | null = null;
        if (input.patient?.name) {
          patientId = crypto.randomUUID();
          const dob = input.patient.dobIso ? parseDate(input.patient.dobIso) : null;
          await tx.insert(appPatients).values({
            id: patientId,
            appId: input.appId,
            customerId: input.customerId,
            name: input.patient.name,
            email: input.patient.email ?? null,
            phone: input.patient.phone ?? null,
            dob,
            createdAt: now,
            updatedAt: now,
          } as any);
        }

        const appointmentId = crypto.randomUUID();
        await tx.insert(appDoctorAppointments).values({
          id: appointmentId,
          appId: input.appId,
          customerId: input.customerId,
          doctorId: input.doctorId,
          appointmentTypeId: input.appointmentTypeId ?? null,
          status: "requested",
          startAt,
          endAt: new Date(startAt.getTime() + durationMinutes * 60 * 1000),
          notes: input.notes ?? null,
          cancelledAt: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        } as any);

        // Create invoice if price is set and patient exists
        let invoiceId: string | null = null;
        if (priceCents > 0 && patientId) {
          invoiceId = crypto.randomUUID();
          await tx.insert(appInvoices).values({
            id: invoiceId,
            appId: input.appId,
            patientId,
            appointmentId,
            currency: "INR",
            totalCents: priceCents,
            status: "issued",
            dueAt: null,
            createdAt: now,
            updatedAt: now,
          } as any);
        }

        if (deps.audit) {
          await deps.audit({
            userId: null,
            action: "healthcare.appointment.requested",
            targetType: "appointment",
            targetId: appointmentId,
            metadata: { appId: input.appId, doctorId: input.doctorId, patientId, invoiceId },
          });
        }

        return { id: appointmentId, status: "requested" as const, invoiceId };
      });

      await events.appointmentRequested(input.appId, input.customerId, {
        appointmentId: result.id,
        doctorId: input.doctorId,
        startAt: startAt.toISOString(),
      });

      return result;
    },

    async transitionAppointment(input: {
      appId: string;
      appointmentId: string;
      actorUserId?: string | null;
      status: HealthcareAppointmentStatus;
    }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({
          id: appDoctorAppointments.id,
          status: appDoctorAppointments.status,
          doctorId: appDoctorAppointments.doctorId,
          customerId: appDoctorAppointments.customerId,
          startAt: appDoctorAppointments.startAt,
        })
        .from(appDoctorAppointments)
        .where(and(eq(appDoctorAppointments.appId, input.appId), eq(appDoctorAppointments.id, input.appointmentId)))
        .limit(1);
      const row: any = rows[0];
      if (!row) throw new Error("Appointment not found");

      const from = normalizeAppointmentStatus(row.status);
      assertAppointmentTransition(from, input.status);

      const patch: any = { status: input.status, updatedAt: now };
      if (input.status === "cancelled") patch.cancelledAt = now;
      if (input.status === "completed") patch.completedAt = now;

      const result = await db
        .update(appDoctorAppointments)
        .set(patch)
        .where(
          and(
            eq(appDoctorAppointments.appId, input.appId),
            eq(appDoctorAppointments.id, input.appointmentId),
            eq(appDoctorAppointments.status, String(row.status)),
          ),
        );

      const affected =
        (result as any)?.rowsAffected ??
        (result as any)?.affectedRows ??
        (result as any)?.[0]?.affectedRows ??
        0;

      if (input.status === "confirmed" && Number(affected) === 1) {
        await events.appointmentConfirmed(input.appId, row.customerId ? String(row.customerId) : null, {
          appointmentId: input.appointmentId,
          doctorId: String(row.doctorId),
          startAt: (row.startAt as Date).toISOString(),
        });
      }

      if (input.status === "completed" && Number(affected) === 1) {
        await events.appointmentCompleted(input.appId, row.customerId ? String(row.customerId) : null, {
          appointmentId: input.appointmentId,
        });
      }

      if (deps.audit && Number(affected) === 1) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "healthcare.appointment.status_changed",
          targetType: "appointment",
          targetId: input.appointmentId,
          metadata: { appId: input.appId, from, to: input.status },
        });
      }

      return { ok: true as const, from, to: input.status };
    },

    async createAppointmentType(input: {
      appId: string;
      name: string;
      durationMinutes: number;
      bufferBeforeMinutes: number;
      bufferAfterMinutes: number;
      cancellationPolicyHours: number;
      currency: string;
      priceCents: number;
      active: boolean;
      actorUserId?: string | null;
    }) {
      const db = getMysqlDb();
      const now = new Date();
      const id = crypto.randomUUID();
      await db.insert(appHealthcareAppointmentTypes).values({
        id,
        appId: input.appId,
        name: input.name,
        durationMinutes: input.durationMinutes,
        bufferBeforeMinutes: input.bufferBeforeMinutes,
        bufferAfterMinutes: input.bufferAfterMinutes,
        cancellationPolicyHours: input.cancellationPolicyHours,
        currency: (input.currency || "INR").slice(0, 8).toUpperCase(),
        priceCents: input.priceCents,
        active: input.active ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      } as any);

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "healthcare.appointment_type.created",
          targetType: "appointment_type",
          targetId: id,
          metadata: { appId: input.appId },
        });
      }

      return { id };
    },

    async addAvailability(input: { appId: string; doctorId: string; startAtIso: string; endAtIso: string; active: boolean; actorUserId?: string | null }) {
      const db = getMysqlDb();
      const now = new Date();
      const startAt = parseDate(input.startAtIso);
      const endAt = parseDate(input.endAtIso);
      if (endAt.getTime() <= startAt.getTime()) throw new Error("Invalid endAt");

      const id = crypto.randomUUID();
      await db.insert(appHealthcareProviderAvailability).values({
        id,
        appId: input.appId,
        doctorId: input.doctorId,
        startAt,
        endAt,
        active: input.active ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      } as any);

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "healthcare.provider_availability.created",
          targetType: "availability",
          targetId: id,
          metadata: { appId: input.appId, doctorId: input.doctorId },
        });
      }

      return { id };
    },

    async markInvoicePaid(input: { appId: string; invoiceId: string; provider: string; providerRef?: string; amountCents?: number; actorUserId?: string | null }) {
      const db = getMysqlDb();
      const now = new Date();

      const rows = await db
        .select({ id: appInvoices.id, totalCents: appInvoices.totalCents, status: appInvoices.status })
        .from(appInvoices)
        .where(and(eq(appInvoices.appId, input.appId), eq(appInvoices.id, input.invoiceId)))
        .limit(1);
      const inv: any = rows[0];
      if (!inv) throw new Error("Invoice not found");
      if (String(inv.status) === "paid") return { ok: true as const };

      const amount = input.amountCents != null ? Number(input.amountCents) : Number(inv.totalCents || 0);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid payment amount");

      const paymentId = crypto.randomUUID();
      await db.transaction(async (tx) => {
        await tx.insert(appInvoicePayments).values({
          id: paymentId,
          appId: input.appId,
          invoiceId: input.invoiceId,
          provider: input.provider,
          providerRef: input.providerRef ?? null,
          amountCents: amount,
          status: "paid",
          paidAt: now,
          createdAt: now,
        } as any);

        await tx
          .update(appInvoices)
          .set({ status: "paid", updatedAt: now } as any)
          .where(and(eq(appInvoices.appId, input.appId), eq(appInvoices.id, input.invoiceId)));
      });

      await events.invoicePaid(input.appId, { invoiceId: input.invoiceId, amountCents: amount });

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "healthcare.invoice.paid",
          targetType: "invoice",
          targetId: input.invoiceId,
          metadata: { appId: input.appId, amountCents: amount, provider: input.provider },
        });
      }

      return { ok: true as const };
    },

    async addVisitNote(input: { appId: string; patientId: string; appointmentId?: string; notes?: string; actorUserId?: string | null }) {
      const db = getMysqlDb();
      const now = new Date();
      const id = crypto.randomUUID();
      await db.insert(appPatientVisits).values({
        id,
        appId: input.appId,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        notes: input.notes ?? null,
        createdAt: now,
      } as any);

      if (deps.audit) {
        await deps.audit({
          userId: input.actorUserId ?? null,
          action: "healthcare.patient_visit.created",
          targetType: "patient_visit",
          targetId: id,
          metadata: { appId: input.appId, patientId: input.patientId },
        });
      }

      return { id };
    },
  };
}
