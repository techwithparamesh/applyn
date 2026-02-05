import type { User } from "@shared/schema";
import { getPlan, isSubscriptionActive, type PlanId } from "@shared/pricing";
import { storage } from "./storage";

export type BuildPlatform = "android" | "ios" | "both";

export type Entitlements = {
  plan: PlanId | null;
  isActive: boolean;
  isInGrace: boolean;
  isTrialActive: boolean;
  isGraceActive: boolean;
  graceEndsAt?: Date | null;
  canBuild: boolean;
  canBuildIos: boolean;
  canPublishPlay: boolean;
  canPublishAppStore: boolean;
  canUsePush: boolean;
  rebuildsRemaining: number;
};

const GRACE_PERIOD_DAYS = 3;

function gracePeriodMs() {
  return GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
}

export function getEntitlements(user: User | null): Entitlements {
  const planFromSubscription = (user?.plan as PlanId) || null;
  let isSubscriptionActiveNow = false;
  let isInGrace = false;
  let graceEndsAt: Date | null = null;
  if (planFromSubscription && user?.planStatus === "active") {
    if (isSubscriptionActive(user?.planExpiryDate || null)) {
      isSubscriptionActiveNow = true;
      isInGrace = false;
    } else if (user?.planExpiryDate) {
      const expiryMs = new Date(user.planExpiryDate).getTime();
      if (Number.isFinite(expiryMs) && expiryMs + gracePeriodMs() > Date.now()) {
        isSubscriptionActiveNow = true;
        isInGrace = true;
        graceEndsAt = new Date(expiryMs + gracePeriodMs());
      }
    }
  }

  const isTrialActive =
    !!user?.trialStartedAt &&
    !!user?.trialEndsAt &&
    new Date(user.trialEndsAt).getTime() > Date.now();

  // Read-time integrity correction (best-effort; non-blocking):
  // If DB still says planStatus=active but the subscription has expired and we're not in grace,
  // mark it expired for future consistency. Never touch trial users.
  try {
    const expiryMs = user?.planExpiryDate ? new Date(user.planExpiryDate).getTime() : NaN;
    if (
      user?.id &&
      user?.planStatus === "active" &&
      Number.isFinite(expiryMs) &&
      expiryMs < Date.now() &&
      !isInGrace &&
      !isTrialActive
    ) {
      void storage.updateSubscriptionStatus(String(user.id), "expired").catch(() => {
        // ignore
      });
    }
  } catch {
    // ignore
  }

  const effectiveIsTrialActive = Boolean(!isSubscriptionActiveNow && isTrialActive);

  const effectivePlan: PlanId | null = isSubscriptionActiveNow
    ? planFromSubscription
    : isTrialActive
      ? "standard"
      : planFromSubscription;

  const effectiveIsActive = Boolean(isSubscriptionActiveNow || (!isSubscriptionActiveNow && isTrialActive));
  const effectiveIsInGrace = Boolean(isSubscriptionActiveNow && isInGrace);
  const effectiveIsGraceActive = Boolean(isSubscriptionActiveNow && isInGrace);

  // Subscription (including grace) overrides trial visibility.
  const visibleTrialActive = effectiveIsTrialActive;
  const visibleGraceActive = effectiveIsGraceActive;
  const visibleGraceEndsAt = visibleGraceActive ? graceEndsAt : null;

  if (!effectivePlan || !effectiveIsActive) {
    return {
      plan: effectivePlan,
      isActive: false,
      isInGrace: false,
      isTrialActive: false,
      isGraceActive: false,
      graceEndsAt: null,
      canBuild: false,
      canBuildIos: false,
      canPublishPlay: false,
      canPublishAppStore: false,
      canUsePush: false,
      rebuildsRemaining: 0,
    };
  }

  const planDef = getPlan(effectivePlan);
  const canPublish = !effectiveIsInGrace;
  return {
    plan: effectivePlan,
    isActive: true,
    isInGrace: effectiveIsInGrace,
    isTrialActive: visibleTrialActive,
    isGraceActive: visibleGraceActive,
    graceEndsAt: visibleGraceEndsAt,
    canBuild: true,
    canBuildIos: Boolean(planDef.outputs.iosIpa),
    canPublishPlay: Boolean(canPublish && planDef.features.playStoreReady),
    canPublishAppStore: Boolean(canPublish && planDef.features.appStoreReady),
    canUsePush: Boolean(canPublish && planDef.features.pushNotifications),
    rebuildsRemaining: Math.max(0, Number((user as any)?.remainingRebuilds ?? 0)),
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
