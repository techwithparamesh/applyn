/**
 * Applyn Pricing & Plan Configuration
 * 
 * YEARLY RENEWAL MODEL - Annual App License with renewal logic.
 * All plans require yearly renewal for continued updates and support.
 * 
 * IMPORTANT BUSINESS RULES:
 * - Apps continue working even if subscription expires
 * - Only rebuilds, updates, and support are blocked when expired
 * - Always allow renewal at any time
 * 
 * PRICING (per year):
 * - Starter: ₹1,999/year - 1 Android app, basic native shell
 * - Standard: ₹3,999/year - 1 Android app, smart hybrid enhancements
 * - Pro: ₹6,999/year - 1 Android + 1 iOS app, full features
 * - Agency: ₹19,999/year - Up to 10 apps, team access
 */

// ============================================
// PLAN TYPES & DEFINITIONS
// ============================================

export type PlanId = "preview" | "starter" | "standard" | "pro" | "agency";
export type PlanStatus = "active" | "expired" | "cancelled";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  price: number;              // Yearly price in INR
  originalPrice?: number;     // For showing "was" price
  monthlyEquivalent: number;  // Price / 12 for display
  currency: "INR";
  
  // App limits
  maxApps: number;            // Maximum apps allowed
  maxTeamMembers: number;     // Team members allowed (Agency only)
  
  // Build outputs
  outputs: {
    androidApk: boolean;
    androidAab: boolean;      // Play Store format
    iosIpa: boolean;
    iosAppStore: boolean;     // App Store ready (vs Ad-Hoc)
  };
  
  // Features - Native Enhancement Layer
  features: {
    playStoreReady: boolean;
    appStoreReady: boolean;
    // Native features
    nativeHeader: boolean;        // Native header with theme color
    pullToRefresh: boolean;       // Swipe down to refresh
    offlineScreen: boolean;       // Offline fallback screen
    smartBackButton: boolean;     // Smart back button handling
    nativeLoadingProgress: boolean; // Native loading progress bar
    bottomNavigation: boolean;    // Native bottom navigation
    deepLinking: boolean;         // Deep linking support
    customNativeMenu: boolean;    // Custom native menu items
    // Push notifications
    pushNotifications: boolean;   // FCM for Android
    pushNotificationsIos: boolean; // APNs for iOS
    // Branding
    whiteLabel: boolean;
    customBranding: boolean;
    customSplash: boolean;
    customColors: boolean;
    customLogo: boolean;
    storeComplianceUpdates: boolean;
    // Agency features
    multiAppDashboard: boolean;
    teamAccess: boolean;
    priorityBuildQueue: boolean;
  };
  
  // Support
  support: {
    type: "email" | "priority" | "dedicated";
    responseTime: string;
    whatsappSupport: boolean;
    fasterBuildQueue: boolean;
  };
  
  // Rebuilds per year
  rebuildsPerYear: number;
  
  // Display
  cta: string;
  popular: boolean;
  badge?: string;            // Special badge like "Best for Agencies"
  featureList: string[];
  restrictions: string[];
  label: string;
}

// ============================================
// YEARLY PLAN CONFIGURATIONS
// ============================================

export const PLANS: Record<PlanId, PlanDefinition> = {
  /**
   * PREVIEW - FREE
   * Positioning: Try before you buy
   * Users can build and preview their app, but cannot download or publish
   */
  preview: {
    id: "preview",
    name: "Preview",
    tagline: "Try Before You Buy",
    price: 0,
    originalPrice: 0,
    monthlyEquivalent: 0,
    currency: "INR",
    
    maxApps: 1,
    maxTeamMembers: 1,
    
    outputs: {
      androidApk: false,      // Cannot download APK
      androidAab: false,      // Cannot download AAB
      iosIpa: false,
      iosAppStore: false,
    },
    
    features: {
      playStoreReady: false,
      appStoreReady: false,
      // Native features - Basic preview only
      nativeHeader: true,
      pullToRefresh: true,
      offlineScreen: true,
      smartBackButton: true,
      nativeLoadingProgress: false,
      bottomNavigation: false,
      deepLinking: false,
      customNativeMenu: false,
      // Push notifications - Not included
      pushNotifications: false,
      pushNotificationsIos: false,
      // Branding - Shows Applyn watermark
      whiteLabel: false,
      customBranding: false,
      customSplash: true,
      customColors: true,
      customLogo: true,
      storeComplianceUpdates: false,
      // Agency features - Not included
      multiAppDashboard: false,
      teamAccess: false,
      priorityBuildQueue: false,
    },
    
    support: {
      type: "email",
      responseTime: "Best effort",
      whatsappSupport: false,
      fasterBuildQueue: false,
    },
    rebuildsPerYear: 0,
    
    cta: "Start Free Preview",
    popular: false,
    featureList: [
      "Preview on any device",
      "Real-time app preview",
      "QR code sharing",
      "Test all features",
      "No credit card required",
    ],
    restrictions: [
      "❌ Cannot download APK/AAB",
      "❌ Cannot publish to stores",
      "❌ Applyn watermark",
      "❌ No push notifications",
    ],
    label: "Free Preview",
  },

  /**
   * STARTER - ₹1,999/year
   * Positioning: Entry-level Android businesses
   * Basic native shell without advanced features
   */
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "Android Play Store Ready",
    price: 1999,
    originalPrice: 2499,
    monthlyEquivalent: 167,  // ~₹167/month
    currency: "INR",
    
    maxApps: 1,
    maxTeamMembers: 1,
    
    outputs: {
      androidApk: false,       // No APK, only AAB for store
      androidAab: true,        // Signed AAB for Play Store
      iosIpa: false,
      iosAppStore: false,
    },
    
    features: {
      playStoreReady: true,
      appStoreReady: false,
      // Native features - Basic shell only
      nativeHeader: true,          // ✓ Native header with theme color
      pullToRefresh: true,         // ✓ Pull-to-refresh
      offlineScreen: true,         // ✓ Offline screen
      smartBackButton: true,       // ✓ Smart back button handling
      nativeLoadingProgress: false, // ✗ No native progress bar
      bottomNavigation: false,     // ✗ No bottom nav
      deepLinking: false,          // ✗ No deep linking
      customNativeMenu: false,     // ✗ No custom menu
      // Push notifications - Not included
      pushNotifications: false,
      pushNotificationsIos: false,
      // Branding
      whiteLabel: false,
      customBranding: false,
      customSplash: true,          // Basic splash
      customColors: true,          // Theme color
      customLogo: true,            // Custom app icon
      storeComplianceUpdates: true, // Android only
      // Agency features - Not included
      multiAppDashboard: false,
      teamAccess: false,
      priorityBuildQueue: false,
    },
    
    support: {
      type: "email",
      responseTime: "72 hours",
      whatsappSupport: false,
      fasterBuildQueue: false,
    },
    rebuildsPerYear: 1,
    
    cta: "Get Android App",
    popular: false,
    featureList: [
      "1 Android App",
      "Basic Native Shell",
      "Pull-to-refresh",
      "Offline screen",
      "Smart back handling",
      "1 rebuild per year",
      "Store compliance updates",
      "Email support (72h)",
    ],
    restrictions: [
      "❌ No push notifications",
      "❌ No native bottom navigation",
      "❌ No iOS build",
    ],
    label: "Entry-level Android",
  },
  
  /**
   * STANDARD - ₹3,999/year (Most Popular)
   * Positioning: Serious Android businesses
   * Smart Hybrid Native Layer with push notifications
   */
  standard: {
    id: "standard",
    name: "Standard",
    tagline: "Smart Hybrid Enhancements",
    price: 3999,
    originalPrice: 4999,
    monthlyEquivalent: 333,  // ~₹333/month
    currency: "INR",
    
    maxApps: 1,
    maxTeamMembers: 1,
    
    outputs: {
      androidApk: true,        // APK for testing
      androidAab: true,        // AAB for Play Store
      iosIpa: false,
      iosAppStore: false,
    },
    
    features: {
      playStoreReady: true,
      appStoreReady: false,
      // Native features - Full Android native layer
      nativeHeader: true,
      pullToRefresh: true,
      offlineScreen: true,
      smartBackButton: true,
      nativeLoadingProgress: true, // ✓ Native loading progress bar
      bottomNavigation: true,      // ✓ Native bottom navigation
      deepLinking: true,           // ✓ Deep linking support
      customNativeMenu: false,     // ✗ Pro only
      // Push notifications - FCM only
      pushNotifications: true,     // ✓ FCM for Android
      pushNotificationsIos: false,
      // Branding
      whiteLabel: false,
      customBranding: true,
      customSplash: true,
      customColors: true,
      customLogo: true,
      storeComplianceUpdates: true,
      // Agency features - Not included
      multiAppDashboard: false,
      teamAccess: false,
      priorityBuildQueue: false,
    },
    
    support: {
      type: "email",
      responseTime: "48 hours",
      whatsappSupport: false,
      fasterBuildQueue: false,
    },
    rebuildsPerYear: 2,
    
    cta: "Get Hybrid Android App",
    popular: true,
    featureList: [
      "1 Android App",
      "Smart Hybrid Enhancements",
      "Native bottom navigation",
      "Push notifications (FCM)",
      "Deep linking",
      "2 rebuilds per year",
      "Store compliance updates",
      "Email support (48h)",
    ],
    restrictions: [
      "❌ No iOS build",
      "❌ No white-label branding",
    ],
    label: "Most Popular",
  },
  
  /**
   * PRO - ₹6,999/year
   * Positioning: Brands & Agencies
   * Full native hybrid enhancements + iOS + White-label
   */
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Android + iOS",
    price: 6999,
    originalPrice: 8999,
    monthlyEquivalent: 583,  // ~₹583/month
    currency: "INR",
    
    maxApps: 2,              // 1 Android + 1 iOS
    maxTeamMembers: 1,
    
    outputs: {
      androidApk: true,
      androidAab: true,
      iosIpa: true,
      iosAppStore: true,
    },
    
    features: {
      playStoreReady: true,
      appStoreReady: true,
      // Native features - Full hybrid enhancements
      nativeHeader: true,
      pullToRefresh: true,
      offlineScreen: true,
      smartBackButton: true,
      nativeLoadingProgress: true,
      bottomNavigation: true,
      deepLinking: true,
      customNativeMenu: true,      // ✓ Custom native menu
      // Push notifications - FCM + APNs
      pushNotifications: true,
      pushNotificationsIos: true,  // ✓ APNs for iOS
      // Branding
      whiteLabel: true,            // ✓ White-label branding
      customBranding: true,
      customSplash: true,
      customColors: true,
      customLogo: true,
      storeComplianceUpdates: true, // Android + iOS
      // Agency features - Not included
      multiAppDashboard: false,
      teamAccess: false,
      priorityBuildQueue: true,    // Priority build queue
    },
    
    support: {
      type: "priority",
      responseTime: "24 hours",
      whatsappSupport: true,
      fasterBuildQueue: true,
    },
    rebuildsPerYear: 3,
    
    cta: "Get Android + iOS App",
    popular: false,
    featureList: [
      "1 Android + 1 iOS App",
      "Full Hybrid Enhancements",
      "Push notifications (FCM + APNs)",
      "White-label branding",
      "3 rebuilds per year",
      "Store compliance (Android + iOS)",
      "Priority WhatsApp support",
    ],
    restrictions: [],
    label: "Brands & Businesses",
  },
  
  /**
   * AGENCY - ₹19,999/year
   * Positioning: Digital Agencies & Resellers
   * Multi-app dashboard, team access, priority queue
   */
  agency: {
    id: "agency",
    name: "Agency",
    tagline: "Up to 10 Apps",
    price: 19999,
    originalPrice: 24999,
    monthlyEquivalent: 1667, // ~₹1,667/month
    currency: "INR",
    
    maxApps: 10,
    maxTeamMembers: 3,
    
    outputs: {
      androidApk: true,
      androidAab: true,
      iosIpa: true,
      iosAppStore: true,
    },
    
    features: {
      playStoreReady: true,
      appStoreReady: true,
      // Native features - Full hybrid enhancements
      nativeHeader: true,
      pullToRefresh: true,
      offlineScreen: true,
      smartBackButton: true,
      nativeLoadingProgress: true,
      bottomNavigation: true,
      deepLinking: true,
      customNativeMenu: true,
      // Push notifications - FCM + APNs
      pushNotifications: true,
      pushNotificationsIos: true,
      // Branding
      whiteLabel: true,
      customBranding: true,
      customSplash: true,
      customColors: true,
      customLogo: true,
      storeComplianceUpdates: true,
      // Agency features - All included
      multiAppDashboard: true,
      teamAccess: true,
      priorityBuildQueue: true,
    },
    
    support: {
      type: "dedicated",
      responseTime: "Same day",
      whatsappSupport: true,
      fasterBuildQueue: true,
    },
    rebuildsPerYear: 20,
    
    cta: "Start Agency Plan",
    popular: false,
    badge: "Best for Agencies",
    featureList: [
      "Up to 10 Apps",
      "Android + iOS builds",
      "Full Hybrid Enhancements",
      "White-label branding",
      "20 rebuilds per year",
      "Priority build queue",
      "Team access (up to 3 users)",
      "Store compliance updates",
      "Dedicated WhatsApp support",
    ],
    restrictions: [],
    label: "Digital Agencies",
  },
};

export const PLANS_LIST: PlanDefinition[] = [
  PLANS.preview,
  PLANS.starter,
  PLANS.standard,
  PLANS.pro,
  PLANS.agency,
];

// Plans available for purchase (excludes free preview)
export const PAID_PLANS_LIST: PlanDefinition[] = [
  PLANS.starter,
  PLANS.standard,
  PLANS.pro,
  PLANS.agency,
];

// ============================================
// ADD-ON PRICING
// ============================================

export const ADDONS = {
  extraAppSlot: {
    id: "extra_app_slot",
    name: "Extra App Slot",
    price: 1499,
    description: "Add one more app to your plan",
    perYear: true,
  },
  extraRebuildPack: {
    id: "extra_rebuild_pack",
    name: "Extra Rebuild Pack",
    price: 2999,
    description: "10 additional rebuilds",
    quantity: 10,
    perYear: false,
  },
  singleRebuild: {
    id: "single_rebuild",
    name: "Single Rebuild",
    price: 499,
    description: "One additional rebuild",
    quantity: 1,
    perYear: false,
  },
};

export const EXTRA_REBUILD_PRICE = 499;       // ₹499 per single rebuild
export const EXTRA_REBUILD_PACK_PRICE = 2999; // ₹2,999 for 10 rebuilds
export const EXTRA_APP_SLOT_PRICE = 1499;     // ₹1,499 per extra app slot/year

// ============================================
// SUBSCRIPTION HELPERS
// ============================================

/**
 * Get number of rebuilds for a plan
 */
export function getRebuildsForPlan(planId: PlanId): number {
  return PLANS[planId]?.rebuildsPerYear || 1;
}

/**
 * Get max apps allowed for a plan
 */
export function getMaxAppsForPlan(planId: PlanId): number {
  return PLANS[planId]?.maxApps || 1;
}

/**
 * Get max team members for a plan
 */
export function getMaxTeamMembersForPlan(planId: PlanId): number {
  return PLANS[planId]?.maxTeamMembers || 1;
}

/**
 * Check if a subscription is active based on expiry date
 */
export function isSubscriptionActive(expiryDate: Date | null): boolean {
  if (!expiryDate) return false;
  return new Date() < expiryDate;
}

/**
 * Get days until expiry
 */
export function getDaysUntilExpiry(expiryDate: Date | null): number {
  if (!expiryDate) return 0;
  const now = new Date();
  const diff = expiryDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Check if renewal reminder should be sent (7 days before expiry)
 */
export function shouldSendRenewalReminder(expiryDate: Date | null): boolean {
  const days = getDaysUntilExpiry(expiryDate);
  return days > 0 && days <= 7;
}

// ============================================
// FEATURE GATING HELPERS
// ============================================

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] || PLANS.starter;
}

export function canAccessFeature(planId: string, feature: keyof PlanDefinition["features"]): boolean {
  const plan = getPlan(planId);
  return plan.features[feature];
}

export function canDownloadFormat(planId: string, format: "apk" | "aab" | "ipa"): boolean {
  const plan = getPlan(planId);
  switch (format) {
    case "apk": return plan.outputs.androidApk;
    case "aab": return plan.outputs.androidAab;
    case "ipa": return plan.outputs.iosIpa;
    default: return false;
  }
}

export function getMinimumPlanForFeature(feature: keyof PlanDefinition["features"]): PlanId {
  if (PLANS.starter.features[feature]) return "starter";
  if (PLANS.standard.features[feature]) return "standard";
  if (PLANS.pro.features[feature]) return "pro";
  return "agency";
}

export function getUpgradeMessage(currentPlan: string, requiredFeature: string): string {
  const plan = getPlan(currentPlan);
  if (plan.id === "starter") {
    return `Upgrade to Standard to unlock ${requiredFeature}`;
  }
  if (plan.id === "standard") {
    return `Upgrade to Pro to unlock ${requiredFeature}`;
  }
  if (plan.id === "pro") {
    return `Upgrade to Agency to unlock ${requiredFeature}`;
  }
  return "";
}

/**
 * Get all features allowed for a plan
 */
export function getAllowedFeatures(planId: PlanId): PlanDefinition["features"] {
  return PLANS[planId]?.features || PLANS.starter.features;
}

// ============================================
// APP LIMIT HELPERS
// ============================================

export interface AppLimitCheck {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  maxAllowed: number;
  canPurchaseSlot: boolean;
}

/**
 * Check if user can create a new app based on their plan limits
 */
export function checkAppLimit(
  planId: PlanId,
  currentAppsCount: number,
  extraAppSlots: number = 0
): AppLimitCheck {
  const plan = PLANS[planId];
  const maxAllowed = plan.maxApps + extraAppSlots;
  
  if (currentAppsCount >= maxAllowed) {
    return {
      allowed: false,
      reason: `You've reached your app limit (${maxAllowed}). Upgrade your plan or purchase an extra app slot.`,
      currentCount: currentAppsCount,
      maxAllowed,
      canPurchaseSlot: true,
    };
  }
  
  return {
    allowed: true,
    currentCount: currentAppsCount,
    maxAllowed,
    canPurchaseSlot: currentAppsCount >= plan.maxApps,
  };
}

// ============================================
// EXPIRED PLAN FEATURE GATING
// ============================================

/**
 * Features blocked when plan is expired:
 * - Rebuilds
 * - Store compliance updates
 * - iOS builds (if Pro expired)
 * - Support tickets
 * 
 * Features ALLOWED when expired:
 * - App continues working (published apps stay live)
 * - Existing builds still downloadable
 * - View dashboard
 */
export const EXPIRED_PLAN_BLOCKED_FEATURES = [
  "rebuild",
  "storeComplianceUpdates",
  "newBuilds",
  "supportTickets",
] as const;

export type ExpiredBlockedFeature = typeof EXPIRED_PLAN_BLOCKED_FEATURES[number];

export function canAccessWhileExpired(feature: ExpiredBlockedFeature): boolean {
  // When expired, these features are blocked
  return !EXPIRED_PLAN_BLOCKED_FEATURES.includes(feature);
}

// ============================================
// BUILD READINESS CHECK TYPES
// ============================================

export type ReadinessCheckStatus = "pass" | "fail" | "warning" | "pending";

export interface ReadinessCheckItem {
  id: string;
  name: string;
  description: string;
  status: ReadinessCheckStatus;
  message?: string;
  required: boolean;
}

export interface PlayStoreReadinessResult {
  ready: boolean;
  checks: ReadinessCheckItem[];
  passCount: number;
  failCount: number;
  warningCount: number;
}

export interface AppStoreReadinessResult {
  ready: boolean;
  checks: ReadinessCheckItem[];
  passCount: number;
  failCount: number;
  warningCount: number;
}

// ============================================
// PLAY STORE REQUIREMENTS
// ============================================

export const PLAY_STORE_CHECKS = {
  PACKAGE_NAME: {
    id: "package_name",
    name: "Package Name",
    description: "Valid Android package name (e.g., com.company.app)",
    required: true,
  },
  VERSION_CODE: {
    id: "version_code",
    name: "Version Code",
    description: "Numeric version code for Play Store",
    required: true,
  },
  VERSION_NAME: {
    id: "version_name",
    name: "Version Name",
    description: "Human-readable version (e.g., 1.0.0)",
    required: true,
  },
  RELEASE_SIGNING: {
    id: "release_signing",
    name: "Release Signing",
    description: "App signed with release keystore",
    required: true,
  },
  AAB_BUILD: {
    id: "aab_build",
    name: "AAB Format",
    description: "Android App Bundle generated",
    required: true,
  },
  APP_ICON: {
    id: "app_icon",
    name: "App Icon",
    description: "Icon meets Play Store size requirements (512x512)",
    required: true,
  },
  SPLASH_SCREEN: {
    id: "splash_screen",
    name: "Splash Screen",
    description: "Splash screen configured",
    required: false,
  },
  PRIVACY_POLICY: {
    id: "privacy_policy",
    name: "Privacy Policy",
    description: "Privacy policy URL provided",
    required: true,
  },
  NO_DEBUG_FLAGS: {
    id: "no_debug_flags",
    name: "Production Mode",
    description: "Debug flags disabled for release",
    required: true,
  },
  INTERNET_PERMISSION: {
    id: "internet_permission",
    name: "Internet Permission",
    description: "INTERNET permission declared",
    required: true,
  },
  TARGET_SDK: {
    id: "target_sdk",
    name: "Target SDK",
    description: "Meets Play Store minimum SDK requirement (API 33+)",
    required: true,
  },
};

// ============================================
// APP STORE REQUIREMENTS (iOS - Pro/Agency Plan)
// ============================================

export const APP_STORE_CHECKS = {
  BUNDLE_ID: {
    id: "bundle_id",
    name: "Bundle Identifier",
    description: "Valid iOS bundle ID (e.g., com.company.app)",
    required: true,
  },
  APP_VERSION: {
    id: "app_version",
    name: "App Version",
    description: "Version number set (e.g., 1.0.0)",
    required: true,
  },
  BUILD_NUMBER: {
    id: "build_number",
    name: "Build Number",
    description: "Build number configured",
    required: true,
  },
  APP_ICONS: {
    id: "app_icons",
    name: "App Icons",
    description: "All required icon sizes provided",
    required: true,
  },
  LAUNCH_SCREEN: {
    id: "launch_screen",
    name: "Launch Screen",
    description: "Launch screen configured",
    required: true,
  },
  PRIVACY_POLICY: {
    id: "privacy_policy_ios",
    name: "Privacy Policy",
    description: "Privacy policy URL provided",
    required: true,
  },
  PUSH_CAPABILITY: {
    id: "push_capability",
    name: "Push Notifications",
    description: "Push notification capability configured",
    required: false,
  },
  SIGNING_PROFILE: {
    id: "signing_profile",
    name: "Signing Profile",
    description: "Distribution signing profile selected",
    required: true,
  },
};
