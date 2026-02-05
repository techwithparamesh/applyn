/**
 * Subscription Middleware
 * 
 * Handles feature gating based on subscription status.
 * 
 * BUSINESS RULES:
 * - Apps continue working even if subscription expires
 * - Only rebuilds, updates, and support are blocked when expired
 * - Always allow renewal at any time
 * 
 * FEATURE GATING BY PLAN:
 * 
 * STARTER (₹1,999/year):
 *   ✓ Basic native shell, pull-to-refresh, offline screen
 *   ✗ Push notifications, bottom navigation, iOS build
 * 
 * STANDARD (₹3,999/year):
 *   ✓ Push notifications, bottom navigation, deep linking
 *   ✗ iOS build, white-label
 * 
 * PRO (₹6,999/year):
 *   ✓ All features including iOS, white-label, priority support
 * 
 * EXPIRED PLAN:
 *   ✓ App continues working (published apps stay live)
 *   ✗ Rebuilds, store compliance updates, new builds, support
 */

import { Request, Response, NextFunction } from "express";
import { User, PlanStatus, PlanId } from "@shared/schema";
import { getPlan, getRebuildsForPlan, getMaxAppsForPlan, getMaxTeamMembersForPlan, isSubscriptionActive, PlanDefinition, checkAppLimit } from "@shared/pricing";
import { getEntitlements } from "./entitlements";

// ============================================
// TYPES
// ============================================

export interface SubscriptionInfo {
  plan: PlanId | null;
  planStatus: PlanStatus | null;
  planStartDate: Date | null;
  planExpiryDate: Date | null;
  remainingRebuilds: number;
  isActive: boolean;
  daysUntilExpiry: number;
  canRebuild: boolean;
  canAccessUpdates: boolean;
  needsRenewal: boolean;
}

// Feature names that can be gated
export type GatedFeature = 
  | "pushNotifications"
  | "pushNotificationsIos"
  | "bottomNavigation"
  | "deepLinking"
  | "customNativeMenu"
  | "nativeLoadingProgress"
  | "iosBuild"
  | "whiteLabel"
  | "rebuild"
  | "newBuild"
  | "supportTicket"
  | "multiAppDashboard"
  | "teamAccess"
  | "priorityBuildQueue";

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get subscription info for a user
 */
export function getSubscriptionInfo(user: User): SubscriptionInfo {
  const entitlements = getEntitlements(user);
  const plan = (entitlements.plan as PlanId) || null;
  const planStatus = (user.planStatus as PlanStatus) || null;
  const planStartDate = user.planStartDate || null;
  const planExpiryDate = user.planExpiryDate || null;
  const remainingRebuilds = user.remainingRebuilds || 0;

  // IMPORTANT: operational gating should rely on getEntitlements(user) as the source of truth,
  // so trials behave like an active Standard subscription.
  const isActive = Boolean(entitlements.isActive);
  
  // Calculate days until expiry
  let daysUntilExpiry = 0;
  if (planExpiryDate) {
    const now = new Date();
    const diff = planExpiryDate.getTime() - now.getTime();
    daysUntilExpiry = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  
  // Determine feature access
  const canRebuild = isActive && remainingRebuilds > 0;
  const canAccessUpdates = isActive;
  const needsRenewal = !isActive || daysUntilExpiry <= 7;
  
  return {
    plan,
    planStatus,
    planStartDate,
    planExpiryDate,
    remainingRebuilds,
    isActive,
    daysUntilExpiry,
    canRebuild,
    canAccessUpdates,
    needsRenewal,
  };
}

/**
 * Check if user can access a specific feature based on their plan
 * 
 * @param user - The user object
 * @param feature - The feature to check access for
 * @returns Object with allowed status and reason
 */
export function checkPlanAccess(user: User, feature: GatedFeature): {
  allowed: boolean;
  reason?: string;
  requiredPlan?: PlanId;
  currentPlan: PlanId | null;
  isExpired: boolean;
} {
  const info = getSubscriptionInfo(user);
  const currentPlan = info.plan;
  const isExpired = !info.isActive;
  
  // If no plan at all
  if (!currentPlan) {
    return {
      allowed: false,
      reason: "No subscription found. Please subscribe to a plan.",
      currentPlan: null,
      isExpired: true,
    };
  }
  
  // Get plan definition
  const planDef = getPlan(currentPlan);
  
  // Check features that are blocked when expired
  const expiredBlockedFeatures: GatedFeature[] = ["rebuild", "newBuild", "supportTicket"];
  if (isExpired && expiredBlockedFeatures.includes(feature)) {
    return {
      allowed: false,
      reason: "Your Annual App License has expired. Renew to continue updates.",
      currentPlan,
      isExpired: true,
    };
  }
  
  // Feature gating by plan
  switch (feature) {
    case "pushNotifications":
      if (!planDef.features.pushNotifications) {
        return {
          allowed: false,
          reason: "Push notifications require Standard or Pro plan.",
          requiredPlan: "standard",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "pushNotificationsIos":
      if (!planDef.features.pushNotificationsIos) {
        return {
          allowed: false,
          reason: "iOS push notifications (APNs) require Pro plan.",
          requiredPlan: "pro",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "bottomNavigation":
      if (!planDef.features.bottomNavigation) {
        return {
          allowed: false,
          reason: "Native bottom navigation requires Standard or Pro plan.",
          requiredPlan: "standard",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "deepLinking":
      if (!planDef.features.deepLinking) {
        return {
          allowed: false,
          reason: "Deep linking requires Standard or Pro plan.",
          requiredPlan: "standard",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "customNativeMenu":
      if (!planDef.features.customNativeMenu) {
        return {
          allowed: false,
          reason: "Custom native menu requires Pro plan.",
          requiredPlan: "pro",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "nativeLoadingProgress":
      if (!planDef.features.nativeLoadingProgress) {
        return {
          allowed: false,
          reason: "Native loading progress bar requires Standard or Pro plan.",
          requiredPlan: "standard",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "iosBuild":
      if (!planDef.outputs.iosIpa) {
        return {
          allowed: false,
          reason: "iOS builds require Pro plan.",
          requiredPlan: "pro",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "whiteLabel":
      if (!planDef.features.whiteLabel) {
        return {
          allowed: false,
          reason: "White-label branding requires Pro plan.",
          requiredPlan: "pro",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "rebuild":
      if (!info.canRebuild) {
        if (info.remainingRebuilds <= 0) {
          return {
            allowed: false,
            reason: "No rebuilds remaining. Upgrade your plan or purchase an extra rebuild for ₹499.",
            currentPlan,
            isExpired,
          };
        }
        return {
          allowed: false,
          reason: "Your Annual App License has expired. Renew to continue rebuilding.",
          currentPlan,
          isExpired: true,
        };
      }
      break;
      
    case "newBuild":
      if (!info.isActive) {
        return {
          allowed: false,
          reason: "Your Annual App License has expired. Renew to create new builds.",
          currentPlan,
          isExpired: true,
        };
      }
      break;
      
    case "supportTicket":
      if (!info.isActive) {
        return {
          allowed: false,
          reason: "Your Annual App License has expired. Renew to submit support tickets.",
          currentPlan,
          isExpired: true,
        };
      }
      break;
      
    case "multiAppDashboard":
      if (!planDef.features.multiAppDashboard) {
        return {
          allowed: false,
          reason: "Multi-app dashboard is only available with the Agency plan.",
          requiredPlan: "agency",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "teamAccess":
      if (!planDef.features.teamAccess) {
        return {
          allowed: false,
          reason: "Team access is only available with the Agency plan.",
          requiredPlan: "agency",
          currentPlan,
          isExpired,
        };
      }
      break;
      
    case "priorityBuildQueue":
      if (!planDef.features.priorityBuildQueue) {
        return {
          allowed: false,
          reason: "Priority build queue requires Pro or Agency plan.",
          requiredPlan: "pro",
          currentPlan,
          isExpired,
        };
      }
      break;
  }
  
  return {
    allowed: true,
    currentPlan,
    isExpired,
  };
}

/**
 * Get allowed features for a user based on their plan
 */
export function getAllowedFeatures(user: User): {
  plan: PlanId | null;
  isActive: boolean;
  maxApps: number;
  maxTeamMembers: number;
  features: {
    pushNotifications: boolean;
    bottomNavigation: boolean;
    deepLinking: boolean;
    customNativeMenu: boolean;
    nativeLoadingProgress: boolean;
    iosBuild: boolean;
    whiteLabel: boolean;
    multiAppDashboard: boolean;
    teamAccess: boolean;
    priorityBuildQueue: boolean;
  };
} {
  const info = getSubscriptionInfo(user);
  
  if (!info.plan || !info.isActive) {
    return {
      plan: info.plan,
      isActive: false,
      maxApps: 0,
      maxTeamMembers: 1,
      features: {
        pushNotifications: false,
        bottomNavigation: false,
        deepLinking: false,
        customNativeMenu: false,
        nativeLoadingProgress: false,
        iosBuild: false,
        whiteLabel: false,
        multiAppDashboard: false,
        teamAccess: false,
        priorityBuildQueue: false,
      },
    };
  }
  
  const planDef = getPlan(info.plan);
  
  return {
    plan: info.plan,
    isActive: true,
    maxApps: planDef.maxApps + (user.extraAppSlots || 0),
    maxTeamMembers: planDef.maxTeamMembers,
    features: {
      pushNotifications: planDef.features.pushNotifications,
      bottomNavigation: planDef.features.bottomNavigation,
      deepLinking: planDef.features.deepLinking,
      customNativeMenu: planDef.features.customNativeMenu,
      nativeLoadingProgress: planDef.features.nativeLoadingProgress,
      iosBuild: planDef.outputs.iosIpa,
      whiteLabel: planDef.features.whiteLabel,
      multiAppDashboard: planDef.features.multiAppDashboard,
      teamAccess: planDef.features.teamAccess,
      priorityBuildQueue: planDef.features.priorityBuildQueue,
    },
  };
}

/**
 * Check if user has an active plan
 */
export function checkActivePlan(user: User): {
  hasActivePlan: boolean;
  reason?: string;
  subscriptionInfo: SubscriptionInfo;
} {
  const info = getSubscriptionInfo(user);
  
  if (!info.plan) {
    return {
      hasActivePlan: false,
      reason: "No subscription found. Please subscribe to a plan.",
      subscriptionInfo: info,
    };
  }
  
  if (!info.isActive) {
    return {
      hasActivePlan: false,
      reason: "Your Annual App License has expired. Renew to continue updates.",
      subscriptionInfo: info,
    };
  }
  
  return {
    hasActivePlan: true,
    subscriptionInfo: info,
  };
}

/**
 * Check if user can request a rebuild
 */
export function canRequestRebuild(user: User): {
  allowed: boolean;
  reason?: string;
  remainingRebuilds: number;
  subscriptionInfo: SubscriptionInfo;
} {
  const info = getSubscriptionInfo(user);
  
  // Check if subscription is active
  if (!info.isActive) {
    return {
      allowed: false,
      reason: "Your Annual App License has expired. Renew to continue rebuilding your app.",
      remainingRebuilds: 0,
      subscriptionInfo: info,
    };
  }
  
  // Check remaining rebuilds
  if (info.remainingRebuilds <= 0) {
    return {
      allowed: false,
      reason: "No rebuilds remaining. Upgrade your plan or purchase an extra rebuild for ₹499.",
      remainingRebuilds: 0,
      subscriptionInfo: info,
    };
  }
  
  return {
    allowed: true,
    remainingRebuilds: info.remainingRebuilds,
    subscriptionInfo: info,
  };
}

// ============================================
// APP LIMIT ENFORCEMENT
// ============================================

export interface AppLimitResult {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  maxAllowed: number;
  canPurchaseSlot: boolean;
  plan: PlanId | null;
}

/**
 * Check if user can create a new app based on their plan limits
 */
export function checkUserAppLimit(user: User, currentAppsCount: number): AppLimitResult {
  const info = getSubscriptionInfo(user);
  
  // No plan = no apps allowed
  if (!info.plan) {
    return {
      allowed: false,
      reason: "No subscription found. Please subscribe to a plan to create apps.",
      currentCount: currentAppsCount,
      maxAllowed: 0,
      canPurchaseSlot: false,
      plan: null,
    };
  }
  
  // Expired plan = no new apps, but existing apps stay
  if (!info.isActive) {
    return {
      allowed: false,
      reason: "Your subscription has expired. Renew to create new apps.",
      currentCount: currentAppsCount,
      maxAllowed: 0,
      canPurchaseSlot: false,
      plan: info.plan,
    };
  }
  
  const planDef = getPlan(info.plan);
  const extraSlots = user.extraAppSlots || 0;
  const maxAllowed = planDef.maxApps + extraSlots;
  
  if (currentAppsCount >= maxAllowed) {
    return {
      allowed: false,
      reason: `You've reached your app limit (${maxAllowed}). Upgrade your plan or purchase an extra app slot for ₹1,499/year.`,
      currentCount: currentAppsCount,
      maxAllowed,
      canPurchaseSlot: true,
      plan: info.plan,
    };
  }
  
  return {
    allowed: true,
    currentCount: currentAppsCount,
    maxAllowed,
    canPurchaseSlot: currentAppsCount >= planDef.maxApps,
    plan: info.plan,
  };
}

/**
 * Check if user can add a team member (Agency plan feature)
 */
export function checkTeamMemberLimit(user: User): {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  maxAllowed: number;
} {
  const info = getSubscriptionInfo(user);
  
  if (!info.plan || !info.isActive) {
    return {
      allowed: false,
      reason: "Team access requires an active Agency plan.",
      currentCount: user.teamMembers || 1,
      maxAllowed: 1,
    };
  }
  
  const planDef = getPlan(info.plan);
  
  if (!planDef.features.teamAccess) {
    return {
      allowed: false,
      reason: "Team access is only available with the Agency plan.",
      currentCount: 1,
      maxAllowed: 1,
    };
  }
  
  const currentMembers = user.teamMembers || 1;
  const maxMembers = planDef.maxTeamMembers;
  
  if (currentMembers >= maxMembers) {
    return {
      allowed: false,
      reason: `You've reached your team member limit (${maxMembers}).`,
      currentCount: currentMembers,
      maxAllowed: maxMembers,
    };
  }
  
  return {
    allowed: true,
    currentCount: currentMembers,
    maxAllowed: maxMembers,
  };
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

/**
 * Middleware to require active subscription
 * Blocks requests if subscription is expired
 */
export function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User | undefined;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const { hasActivePlan, reason, subscriptionInfo } = checkActivePlan(user);
  
  if (!hasActivePlan) {
    return res.status(403).json({
      message: reason,
      code: "SUBSCRIPTION_EXPIRED",
      subscriptionInfo: {
        plan: subscriptionInfo.plan,
        planStatus: subscriptionInfo.planStatus,
        planExpiryDate: subscriptionInfo.planExpiryDate,
        needsRenewal: true,
      },
    });
  }
  
  // Attach subscription info to request for downstream use
  (req as any).subscriptionInfo = subscriptionInfo;
  next();
}

/**
 * Middleware to check if rebuild is allowed
 */
export function requireRebuildAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User | undefined;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const { allowed, reason, remainingRebuilds, subscriptionInfo } = canRequestRebuild(user);
  
  if (!allowed) {
    return res.status(403).json({
      message: reason,
      code: subscriptionInfo.isActive ? "NO_REBUILDS_REMAINING" : "SUBSCRIPTION_EXPIRED",
      remainingRebuilds,
      subscriptionInfo: {
        plan: subscriptionInfo.plan,
        planStatus: subscriptionInfo.planStatus,
        planExpiryDate: subscriptionInfo.planExpiryDate,
        needsRenewal: subscriptionInfo.needsRenewal,
      },
    });
  }
  
  (req as any).subscriptionInfo = subscriptionInfo;
  next();
}

/**
 * Middleware to optionally check subscription (non-blocking)
 * Attaches subscription info but doesn't block the request
 */
export function attachSubscriptionInfo(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User | undefined;
  
  if (user) {
    (req as any).subscriptionInfo = getSubscriptionInfo(user);
  }
  
  next();
}

// ============================================
// SUBSCRIPTION MANAGEMENT HELPERS
// ============================================

/**
 * Calculate new expiry date when activating or renewing subscription
 */
export function calculateExpiryDate(currentExpiryDate?: Date | null): Date {
  const now = new Date();
  
  // If current subscription is still active, extend from expiry date
  // Otherwise, start from now
  if (currentExpiryDate && currentExpiryDate > now) {
    const newExpiry = new Date(currentExpiryDate);
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);
    return newExpiry;
  }
  
  // Start fresh from now
  const newExpiry = new Date(now);
  newExpiry.setFullYear(newExpiry.getFullYear() + 1);
  return newExpiry;
}

/**
 * Get subscription activation data for a plan
 */
export function getSubscriptionActivationData(planId: PlanId, currentExpiryDate?: Date | null) {
  const now = new Date();
  const expiryDate = calculateExpiryDate(currentExpiryDate);
  const rebuilds = getRebuildsForPlan(planId);
  const maxApps = getMaxAppsForPlan(planId);
  const maxTeamMembers = getMaxTeamMembersForPlan(planId);
  
  return {
    plan: planId,
    planStatus: "active" as PlanStatus,
    planStartDate: now,
    planExpiryDate: expiryDate,
    remainingRebuilds: rebuilds,
    maxAppsAllowed: maxApps,
    maxTeamMembers: maxTeamMembers,
  };
}

/**
 * Decrement rebuild count
 */
export function decrementRebuilds(currentRebuilds: number): number {
  return Math.max(0, currentRebuilds - 1);
}

/**
 * Get data for purchasing extra app slot add-on
 */
export function getExtraAppSlotData(currentSlots: number = 0) {
  return {
    extraAppSlots: currentSlots + 1,
  };
}

/**
 * Get data for purchasing extra rebuilds
 */
export function getExtraRebuildsData(currentRebuilds: number, quantity: number = 1) {
  return {
    remainingRebuilds: currentRebuilds + quantity,
  };
}
