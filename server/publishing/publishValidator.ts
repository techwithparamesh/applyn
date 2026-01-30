import type { App, AppModule } from "@shared/schema";

export type PublishValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function normalizeString(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function findPublishingModule(modules: AppModule[] | null | undefined) {
  return safeArray<AppModule>(modules).find((m) => m?.type === "publishing");
}

function extractStoreAssetsFromModules(app: App): {
  contactEmail?: string;
  privacyPolicyUrl?: string;
  shortDescription?: string;
  fullDescription?: string;
} {
  const mod = findPublishingModule(app.modules);
  const assets = (mod as any)?.config?.storeAssets || {};
  return {
    contactEmail: normalizeString(assets.supportEmail),
    privacyPolicyUrl: normalizeString(assets.privacyPolicyUrl),
    shortDescription: normalizeString(assets.shortDescription),
    fullDescription: normalizeString(assets.fullDescription),
  };
}

function isLikelyEmail(email: string) {
  const e = normalizeString(email);
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isHttpUrl(url: string) {
  const u = normalizeString(url);
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidPackageName(packageName: string) {
  const p = normalizeString(packageName);
  if (!p) return false;
  // Android applicationId rules: segments separated by dots, letters/digits/underscore,
  // each segment starts with a letter.
  return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(p);
}

function containsPlaceholderText(text: string): boolean {
  const t = normalizeString(text).toLowerCase();
  if (!t) return false;
  const patterns: RegExp[] = [
    /lorem ipsum/i,
    /your (app|company|brand) name/i,
    /insert (text|description)/i,
    /replace this/i,
    /sample text/i,
    /dummy content/i,
  ];
  return patterns.some((re) => re.test(t));
}

function extractTextFromScreens(editorScreens: any[] | null | undefined): string {
  const screens = safeArray<any>(editorScreens);
  const chunks: string[] = [];

  const visit = (node: any) => {
    if (!node) return;
    if (typeof node === "string") {
      chunks.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (k === "id" || k === "type" || k === "icon" || k === "image" || k === "src") continue;
        visit(v);
      }
    }
  };

  visit(screens);
  return chunks
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}

export function validateForPublish(app: App, opts?: { requiredTargetSdk?: number }): PublishValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredTargetSdk = opts?.requiredTargetSdk ?? Number(process.env.REQUIRED_TARGET_SDK || 34);

  const storeFromModules = extractStoreAssetsFromModules(app);

  const contactEmail = normalizeString((app as any).contactEmail || storeFromModules.contactEmail);
  const privacyPolicyUrl = normalizeString((app as any).privacyPolicyUrl || storeFromModules.privacyPolicyUrl);
  const shortDescription = normalizeString((app as any).shortDescription || storeFromModules.shortDescription);
  const fullDescription = normalizeString((app as any).fullDescription || storeFromModules.fullDescription);

  const packageName = normalizeString(app.packageName);

  if (!contactEmail) errors.push("Missing contact email (required for Play Console listing/support).");
  else if (!isLikelyEmail(contactEmail)) errors.push("Contact email is invalid.");

  if (!privacyPolicyUrl) errors.push("Missing privacy policy URL (required for Play Console).");
  else if (!isHttpUrl(privacyPolicyUrl)) errors.push("Privacy policy URL must be a valid http(s) URL.");

  // Icon: emoji-only icon is not acceptable for store listing; require a real icon asset.
  if (!normalizeString((app as any).iconUrl)) {
    errors.push("Missing uploaded app icon image. Play listing requires a high-res icon (PNG)." );
  }

  // Splash screen: publishing requires a build, and your Android wrapper includes a launch/splash screen.
  // If you later make splash optional, wire an explicit flag and turn this into a strict check.
  if (app.status !== "live") {
    warnings.push("Splash screen validation requires a release build. Build the app before publishing." );
  }

  if (!packageName) errors.push("Missing package name (Android applicationId).");
  else if (!isValidPackageName(packageName)) errors.push("Invalid package name format (e.g. com.yourcompany.app)." );

  if ((app.versionCode ?? 0) <= 0) errors.push("Missing versionCode. Build at least once to generate a versionCode." );

  const lastPublished = Number((app as any).lastPlayVersionCode || 0);
  const currentVersionCode = Number(app.versionCode || 0);
  if (lastPublished > 0 && currentVersionCode > 0 && currentVersionCode <= lastPublished) {
    errors.push(`versionCode must be incremented (current ${currentVersionCode}, last published ${lastPublished}).`);
  }

  // Target SDK is defined in your Android wrapper; validate the configured constant.
  // If you later store targetSdk per build, replace this with the real value.
  const assumedTargetSdk = Number(process.env.ANDROID_TARGET_SDK || 34);
  if (assumedTargetSdk < requiredTargetSdk) {
    errors.push(`Target SDK must be >= ${requiredTargetSdk} (currently ${assumedTargetSdk}).`);
  }

  if (shortDescription.trim().length < 10) warnings.push("Short description is too short (< 10 chars)." );
  if (fullDescription.trim().length < 50) warnings.push("Full description is too short (< 50 chars)." );

  const combinedText = [app.name, shortDescription, fullDescription, extractTextFromScreens(app.editorScreens)].join("\n");
  if (containsPlaceholderText(combinedText)) {
    errors.push("Placeholder text detected (remove Lorem ipsum / sample copy before publishing)." );
  }

  // Permissions minimization requires manifest introspection; warn until manifest inspection is wired in.
  warnings.push("Permissions minimization check is advisory until manifest inspection is wired in." );

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
