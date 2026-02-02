export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function restaurantEvents(emit: EmitAppEvent) {
  return {
    reservationCreated: (appId: string, customerId: string, payload: { reservationId: string; reservedAt: string; partySize: number }) =>
      emit(appId, customerId, "reservation.created", payload),

    reservationConfirmed: (appId: string, customerId: string, payload: { reservationId: string }) =>
      emit(appId, customerId, "reservation.confirmed", payload),

    orderKitchenReady: (appId: string, customerId: string | null, payload: { orderId: string }) =>
      emit(appId, customerId, "order.kitchen_ready", payload),
  };
}
