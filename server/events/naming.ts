export type EventNameMapping = {
  legacy: string;
  prefixed: string;
};

const MAPPINGS: EventNameMapping[] = [
  // Ecommerce (vertical)
  { legacy: "order.created", prefixed: "ecommerce.order.created" },
  { legacy: "order.paid", prefixed: "ecommerce.order.paid" },
  { legacy: "order.shipped", prefixed: "ecommerce.order.shipped" },
  { legacy: "order.refunded", prefixed: "ecommerce.order.refunded" },
  { legacy: "order.payment_failed", prefixed: "ecommerce.order.payment_failed" },
  { legacy: "stock.low", prefixed: "ecommerce.stock.low" },
  { legacy: "payment.razorpay.created", prefixed: "ecommerce.payment.razorpay.created" },

  // Restaurant (vertical)
  { legacy: "reservation.created", prefixed: "restaurant.reservation.created" },
  { legacy: "reservation.confirmed", prefixed: "restaurant.reservation.confirmed" },
  { legacy: "order.kitchen_ready", prefixed: "restaurant.order.kitchen_ready" },

  // Real estate (vertical)
  { legacy: "listing.inquiry.created", prefixed: "realestate.inquiry.created" },
  { legacy: "listing.inquiry.assigned", prefixed: "realestate.inquiry.assigned" },
  { legacy: "tour.scheduled", prefixed: "realestate.tour.scheduled" },
  { legacy: "lead.converted", prefixed: "realestate.lead.converted" },

  // Healthcare (vertical)
  // Note: legacy name kept for backward compatibility; prefixed expresses intent.
  { legacy: "doctor_appointment.created", prefixed: "healthcare.appointment.requested" },
  { legacy: "appointment.confirmed", prefixed: "healthcare.appointment.confirmed" },
  { legacy: "appointment.completed", prefixed: "healthcare.appointment.completed" },
  { legacy: "invoice.paid", prefixed: "healthcare.invoice.paid" },

  // Non-vertical modules (still useful to namespace)
  { legacy: "class.booked", prefixed: "fitness.class.booked" },
  { legacy: "course.enrolled", prefixed: "courses.course.enrolled" },
  { legacy: "lead.created", prefixed: "crm.lead.created" },
  { legacy: "appointment.created", prefixed: "services.appointment.created" },
];

const legacyToPrefixed = new Map(MAPPINGS.map((m) => [m.legacy, m.prefixed] as const));
const prefixedToLegacy = new Map(MAPPINGS.map((m) => [m.prefixed, m.legacy] as const));

export type NamingMode = "legacy" | "prefixed" | "dual";

export function getEventNamingMode(env: NodeJS.ProcessEnv = process.env): NamingMode {
  const raw = String(env.APP_EVENT_NAMING_MODE || "legacy").toLowerCase();
  if (raw === "prefixed") return "prefixed";
  if (raw === "dual") return "dual";
  return "legacy";
}

export type NormalizedEventName = {
  isMapped: boolean;
  legacyName: string;
  prefixedName: string | null;
  logicalName: string;
};

export function normalizeEventName(name: string): NormalizedEventName {
  const n = String(name || "");
  const prefixed = legacyToPrefixed.get(n);
  if (prefixed) {
    return { isMapped: true, legacyName: n, prefixedName: prefixed, logicalName: n };
  }

  const legacy = prefixedToLegacy.get(n);
  if (legacy) {
    return { isMapped: true, legacyName: legacy, prefixedName: n, logicalName: legacy };
  }

  return { isMapped: false, legacyName: n, prefixedName: null, logicalName: n };
}

export function mapLegacyToPrefixed(name: string): string | null {
  return legacyToPrefixed.get(String(name || "")) ?? null;
}

export function mapPrefixedToLegacy(name: string): string | null {
  return prefixedToLegacy.get(String(name || "")) ?? null;
}
