export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function coursesEvents(emit: EmitAppEvent) {
  return {
    courseEnrolled: (appId: string, customerId: string, payload: { enrollmentId: string; courseId: string }) =>
      emit(appId, customerId, "course.enrolled", payload),
  };
}
