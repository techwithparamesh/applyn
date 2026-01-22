/**
 * iOS Build Wrapper
 * Generates and builds iOS WebView apps from the template
 */

import * as fs from 'fs';
import * as path from 'path';

export interface IOSBuildConfig {
  appName: string;
  packageName: string; // Bundle identifier like com.example.app
  websiteUrl: string;
  primaryColor?: string; // Hex color for app theme
  versionCode?: number;
  onesignalAppId?: string;
  appIconEmoji?: string;
  // Native enhancement feature toggles
  features?: {
    bottomNav?: boolean;
    pullToRefresh?: boolean;
    offlineScreen?: boolean;
  };
}

/**
 * Copies a directory recursively
 */
function copyDirectorySync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Recursively replaces text in all files in a directory
 */
function replaceInDirectory(dir: string, search: string | RegExp, replace: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      replaceInDirectory(fullPath, search, replace);
    } else if (entry.isFile()) {
      // Only process text files
      const textExtensions = ['.swift', '.plist', '.storyboard', '.pbxproj', '.json', '.xml', '.entitlements'];
      const ext = path.extname(entry.name).toLowerCase();
      
      if (textExtensions.includes(ext) || entry.name === 'Podfile') {
        try {
          let content = fs.readFileSync(fullPath, 'utf8');
          if (typeof search === 'string') {
            content = content.split(search).join(replace);
          } else {
            content = content.replace(search, replace);
          }
          fs.writeFileSync(fullPath, content);
        } catch (e) {
          // Skip binary files
        }
      }
    }
  }
}

/**
 * Generates an iOS app from the template
 */
export async function generateIOSProject(
  templatePath: string,
  outputPath: string,
  config: IOSBuildConfig
): Promise<void> {
  console.log(`Generating iOS project for: ${config.appName}`);
  console.log(`  Bundle ID: ${config.packageName}`);
  console.log(`  Website URL: ${config.websiteUrl}`);

  // Ensure output directory exists
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  // Copy template to output
  copyDirectorySync(templatePath, outputPath);

  // Replace placeholders
  const versionCode = config.versionCode || 1;
  const primaryColor = config.primaryColor || '#2563EB';
  const features = {
    pullToRefresh: config.features?.pullToRefresh ?? true,
    offlineScreen: config.features?.offlineScreen ?? true,
    bottomNav: config.features?.bottomNav ?? false,
  };
  
  replaceInDirectory(outputPath, '__APP_NAME__', config.appName);
  replaceInDirectory(outputPath, '__BUNDLE_ID__', config.packageName);
  replaceInDirectory(outputPath, '__WEBSITE_URL__', config.websiteUrl);
  replaceInDirectory(outputPath, '__VERSION_CODE__', versionCode.toString());
  replaceInDirectory(outputPath, '__PRIMARY_COLOR__', primaryColor);
  
  // Feature flags for Swift (true/false as strings)
  replaceInDirectory(outputPath, '__PULL_TO_REFRESH_ENABLED__', String(features.pullToRefresh));
  replaceInDirectory(outputPath, '__OFFLINE_SCREEN_ENABLED__', String(features.offlineScreen));
  replaceInDirectory(outputPath, '__BOTTOM_NAV_ENABLED__', String(features.bottomNav));

  // Handle OneSignal if configured
  if (config.onesignalAppId) {
    replaceInDirectory(outputPath, '__ONESIGNAL_APP_ID__', config.onesignalAppId);
    // Could add Podfile for OneSignal SDK
  }

  // Generate app icon if emoji provided
  if (config.appIconEmoji) {
    await generateAppIcon(outputPath, config.appIconEmoji);
  }

  console.log('iOS project generated successfully!');
}

/**
 * Generates an app icon from an emoji
 * Note: This requires a macOS environment with sips/iconutil or node-canvas
 */
async function generateAppIcon(projectPath: string, emoji: string): Promise<void> {
  const iconsetPath = path.join(projectPath, 'WebViewApp', 'Assets.xcassets', 'AppIcon.appiconset');
  
  // For iOS, we need a 1024x1024 PNG for the App Store
  // In a real implementation, you'd use Canvas or sips to render the emoji
  // For now, we'll create a placeholder script that can be run on macOS
  
  const iconScript = `#!/bin/bash
# Generate app icon from emoji: ${emoji}
# This script should be run on macOS during the build process

ICON_PATH="${iconsetPath}/appicon.png"

# Create a 1024x1024 PNG with the emoji
# Using macOS's built-in tools
/usr/bin/python3 << 'EOF'
import Cocoa
import sys

emoji = "${emoji}"
size = 1024

# Create image
image = Cocoa.NSImage.alloc().initWithSize_((size, size))
image.lockFocus()

# Draw background
Cocoa.NSColor.systemBlueColor().setFill()
Cocoa.NSBezierPath.fillRect_(((0, 0), (size, size)))

# Draw emoji
attrs = {
    Cocoa.NSFontAttributeName: Cocoa.NSFont.systemFontOfSize_(size * 0.7),
}
s = Cocoa.NSAttributedString.alloc().initWithString_attributes_(emoji, attrs)
text_size = s.size()
x = (size - text_size.width) / 2
y = (size - text_size.height) / 2
s.drawAtPoint_((x, y))

image.unlockFocus()

# Save as PNG
tiff_data = image.TIFFRepresentation()
bitmap = Cocoa.NSBitmapImageRep.imageRepWithData_(tiff_data)
png_data = bitmap.representationUsingType_properties_(Cocoa.NSBitmapImageFileTypePNG, None)
png_data.writeToFile_atomically_(sys.argv[1], True)
EOF

echo "App icon generated!"
`;

  const scriptPath = path.join(projectPath, 'generate-icon.sh');
  fs.writeFileSync(scriptPath, iconScript);
  fs.chmodSync(scriptPath, '755');
  
  console.log(`Icon generation script created at: ${scriptPath}`);
}

/**
 * Builds the iOS project (requires macOS with Xcode)
 * Returns the path to the generated IPA file
 */
export async function buildIOSProject(
  projectPath: string,
  outputDir: string
): Promise<string | null> {
  const { execSync } = await import('child_process');
  
  const xcodeProjectPath = path.join(projectPath, 'WebViewApp.xcodeproj');
  
  try {
    // Clean previous builds
    console.log('Cleaning previous build...');
    execSync(`xcodebuild clean -project "${xcodeProjectPath}" -scheme WebViewApp`, {
      cwd: projectPath,
      stdio: 'pipe'
    });

    // Build archive
    const archivePath = path.join(outputDir, 'WebViewApp.xcarchive');
    console.log('Building archive...');
    execSync(`xcodebuild archive \
      -project "${xcodeProjectPath}" \
      -scheme WebViewApp \
      -archivePath "${archivePath}" \
      -configuration Release \
      CODE_SIGN_IDENTITY="-" \
      CODE_SIGNING_REQUIRED=NO \
      CODE_SIGNING_ALLOWED=NO`, {
      cwd: projectPath,
      stdio: 'inherit'
    });

    // Export IPA (unsigned for ad-hoc distribution)
    const exportOptionsPath = path.join(projectPath, 'ExportOptions.plist');
    const exportOptions = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>`;
    fs.writeFileSync(exportOptionsPath, exportOptions);

    console.log('Exporting IPA...');
    execSync(`xcodebuild -exportArchive \
      -archivePath "${archivePath}" \
      -exportPath "${outputDir}" \
      -exportOptionsPlist "${exportOptionsPath}"`, {
      cwd: projectPath,
      stdio: 'inherit'
    });

    const ipaPath = path.join(outputDir, 'WebViewApp.ipa');
    if (fs.existsSync(ipaPath)) {
      console.log(`IPA generated: ${ipaPath}`);
      return ipaPath;
    }

    // If IPA export failed, return the app bundle
    const appPath = path.join(archivePath, 'Products', 'Applications', 'WebViewApp.app');
    if (fs.existsSync(appPath)) {
      console.log(`App bundle generated: ${appPath}`);
      return appPath;
    }

    return null;
  } catch (error) {
    console.error('iOS build failed:', error);
    return null;
  }
}

/**
 * Main entry point for command-line usage
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log('Usage: npx ts-node ios-wrapper.ts <template-path> <output-path> <app-name> <bundle-id> <website-url> [onesignal-id]');
    process.exit(1);
  }

  const [templatePath, outputPath, appName, bundleId, websiteUrl, onesignalId] = args;
  
  generateIOSProject(templatePath, outputPath, {
    appName,
    packageName: bundleId,
    websiteUrl,
    onesignalAppId: onesignalId,
  }).catch(console.error);
}
