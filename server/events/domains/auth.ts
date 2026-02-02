export type EmitAppEvent = (appId: string, customerId: string | null, name: string, properties?: any) => Promise<void>;

export function authEvents(emit: EmitAppEvent) {
  return {
    customerSignup: (appId: string, customerId: string, payload: { email: string }) =>
      emit(appId, customerId, "customer.signup", payload),

    customerLogin: (appId: string, customerId: string, payload: { email: string }) =>
      emit(appId, customerId, "customer.login", payload),
  };
}
