export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function servicesEvents(emit: EmitAppEvent) {
  return {
    appointmentCreated: (appId: string, customerId: string, payload: { appointmentId: string; serviceId: string; startAt: string }) =>
      emit(appId, customerId, "appointment.created", payload),
  };
}
