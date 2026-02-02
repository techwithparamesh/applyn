export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function ecommerceEvents(emit: EmitAppEvent) {
  return {
    orderCreated: (appId: string, customerId: string | null, payload: { orderId: string; totalCents: number; paymentProvider: string }) =>
      emit(appId, customerId, "order.created", payload),

    orderPaid: (
      appId: string,
      customerId: string | null,
      payload: Record<string, any> & { orderId: string; provider?: string; ref?: string },
    ) =>
      emit(appId, customerId, "order.paid", payload),

    orderPaymentFailed: (
      appId: string,
      customerId: string | null,
      payload: Record<string, any> & { orderId: string; provider?: string; ref?: string },
    ) => emit(appId, customerId, "order.payment_failed", payload),

    orderShipped: (appId: string, customerId: string | null, payload: { orderId: string; carrier?: string; trackingNumber?: string }) =>
      emit(appId, customerId, "order.shipped", payload),

    orderRefunded: (appId: string, customerId: string | null, payload: { orderId: string; refundId: string; amountCents: number }) =>
      emit(appId, customerId, "order.refunded", payload),

    stockLow: (appId: string, payload: { productId: string; variantId?: string | null; stock: number; lowStockThreshold: number }) =>
      emit(appId, null, "stock.low", payload),

    paymentRazorpayCreated: (appId: string, customerId: string, payload: { orderId: string; razorpayOrderId: string }) =>
      emit(appId, customerId, "payment.razorpay.created", payload),
  };
}
