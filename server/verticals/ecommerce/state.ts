export type EcommerceOrderStatus =
  | "created" // legacy
  | "pending"
  | "paid"
  | "packed"
  | "shipped"
  | "delivered"
  | "canceled"
  | "refunded";

const allowedTransitions: Record<EcommerceOrderStatus, EcommerceOrderStatus[]> = {
  created: ["paid", "canceled"],
  pending: ["paid", "canceled"],
  paid: ["packed", "refunded"],
  packed: ["shipped", "canceled"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  canceled: [],
  refunded: [],
};

export function normalizeEcommerceOrderStatus(raw: unknown): EcommerceOrderStatus {
  const s = String(raw || "").toLowerCase();
  if (s === "created") return "created";
  if (s === "pending") return "pending";
  if (s === "paid") return "paid";
  if (s === "packed") return "packed";
  if (s === "shipped") return "shipped";
  if (s === "delivered") return "delivered";
  if (s === "canceled" || s === "cancelled") return "canceled";
  if (s === "refunded") return "refunded";
  return "pending";
}

export function assertEcommerceOrderTransition(from: EcommerceOrderStatus, to: EcommerceOrderStatus) {
  const allowed = allowedTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid order status transition: ${from} -> ${to}`);
  }
}
