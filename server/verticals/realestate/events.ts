export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function realEstateEvents(emit: EmitAppEvent) {
  return {
    inquiryCreated: (appId: string, customerId: string | null, payload: { inquiryId: string; listingId: string }) =>
      emit(appId, customerId, "listing.inquiry.created", payload),

    inquiryAssigned: (appId: string, payload: { inquiryId: string; listingId: string; agentId: string }) =>
      emit(appId, null, "listing.inquiry.assigned", payload),

    tourScheduled: (appId: string, payload: { tourId: string; listingId: string; agentId: string; startAt: string }) =>
      emit(appId, null, "tour.scheduled", payload),

    leadConverted: (appId: string, payload: { inquiryId: string; listingId: string }) =>
      emit(appId, null, "lead.converted", payload),
  };
}
