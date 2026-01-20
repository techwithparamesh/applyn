# iOS Build Setup Guide

## Overview

Unlike Android which can be built in Docker containers on any OS, **iOS apps can only be built on macOS** with Xcode. Apple's licensing prevents running macOS in Docker on non-Apple hardware.

This project supports two methods for iOS builds:

## Method 1: GitHub Actions (Recommended for SaaS)

GitHub provides free macOS runners that can build iOS apps.

### Setup Steps

1. **Push this repository to GitHub**

2. **Create a GitHub Personal Access Token (PAT)**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Create a new token with `repo` and `workflow` permissions
   - Copy the token

3. **Configure Environment Variables**
   Add these to your `.env` file:
   ```env
   GITHUB_OWNER=your-github-username
   GITHUB_REPO=your-repo-name
   GITHUB_TOKEN=ghp_your_token_here
   IOS_BUILD_CALLBACK_URL=https://your-server.com/api/ios-build-callback
   ```

4. **Add Webhook Endpoint** (optional)
   The workflow will POST to your callback URL when complete:
   ```json
   {
     "appId": "app-uuid",
     "status": "success",
     "artifactUrl": "https://github.com/...",
     "runId": "123456789"
   }
   ```

### Usage

```typescript
import { triggerIOSBuild, checkIOSBuildStatus } from './build/github-ios';

// Trigger a build
const result = await triggerIOSBuild({
  appId: 'app-123',
  appName: 'My App',
  bundleId: 'com.example.myapp',
  websiteUrl: 'https://mywebsite.com',
  versionCode: 1,
});

if (result.success) {
  console.log('Build started, run ID:', result.runId);
}

// Check status later
const status = await checkIOSBuildStatus(result.runId!);
console.log(status.status, status.conclusion);
```

### Limitations

- **No Code Signing**: Builds are unsigned (simulator-only or ad-hoc)
- **For App Store**: You need to add your signing certificates to GitHub Secrets
- **Build Time**: ~5-10 minutes per build
- **Free Tier**: GitHub Actions has limited free minutes for private repos

---

## Method 2: Dedicated Mac Build Server

For high-volume or enterprise use, set up a dedicated Mac.

### Requirements

- Mac Mini M1/M2/M3 or Mac Studio
- macOS 13+ (Ventura or newer)
- Xcode 15+
- Node.js 18+

### Setup Steps

1. **Install Xcode**
   ```bash
   xcode-select --install
   ```

2. **Install Xcode CLI and accept license**
   ```bash
   sudo xcodebuild -license accept
   ```

3. **Run the iOS worker**
   ```bash
   cd /path/to/SaaS-Architect
   npm run ios-worker
   ```

### Network Configuration

The Mac needs to be accessible from your main server:
- Same network: Use local IP
- Different network: Set up VPN or SSH tunnel
- Cloud: Use a service like MacStadium

---

## Method 3: Cloud macOS Services

| Service | Pricing | Best For |
|---------|---------|----------|
| [MacStadium](https://macstadium.com) | $99+/mo | Dedicated Mac in cloud |
| [Codemagic](https://codemagic.io) | Pay-per-build | Flutter/React Native |
| [Bitrise](https://bitrise.io) | $90+/mo | CI/CD pipelines |
| [AWS EC2 Mac](https://aws.amazon.com/ec2/instance-types/mac/) | $1.08/hr | Enterprise scale |

---

## Code Signing for App Store

To distribute on the App Store, you need:

1. **Apple Developer Account** ($99/year)
2. **App Store Connect app registration**
3. **Provisioning Profile**
4. **Distribution Certificate**

### Adding to GitHub Actions

Store these as GitHub Secrets:
- `APPLE_CERTIFICATE_BASE64` - Export .p12, base64 encode
- `APPLE_CERTIFICATE_PASSWORD` - .p12 password
- `APPLE_PROVISIONING_PROFILE_BASE64` - Base64 encoded .mobileprovision
- `APPLE_TEAM_ID` - Your Apple Team ID

Then modify `.github/workflows/ios-build.yml` to use them.

---

## Comparison: Android vs iOS Builds

| Aspect | Android | iOS |
|--------|---------|-----|
| Build Environment | Docker (any OS) | macOS only |
| Cost | Free | macOS hardware/service |
| Build Time | 3-5 min | 5-10 min |
| Code Signing | Optional (debug APK) | Required for devices |
| Store Upload | APK/AAB | IPA |

---

## Quick Start Checklist

- [ ] Push repo to GitHub
- [ ] Create GitHub PAT with workflow permissions
- [ ] Add env vars: `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN`
- [ ] Add callback endpoint for build notifications
- [ ] Test with a sample build
- [ ] (Optional) Add Apple code signing for device distribution
