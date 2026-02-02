export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function fitnessEvents(emit: EmitAppEvent) {
  return {
    classBooked: (appId: string, customerId: string, payload: { bookingId: string; classId: string }) =>
      emit(appId, customerId, "class.booked", payload),
  };
}
