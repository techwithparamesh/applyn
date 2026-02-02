export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function crmEvents(emit: EmitAppEvent) {
  return {
    leadCreated: (appId: string, payload: { leadId: string }) => emit(appId, null, "lead.created", payload),
  };
}
