export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function paymentsEvents(emit: EmitAppEvent) {
  return {
    razorpayOrderCreatedForRuntimeOrder: (appId: string, customerId: string, payload: { orderId: string; razorpayOrderId: string }) =>
      emit(appId, customerId, "payment.razorpay.created", payload),
  };
}
