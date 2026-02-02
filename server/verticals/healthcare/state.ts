export type HealthcareAppointmentStatus = "requested" | "confirmed" | "cancelled" | "completed" | "no_show";

const appointmentTransitions: Record<HealthcareAppointmentStatus, HealthcareAppointmentStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function normalizeAppointmentStatus(raw: unknown): HealthcareAppointmentStatus {
  const s = String(raw || "").toLowerCase();
  if (s === "requested") return "requested";
  if (s === "confirmed") return "confirmed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "completed") return "completed";
  if (s === "no_show" || s === "noshow") return "no_show";
  return "requested";
}

export function assertAppointmentTransition(from: HealthcareAppointmentStatus, to: HealthcareAppointmentStatus) {
  const allowed = appointmentTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid appointment status transition: ${from} -> ${to}`);
  }
}

export type InvoiceStatus = "issued" | "paid" | "void";

const invoiceTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  issued: ["paid", "void"],
  paid: [],
  void: [],
};

export function normalizeInvoiceStatus(raw: unknown): InvoiceStatus {
  const s = String(raw || "").toLowerCase();
  if (s === "issued") return "issued";
  if (s === "paid") return "paid";
  if (s === "void") return "void";
  return "issued";
}

export function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus) {
  const allowed = invoiceTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid invoice transition: ${from} -> ${to}`);
  }
}
