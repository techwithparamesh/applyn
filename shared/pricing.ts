/**
 * Applyn Pricing & Plan Configuration
 * 
 * This file contains all pricing plans, feature gates, and build validation rules.
 * ONE-TIME PAYMENT model - no subscriptions.
 */

// ============================================
// PLAN TYPES & DEFINITIONS
// ============================================

export type PlanId = "starter" | "standard" | "pro";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  price: number;
  originalPrice?: number; // For showing "was" price
  currency: "INR";
  
  // Build outputs
  outputs: {
    androidApk: boolean;
    androidAab: boolean;      // Play Store format
    iosIpa: boolean;
    iosAppStore: boolean;     // App Store ready (vs Ad-Hoc)
  };
  
  // Features
  features: {
    playStoreReady: boolean;
    appStoreReady: boolean;
    pushNotifications: boolean;
    whiteLabel: boolean;
    customBranding: boolean;
    customSplash: boolean;
    customColors: boolean;
    customLogo: boolean;
  };
  
  // Support & rebuilds
  support: {
    type: "community" | "email" | "priority";
    responseTime?: string;
    whatsappSupport: boolean;
  };
  rebuilds: {
    count: number;
    windowDays: number;
  };
  
  // Display
  cta: string;
  popular: boolean;
  featureList: string[];
  restrictions: string[];
  label: string; // e.g., "Preview build – Not eligible for Play Store"
}

// ============================================
// PLAN CONFIGURATIONS
// ============================================

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "Preview & Learning",
    price: 499,
    originalPrice: 699,
    currency: "INR",
    
    outputs: {
      androidApk: true,
      androidAab: false,
      iosIpa: false,
      iosAppStore: false,
    },
    
    features: {
      playStoreReady: false,
      appStoreReady: false,
      pushNotifications: false,
      whiteLabel: false,
      customBranding: false,
      customSplash: true, // Basic branded splash
      customColors: false, // Presets only
      customLogo: false,
    },
    
    support: {
      type: "community",
      whatsappSupport: false,
    },
    rebuilds: {
      count: 0,
      windowDays: 0,
    },
    
    cta: "Get Preview Build",
    popular: false,
    featureList: [
      "Android APK (preview build)",
      "WebView app wrapper",
      "Branded splash screen",
      "Preset color themes",
      "Community support",
    ],
    restrictions: [
      "❌ NOT Play Store ready",
      "❌ No AAB format",
      "❌ No iOS build",
      "❌ No rebuilds",
    ],
    label: "Preview build – Not eligible for Play Store submission",
  },
  
  standard: {
    id: "standard",
    name: "Standard",
    tagline: "Android Production",
    price: 1999,
    originalPrice: 2499,
    currency: "INR",
    
    outputs: {
      androidApk: true,
      androidAab: true,
      iosIpa: false,
      iosAppStore: false,
    },
    
    features: {
      playStoreReady: true,
      appStoreReady: false,
      pushNotifications: true,
      whiteLabel: false,
      customBranding: true,
      customSplash: true,
      customColors: true,
      customLogo: true,
    },
    
    support: {
      type: "email",
      responseTime: "48 hours",
      whatsappSupport: false,
    },
    rebuilds: {
      count: 1,
      windowDays: 30,
    },
    
    cta: "Get Play Store Ready App",
    popular: true,
    featureList: [
      "Android APK + AAB (release signed)",
      "✅ Google Play Store ready",
      "Push notifications ready",
      "Custom branded splash",
      "Full color customization",
      "Custom logo upload",
      "Email support (48h response)",
      "1 free rebuild within 30 days",
    ],
    restrictions: [
      "❌ No iOS build",
      "❌ No white-label",
    ],
    label: "Google Play Store–ready Android app",
  },
  
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Android + iOS Store-Ready",
    price: 4999,
    originalPrice: 6999,
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
      pushNotifications: true,
      whiteLabel: true,
      customBranding: true,
      customSplash: true,
      customColors: true,
      customLogo: true,
    },
    
    support: {
      type: "priority",
      responseTime: "24 hours",
      whatsappSupport: true,
    },
    rebuilds: {
      count: 3,
      windowDays: 90,
    },
    
    cta: "Get Full Store-Ready Package",
    popular: false,
    featureList: [
      "Android APK + AAB (Play Store ready)",
      "iOS IPA (App Store ready)",
      "✅ Play Store & App Store ready",
      "Push notifications (FCM + APNs)",
      "White-label branding",
      "Full customization options",
      "Priority WhatsApp support",
      "3 free rebuilds within 90 days",
    ],
    restrictions: [],
    label: "Play Store & App Store–ready apps",
  },
};

export const PLANS_LIST: PlanDefinition[] = [
  PLANS.starter,
  PLANS.standard,
  PLANS.pro,
];

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
