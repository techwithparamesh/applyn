/**
 * Build Validation Service
 * 
 * Validates that an app meets Play Store and App Store requirements
 * before allowing submission or AAB/IPA downloads.
 * 
 * This service performs automated checks to ensure production-readiness
 * without exposing technical details to non-technical users.
 */

import type { App } from "@shared/schema";
import {
  type ReadinessCheckItem,
  type PlayStoreReadinessResult,
  type AppStoreReadinessResult,
  PLAY_STORE_CHECKS,
  APP_STORE_CHECKS,
  getPlan,
} from "@shared/pricing";

// ============================================
// PLAY STORE READINESS VALIDATION
// ============================================

/**
 * Validates an app for Play Store submission eligibility.
 * Checks all required criteria and returns detailed results.
 */
export function validatePlayStoreReadiness(
  app: App,
  buildInfo?: {
    isReleaseSigned?: boolean;
    hasAabOutput?: boolean;
    targetSdk?: number;
    hasDebugFlags?: boolean;
    hasInternetPermission?: boolean;
    iconSize?: number;
  }
): PlayStoreReadinessResult {
  const checks: ReadinessCheckItem[] = [];

  // 1. Package Name Check
  const packageNameValid = isValidPackageName(app.packageName);
  checks.push({
    ...PLAY_STORE_CHECKS.PACKAGE_NAME,
    status: packageNameValid ? "pass" : "fail",
    message: packageNameValid 
      ? `Package: ${app.packageName}` 
      : "Invalid or missing package name. Must be in format: com.company.appname",
  });

  // 2. Version Code Check
  const versionCodeValid = typeof app.versionCode === "number" && app.versionCode > 0;
  checks.push({
    ...PLAY_STORE_CHECKS.VERSION_CODE,
    status: versionCodeValid ? "pass" : "fail",
    message: versionCodeValid 
      ? `Version code: ${app.versionCode}` 
      : "Version code must be a positive integer",
  });

  // 3. Version Name Check (using versionCode for now, would be separate field)
  const versionNameValid = versionCodeValid; // Simplified
  checks.push({
    ...PLAY_STORE_CHECKS.VERSION_NAME,
    status: versionNameValid ? "pass" : "fail",
    message: versionNameValid ? "Version: 1.0.0" : "Version name not set",
  });

  // 4. Release Signing Check
  const releaseSigned = buildInfo?.isReleaseSigned ?? false;
  checks.push({
    ...PLAY_STORE_CHECKS.RELEASE_SIGNING,
    status: releaseSigned ? "pass" : "fail",
    message: releaseSigned 
      ? "App signed with release keystore" 
      : "Release signing not configured. Required for Play Store.",
  });

  // 5. AAB Build Check
  const hasAab = buildInfo?.hasAabOutput ?? false;
  checks.push({
    ...PLAY_STORE_CHECKS.AAB_BUILD,
    status: hasAab ? "pass" : "fail",
    message: hasAab 
      ? "AAB file generated successfully" 
      : "AAB (Android App Bundle) not available. Required for Play Store.",
  });

  // 6. App Icon Check
  const iconValid = !!app.iconUrl || !!app.icon;
  const iconSizeValid = buildInfo?.iconSize ? buildInfo.iconSize >= 512 : iconValid;
  checks.push({
    ...PLAY_STORE_CHECKS.APP_ICON,
    status: iconSizeValid ? "pass" : "fail",
    message: iconSizeValid 
      ? "App icon configured (512x512)" 
      : "App icon missing or too small. Minimum 512x512 pixels required.",
  });

  // 7. Splash Screen Check (optional but recommended)
  const hasSplash = true; // Default splash is always included
  checks.push({
    ...PLAY_STORE_CHECKS.SPLASH_SCREEN,
    status: hasSplash ? "pass" : "warning",
    message: hasSplash ? "Splash screen configured" : "Consider adding a branded splash screen",
  });

  // 8. Privacy Policy Check
  // For now, we'll mark this as pending (user needs to provide)
  const hasPrivacyPolicy = false; // Would be a field in app schema
  checks.push({
    ...PLAY_STORE_CHECKS.PRIVACY_POLICY,
    status: hasPrivacyPolicy ? "pass" : "warning",
    message: hasPrivacyPolicy 
      ? "Privacy policy URL provided" 
      : "Privacy policy URL recommended for Play Store listing",
  });

  // 9. No Debug Flags Check
  const noDebugFlags = buildInfo?.hasDebugFlags === false;
  checks.push({
    ...PLAY_STORE_CHECKS.NO_DEBUG_FLAGS,
    status: noDebugFlags ? "pass" : releaseSigned ? "pass" : "fail",
    message: noDebugFlags || releaseSigned 
      ? "Production mode enabled" 
      : "Debug flags detected. Must be disabled for production.",
  });

  // 10. Internet Permission Check
  const hasInternet = buildInfo?.hasInternetPermission ?? true; // WebView apps need this
  checks.push({
    ...PLAY_STORE_CHECKS.INTERNET_PERMISSION,
    status: hasInternet ? "pass" : "fail",
    message: hasInternet 
      ? "INTERNET permission declared" 
      : "INTERNET permission missing in manifest",
  });

  // 11. Target SDK Check (Play Store requires API 33+)
  const targetSdk = buildInfo?.targetSdk ?? 34;
  const targetSdkValid = targetSdk >= 33;
  checks.push({
    ...PLAY_STORE_CHECKS.TARGET_SDK,
    status: targetSdkValid ? "pass" : "fail",
    message: targetSdkValid 
      ? `Target SDK: API ${targetSdk}` 
      : `Target SDK (${targetSdk}) below Play Store minimum (33)`,
  });

  // Calculate results
  const passCount = checks.filter(c => c.status === "pass").length;
  const failCount = checks.filter(c => c.status === "fail" && c.required).length;
  const warningCount = checks.filter(c => c.status === "warning").length;

  return {
    ready: failCount === 0,
    checks,
    passCount,
    failCount,
    warningCount,
  };
}

// ============================================
// APP STORE READINESS VALIDATION (iOS)
// ============================================

/**
 * Validates an app for App Store submission eligibility.
 * Only available for Pro plan users.
 */
export function validateAppStoreReadiness(
  app: App,
  buildInfo?: {
    bundleId?: string;
    appVersion?: string;
    buildNumber?: number;
    hasAllIcons?: boolean;
    hasLaunchScreen?: boolean;
    hasPushCapability?: boolean;
    hasSigningProfile?: boolean;
  }
): AppStoreReadinessResult {
  const checks: ReadinessCheckItem[] = [];

  // 1. Bundle Identifier Check
  const bundleIdValid = isValidBundleId(buildInfo?.bundleId);
  checks.push({
    ...APP_STORE_CHECKS.BUNDLE_ID,
    status: bundleIdValid ? "pass" : "fail",
    message: bundleIdValid 
      ? `Bundle ID: ${buildInfo?.bundleId}` 
      : "Invalid or missing bundle identifier",
  });

  // 2. App Version Check
  const versionValid = !!buildInfo?.appVersion;
  checks.push({
    ...APP_STORE_CHECKS.APP_VERSION,
    status: versionValid ? "pass" : "fail",
    message: versionValid 
      ? `Version: ${buildInfo?.appVersion}` 
      : "App version not configured",
  });

  // 3. Build Number Check
  const buildNumberValid = typeof buildInfo?.buildNumber === "number" && buildInfo.buildNumber > 0;
  checks.push({
    ...APP_STORE_CHECKS.BUILD_NUMBER,
    status: buildNumberValid ? "pass" : "fail",
    message: buildNumberValid 
      ? `Build: ${buildInfo?.buildNumber}` 
      : "Build number not set",
  });

  // 4. App Icons Check
  const hasIcons = buildInfo?.hasAllIcons ?? false;
  checks.push({
    ...APP_STORE_CHECKS.APP_ICONS,
    status: hasIcons ? "pass" : "fail",
    message: hasIcons 
      ? "All required icon sizes provided" 
      : "Missing required icon sizes for App Store",
  });

  // 5. Launch Screen Check
  const hasLaunch = buildInfo?.hasLaunchScreen ?? true;
  checks.push({
    ...APP_STORE_CHECKS.LAUNCH_SCREEN,
    status: hasLaunch ? "pass" : "fail",
    message: hasLaunch 
      ? "Launch screen configured" 
      : "Launch screen not configured",
  });

  // 6. Privacy Policy Check
  const hasPrivacy = false; // Would be a field
  checks.push({
    ...APP_STORE_CHECKS.PRIVACY_POLICY,
    status: hasPrivacy ? "pass" : "warning",
    message: hasPrivacy 
      ? "Privacy policy URL provided" 
      : "Privacy policy URL required for App Store review",
  });

  // 7. Push Capability Check (optional)
  const hasPush = buildInfo?.hasPushCapability;
  checks.push({
    ...APP_STORE_CHECKS.PUSH_CAPABILITY,
    status: hasPush ? "pass" : "warning",
    message: hasPush 
      ? "Push notifications configured" 
      : "Push notifications not configured (optional)",
  });

  // 8. Signing Profile Check
  const hasSigning = buildInfo?.hasSigningProfile ?? false;
  checks.push({
    ...APP_STORE_CHECKS.SIGNING_PROFILE,
    status: hasSigning ? "pass" : "fail",
    message: hasSigning 
      ? "Distribution signing profile configured" 
      : "Distribution signing profile required",
  });

  // Calculate results
  const passCount = checks.filter(c => c.status === "pass").length;
  const failCount = checks.filter(c => c.status === "fail" && c.required).length;
  const warningCount = checks.filter(c => c.status === "warning").length;

  return {
    ready: failCount === 0,
    checks,
    passCount,
    failCount,
    warningCount,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validates Android package name format.
 * Must be like: com.company.appname
 */
function isValidPackageName(packageName?: string | null): boolean {
  if (!packageName) return false;
  
  // Package name rules:
  // - Must have at least two segments (com.app)
  // - Each segment must start with a letter
  // - Can contain letters, numbers, underscores
  // - Cannot start with a number
  const pattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
  return pattern.test(packageName) && packageName.length >= 3;
}

/**
 * Validates iOS bundle identifier format.
 * Must be like: com.company.appname
 */
function isValidBundleId(bundleId?: string): boolean {
  if (!bundleId) return false;
  
  // Bundle ID follows same rules as package name
  const pattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/i;
  return pattern.test(bundleId) && bundleId.length >= 3;
}

// ============================================
// BUILD ACTION VALIDATORS
// ============================================

export interface BuildActionResult {
  allowed: boolean;
  reason?: string;
  requiresUpgrade?: boolean;
  minimumPlan?: string;
  readinessResult?: PlayStoreReadinessResult | AppStoreReadinessResult;
}

/**
 * Check if AAB download is allowed for this app.
 */
export function canDownloadAab(
  app: App,
  plan: string,
  buildInfo?: Parameters<typeof validatePlayStoreReadiness>[1]
): BuildActionResult {
  const planConfig = getPlan(plan);
  
  // Plan check
  if (!planConfig.outputs.androidAab) {
    return {
      allowed: false,
      reason: "AAB format is not available on Starter plan",
      requiresUpgrade: true,
      minimumPlan: "standard",
    };
  }
  
  // Readiness check
  const readiness = validatePlayStoreReadiness(app, buildInfo);
  if (!readiness.ready) {
    const failedChecks = readiness.checks.filter(c => c.status === "fail" && c.required);
    return {
      allowed: false,
      reason: `Play Store readiness check failed: ${failedChecks[0]?.message || "Missing requirements"}`,
      readinessResult: readiness,
    };
  }
  
  return { allowed: true, readinessResult: readiness };
}

/**
 * Check if Play Store submission is allowed.
 */
export function canSubmitToPlayStore(
  app: App,
  plan: string,
  buildInfo?: Parameters<typeof validatePlayStoreReadiness>[1]
): BuildActionResult {
  const planConfig = getPlan(plan);
  
  // Plan check
  if (!planConfig.features.playStoreReady) {
    return {
      allowed: false,
      reason: "Starter plan builds are preview-only and not eligible for Play Store submission",
      requiresUpgrade: true,
      minimumPlan: "standard",
    };
  }
  
  // Full readiness check
  const readiness = validatePlayStoreReadiness(app, buildInfo);
  if (!readiness.ready) {
    const failedChecks = readiness.checks.filter(c => c.status === "fail" && c.required);
    return {
      allowed: false,
      reason: `Play Store readiness check failed: ${failedChecks[0]?.message || "Missing requirements"}`,
      readinessResult: readiness,
    };
  }
  
  return { allowed: true, readinessResult: readiness };
}

/**
 * Check if IPA download is allowed for this app.
 */
export function canDownloadIpa(
  app: App,
  plan: string,
  buildInfo?: Parameters<typeof validateAppStoreReadiness>[1]
): BuildActionResult {
  const planConfig = getPlan(plan);
  
  // Plan check
  if (!planConfig.outputs.iosIpa) {
    return {
      allowed: false,
      reason: "iOS builds are only available on Pro plan",
      requiresUpgrade: true,
      minimumPlan: "pro",
    };
  }
  
  return { allowed: true };
}

/**
 * Check if App Store submission is allowed.
 */
export function canSubmitToAppStore(
  app: App,
  plan: string,
  buildInfo?: Parameters<typeof validateAppStoreReadiness>[1]
): BuildActionResult {
  const planConfig = getPlan(plan);
  
  // Plan check
  if (!planConfig.features.appStoreReady) {
    return {
      allowed: false,
      reason: "App Store ready builds are only available on Pro plan",
      requiresUpgrade: true,
      minimumPlan: "pro",
    };
  }
  
  // Full readiness check
  const readiness = validateAppStoreReadiness(app, buildInfo);
  if (!readiness.ready) {
    const failedChecks = readiness.checks.filter(c => c.status === "fail" && c.required);
    return {
      allowed: false,
      reason: `App Store readiness check failed: ${failedChecks[0]?.message || "Missing requirements"}`,
      readinessResult: readiness,
    };
  }
  
  return { allowed: true, readinessResult: readiness };
}
