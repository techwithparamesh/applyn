export type InquiryStatus = "new" | "assigned" | "contacted" | "tour_scheduled" | "converted" | "lost";

const inquiryTransitions: Record<InquiryStatus, InquiryStatus[]> = {
  new: ["assigned", "lost"],
  assigned: ["contacted", "tour_scheduled", "lost"],
  contacted: ["tour_scheduled", "converted", "lost"],
  tour_scheduled: ["converted", "lost"],
  converted: [],
  lost: [],
};

export function normalizeInquiryStatus(raw: unknown): InquiryStatus {
  const s = String(raw || "").toLowerCase();
  if (s === "new") return "new";
  if (s === "assigned") return "assigned";
  if (s === "contacted") return "contacted";
  if (s === "tour_scheduled") return "tour_scheduled";
  if (s === "converted") return "converted";
  if (s === "lost") return "lost";
  return "new";
}

export function assertInquiryTransition(from: InquiryStatus, to: InquiryStatus) {
  const allowed = inquiryTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid inquiry status transition: ${from} -> ${to}`);
  }
}

export type TourStatus = "scheduled" | "completed" | "cancelled";

const tourTransitions: Record<TourStatus, TourStatus[]> = {
  scheduled: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function normalizeTourStatus(raw: unknown): TourStatus {
  const s = String(raw || "").toLowerCase();
  if (s === "scheduled") return "scheduled";
  if (s === "completed") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "scheduled";
}

export function assertTourTransition(from: TourStatus, to: TourStatus) {
  const allowed = tourTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid tour status transition: ${from} -> ${to}`);
  }
}
