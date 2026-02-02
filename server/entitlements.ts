import type { User } from "@shared/schema";
import { getPlan, isSubscriptionActive, type PlanId } from "@shared/pricing";

export type BuildPlatform = "android" | "ios" | "both";

export type Entitlements = {
  plan: PlanId | null;
  isActive: boolean;
  canBuild: boolean;
  canBuildIos: boolean;
};

export function getEntitlements(user: User | null): Entitlements {
  const plan = (user?.plan as PlanId) || null;
  const isActive =
    !!plan && user?.planStatus === "active" && isSubscriptionActive(user?.planExpiryDate || null);

  if (!plan || !isActive) {
    return {
      plan,
      isActive: false,
      canBuild: false,
      canBuildIos: false,
    };
  }

  const planDef = getPlan(plan);
  return {
    plan,
    isActive: true,
    canBuild: true,
    canBuildIos: Boolean(planDef.outputs.iosIpa),
  };
}

export function assertCanQueueBuild(user: User | null, platform: BuildPlatform): void {
  const ent = getEntitlements(user);
  if (!ent.canBuild) {
    throw new Error("Your Annual App License is not active. Renew to continue building.");
  }

  if ((platform === "ios" || platform === "both") && !ent.canBuildIos) {
    throw new Error("iOS builds require Pro plan.");
  }
}
