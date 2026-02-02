export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function healthcareEvents(emit: EmitAppEvent) {
  return {
    appointmentRequested: (
      appId: string,
      customerId: string | null,
      payload: { appointmentId: string; doctorId: string; startAt: string },
    ) => emit(appId, customerId, "doctor_appointment.created", payload),

    appointmentConfirmed: (appId: string, customerId: string | null, payload: { appointmentId: string; doctorId: string; startAt: string }) =>
      emit(appId, customerId, "appointment.confirmed", payload),

    appointmentCompleted: (appId: string, customerId: string | null, payload: { appointmentId: string }) =>
      emit(appId, customerId, "appointment.completed", payload),

    invoicePaid: (appId: string, payload: { invoiceId: string; amountCents: number }) =>
      emit(appId, null, "invoice.paid", payload),
  };
}
