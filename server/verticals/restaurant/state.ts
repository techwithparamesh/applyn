export type ReservationStatus = "requested" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";

const reservationTransitions: Record<ReservationStatus, ReservationStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function normalizeReservationStatus(raw: unknown): ReservationStatus {
  const s = String(raw || "").toLowerCase();
  if (s === "requested") return "requested";
  if (s === "confirmed") return "confirmed";
  if (s === "seated") return "seated";
  if (s === "completed") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "no_show" || s === "noshow") return "no_show";
  return "requested";
}

export function assertReservationTransition(from: ReservationStatus, to: ReservationStatus) {
  const allowed = reservationTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid reservation status transition: ${from} -> ${to}`);
  }
}

export type KitchenStatus = "queued" | "preparing" | "ready" | "served" | "cancelled";

const kitchenTransitions: Record<KitchenStatus, KitchenStatus[]> = {
  queued: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: [],
  cancelled: [],
};

export function normalizeKitchenStatus(raw: unknown): KitchenStatus {
  const s = String(raw || "").toLowerCase();
  if (s === "queued") return "queued";
  if (s === "preparing") return "preparing";
  if (s === "ready") return "ready";
  if (s === "served") return "served";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "queued";
}

export function assertKitchenTransition(from: KitchenStatus, to: KitchenStatus) {
  const allowed = kitchenTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid kitchen status transition: ${from} -> ${to}`);
  }
}
