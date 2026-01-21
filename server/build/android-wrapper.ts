import path from "path";
import fs from "fs/promises";

// Lazy load sharp to avoid crash if not installed
let sharp: typeof import("sharp") | null = null;
async function getSharp() {
  if (!sharp) {
    try {
      sharp = (await import("sharp")).default;
    } catch {
      console.warn("[Icon] sharp not installed - custom icons disabled. Run: npm install sharp");
      return null;
    }
  }
  return sharp;
}

// Android icon sizes for different densities
const ANDROID_ICON_SIZES = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
];

// Adaptive icon foreground size (with inset for safe zone)
const ADAPTIVE_ICON_SIZE = 108;
const ADAPTIVE_FOREGROUND_INSET = 18; // 18dp padding on each side

export type AndroidWrapperConfig = {
  appId: string;
  appName: string;
  startUrl: string;
  primaryColor: string;
  iconColor?: string | null; // Icon background color (defaults to primaryColor)
  packageName: string;
  versionCode: number;
  iconUrl?: string | null; // Custom icon as base64 data URL or http URL
  onesignalAppId?: string; // Optional OneSignal App ID for push notifications
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeKotlinString(value: string) {
  // For Kotlin string literals inside double quotes.
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, "\\\"")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function sanitizeHexColor(value: string) {
  const v = (value || "").trim();
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v)) return v;
  return "#2563EB";
}

function sanitizeForFileName(input: string) {
  return input.replace(/[^a-z0-9_.-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function replaceInFile(filePath: string, replacements: Record<string, string>) {
  const content = await fs.readFile(filePath, "utf-8");
  let next = content;
  for (const [key, value] of Object.entries(replacements)) {
    next = next.split(key).join(value);
  }
  if (next !== content) await fs.writeFile(filePath, next, "utf-8");
}

async function replaceInFileIfExists(filePath: string, replacements: Record<string, string>) {
  try {
    await replaceInFile(filePath, replacements);
  } catch {
    // File doesn't exist, skip
  }
}

/**
 * Generates Android app icons from a base64 image or URL
 */
async function generateAppIcons(
  projectDir: string, 
  iconUrl: string,
  primaryColor: string
): Promise<void> {
  const sharpLib = await getSharp();
  if (!sharpLib) {
    console.log("[Icon] Skipping custom icon - sharp not available");
    return;
  }

  try {
    // Get image buffer from base64 or URL
    let imageBuffer: Buffer;
    
    if (iconUrl.startsWith("data:")) {
      // Base64 data URL
      const base64Data = iconUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else if (iconUrl.startsWith("http")) {
      // Fetch from URL
      const response = await fetch(iconUrl);
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      console.log("[Icon] Invalid icon URL format, skipping icon generation");
      return;
    }

    const resDir = path.join(projectDir, "app", "src", "main", "res");

    // Generate standard launcher icons for each density
    for (const { folder, size } of ANDROID_ICON_SIZES) {
      const outputDir = path.join(resDir, folder);
      await fs.mkdir(outputDir, { recursive: true });
      
      // ic_launcher.png - square icon with rounded corners
      await sharpLib(imageBuffer)
        .resize(size, size, { fit: "cover" })
        .png()
        .toFile(path.join(outputDir, "ic_launcher.png"));
      
      // ic_launcher_round.png - circular icon
      const roundMask = Buffer.from(
        `<svg width="${size}" height="${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
        </svg>`
      );
      
      await sharpLib(imageBuffer)
        .resize(size, size, { fit: "cover" })
        .composite([{ input: roundMask, blend: "dest-in" }])
        .png()
        .toFile(path.join(outputDir, "ic_launcher_round.png"));
    }

    // Generate adaptive icon foreground (for Android 8+)
    // The foreground needs to be 108dp with the icon centered in the safe zone (72dp)
    const foregroundSize = 432; // 108dp * 4 for xxxhdpi
    const iconSize = 288; // 72dp * 4 (safe zone)
    const offset = (foregroundSize - iconSize) / 2;
    
    const foreground = await sharpLib(imageBuffer)
      .resize(iconSize, iconSize, { fit: "cover" })
      .extend({
        top: offset,
        bottom: offset,
        left: offset,
        right: offset,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Save foreground as PNG for each density
    const densityScales = [
      { folder: "drawable-mdpi", scale: 1 },
      { folder: "drawable-hdpi", scale: 1.5 },
      { folder: "drawable-xhdpi", scale: 2 },
      { folder: "drawable-xxhdpi", scale: 3 },
      { folder: "drawable-xxxhdpi", scale: 4 },
    ];

    for (const { folder, scale } of densityScales) {
      const scaledSize = Math.round(108 * scale);
      const outputDir = path.join(resDir, folder);
      await fs.mkdir(outputDir, { recursive: true });
      
      await sharpLib(foreground)
        .resize(scaledSize, scaledSize)
        .png()
        .toFile(path.join(outputDir, "ic_launcher_foreground.png"));
    }

    // Remove the XML vector foreground since we now have PNG
    try {
      await fs.unlink(path.join(resDir, "drawable", "ic_launcher_foreground.xml"));
    } catch {
      // May not exist
    }

    // Update the adaptive icon XML to use PNG foreground
    const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;
    
    const adaptiveIconDir = path.join(resDir, "mipmap-anydpi-v26");
    await fs.mkdir(adaptiveIconDir, { recursive: true });
    await fs.writeFile(path.join(adaptiveIconDir, "ic_launcher.xml"), adaptiveIconXml);
    await fs.writeFile(path.join(adaptiveIconDir, "ic_launcher_round.xml"), adaptiveIconXml);

    // Add ic_launcher_background color resource
    const colorsPath = path.join(resDir, "values", "colors.xml");
    const colorsContent = await fs.readFile(colorsPath, "utf-8");
    if (!colorsContent.includes("ic_launcher_background")) {
      const newColorsContent = colorsContent.replace(
        "</resources>",
        `    <color name="ic_launcher_background">${primaryColor}</color>\n</resources>`
      );
      await fs.writeFile(colorsPath, newColorsContent);
    }

    console.log("[Icon] Successfully generated app icons from custom logo");
  } catch (error) {
    console.error("[Icon] Failed to generate icons:", error);
    // Don't fail the build, just use default icon
  }
}

export async function generateAndroidWrapperProject(
  config: AndroidWrapperConfig,
  workDir: string,
): Promise<{ projectDir: string }>
{
  const templateDir = path.resolve(process.cwd(), "android-template");
  const projectDir = path.join(workDir, sanitizeForFileName(config.appId));

  // Fail early with a clear error instead of a cryptic fs error.
  try {
    await fs.access(templateDir);
  } catch {
    throw new Error(`android-template not found at ${templateDir}`);
  }

  // Copy template
  await fs.cp(templateDir, projectDir, { recursive: true });

  const onesignalId = config.onesignalAppId || process.env.ONESIGNAL_APP_ID || "";

  const common = {
    "__PACKAGE_NAME__": config.packageName,
    "__PACKAGE_PATH__": config.packageName.replace(/\./g, path.sep),
    "__VERSION_CODE__": String(config.versionCode),
    "__ONESIGNAL_APP_ID__": onesignalId,
  };

  const xmlReplacements = {
    ...common,
    "__APP_NAME__": escapeXml(config.appName),
    "__START_URL__": escapeXml(config.startUrl),
    "__PRIMARY_COLOR__": escapeXml(sanitizeHexColor(config.primaryColor)),
  };

  const kotlinReplacements = {
    ...common,
    "__APP_NAME__": escapeKotlinString(config.appName),
    "__START_URL__": escapeKotlinString(config.startUrl),
    "__PRIMARY_COLOR__": sanitizeHexColor(config.primaryColor),
  };

  const gradleReplacements = {
    ...common,
    "__APP_NAME__": config.appName,
    "__START_URL__": config.startUrl,
    "__PRIMARY_COLOR__": sanitizeHexColor(config.primaryColor),
  };

  // Fix placeholder folder name
  const oldPath = path.join(projectDir, "app", "src", "main", "java", "__PACKAGE_PATH__");
  const newPath = path.join(projectDir, "app", "src", "main", "java", common["__PACKAGE_PATH__"]);
  await fs.mkdir(newPath, { recursive: true });
  await fs.rename(path.join(oldPath, "MainActivity.kt"), path.join(newPath, "MainActivity.kt"));
  await fs.rm(oldPath, { recursive: true, force: true });

  // Replace placeholders in all template files
  await replaceInFile(path.join(projectDir, "app", "build.gradle"), gradleReplacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "AndroidManifest.xml"), xmlReplacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "res", "values", "strings.xml"), xmlReplacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "res", "values", "colors.xml"), xmlReplacements);
  await replaceInFileIfExists(path.join(projectDir, "app", "src", "main", "res", "values", "themes.xml"), xmlReplacements);
  await replaceInFile(path.join(newPath, "MainActivity.kt"), kotlinReplacements);
  await replaceInFileIfExists(path.join(projectDir, "app", "proguard-rules.pro"), common);

  // Generate custom app icons if iconUrl is provided
  if (config.iconUrl) {
    console.log("[Build] Generating custom app icons...");
    const iconBgColor = sanitizeHexColor(config.iconColor || config.primaryColor);
    await generateAppIcons(projectDir, config.iconUrl, iconBgColor);
  }

  return { projectDir };
}
