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
 * - Starter: ₹1,999/year - Android Play Store ready, basic native shell
 * - Standard: ₹3,999/year - Smart Hybrid Native Layer, push notifications
 * - Pro: ₹6,999/year - Android + iOS, white-label, priority support
 */

// ============================================
// PLAN TYPES & DEFINITIONS
// ============================================

export type PlanId = "starter" | "standard" | "pro";
export type PlanStatus = "active" | "expired" | "cancelled";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  price: number;              // Yearly price in INR
  originalPrice?: number;     // For showing "was" price
  monthlyEquivalent: number;  // Price / 12 for display
  currency: "INR";
  
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
  };
  
  // Support
  support: {
    type: "email" | "priority";
    responseTime: string;
    whatsappSupport: boolean;
    fasterBuildQueue: boolean;    // Priority build queue for Pro
  };
  
  // Rebuilds per year
  rebuildsPerYear: number;
  
  // Display
  cta: string;
  popular: boolean;
  featureList: string[];
  restrictions: string[];
  label: string;
}

// ============================================
// YEARLY PLAN CONFIGURATIONS
// ============================================

export const PLANS: Record<PlanId, PlanDefinition> = {
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
      "Android Play Store ready",
      "Signed AAB build",
      "WebView + Basic Native Shell",
      "Native header with theme color",
      "Pull-to-refresh",
      "Offline screen",
      "Smart back button handling",
      "1 rebuild per year",
      "Store compliance updates (Android)",
      "Email support (72h response)",
    ],
    restrictions: [
      "❌ No push notifications",
      "❌ No native bottom navigation",
      "❌ No iOS build",
      "❌ No white-label",
      "❌ No priority support",
    ],
    label: "Entry-level Android businesses",
  },
  
  /**
   * STANDARD - ₹3,999/year (Most Popular)
   * Positioning: Serious Android businesses
   * Smart Hybrid Native Layer with push notifications
   */
  standard: {
    id: "standard",
    name: "Standard",
    tagline: "Most Popular",
    price: 3999,
    originalPrice: 4999,
    monthlyEquivalent: 333,  // ~₹333/month
    currency: "INR",
    
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
      "Android APK + AAB (release signed)",
      "✅ Play Store ready",
      "WebView + Smart Hybrid Native Layer",
      "Native bottom navigation",
      "Pull-to-refresh",
      "Offline screen",
      "Push notifications (FCM)",
      "Deep linking support",
      "Native loading progress bar",
      "2 rebuilds per year",
      "Store compliance updates",
      "Email support (48h response)",
    ],
    restrictions: [
      "❌ No iOS build",
      "❌ No white-label branding",
      "❌ No WhatsApp priority support",
    ],
    label: "Serious Android businesses",
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
    },
    
    support: {
      type: "priority",
      responseTime: "24 hours",
      whatsappSupport: true,
      fasterBuildQueue: true,     // ✓ Priority build queue
    },
    rebuildsPerYear: 3,
    
    cta: "Get Android + iOS App",
    popular: false,
    featureList: [
      "Android APK + AAB",
      "iOS IPA (App Store ready)",
      "✅ Play Store & App Store ready",
      "WebView + Full Native Hybrid Enhancements",
      "Native bottom navigation",
      "Push notifications (FCM + APNs)",
      "Deep linking",
      "Custom native menu",
      "White-label branding",
      "3 rebuilds per year",
      "Store compliance updates (Android + iOS)",
      "Priority WhatsApp support",
      "Faster build queue",
    ],
    restrictions: [],
    label: "Brands & Agencies",
  },
};

export const PLANS_LIST: PlanDefinition[] = [
  PLANS.starter,
  PLANS.standard,
  PLANS.pro,
];

// ============================================
// EXTRA REBUILD PRICING
// ============================================

export const EXTRA_REBUILD_PRICE = 499; // ₹499 per extra rebuild

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
  return "pro";
}

export function getUpgradeMessage(currentPlan: string, requiredFeature: string): string {
  const plan = getPlan(currentPlan);
  if (plan.id === "starter") {
    return `Upgrade to Standard to unlock ${requiredFeature}`;
  }
  if (plan.id === "standard") {
    return `Upgrade to Pro to unlock ${requiredFeature}`;
  }
  return "";
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
// APP STORE REQUIREMENTS (iOS - Pro Plan)
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
