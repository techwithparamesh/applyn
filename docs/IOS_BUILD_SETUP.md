# iOS Build Setup Guide for Applyn

## Overview

This guide helps you configure iOS builds using GitHub Actions. With an **Apple Developer Account ($99/year)**, you get real installable IPA files for devices.

## Prerequisites

1. **GitHub Account** (Free tier works!)
2. **Apple Developer Account** ($99/year) - **Required for real device IPAs**
   - Sign up at: https://developer.apple.com/programs/

---

## Part 1: GitHub Repository Setup

### Step 1: Create Repository

1. Go to https://github.com/new
2. Repository name: `applyn-ios-builder`
3. Make it **Private**
4. Check "Add a README file"
5. Click **Create repository**

### Step 2: Upload iOS Template

Copy your entire `ios-template` folder contents to the repository:

```bash
# Clone your new repo
git clone https://github.com/YOUR_USERNAME/applyn-ios-builder.git
cd applyn-ios-builder

# Copy iOS template (from your Applyn project)
cp -r /path/to/applyn/ios-template/* .

# Create workflow directory
mkdir -p .github/workflows

# Copy the workflow file
cp /path/to/applyn/docs/github-ios-workflow.yml .github/workflows/ios-build.yml

# Push to GitHub
git add .
git commit -m "Initial iOS template setup"
git push
```

### Step 3: Generate Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Configure:
   - **Note:** `applyn-ios-builds`
   - **Expiration:** No expiration
   - **Scopes:** 
     - ✅ `repo` (all)
     - ✅ `workflow`
4. Click **Generate token**
5. **COPY THE TOKEN** (starts with `ghp_`)

---

## Part 2: Apple Developer Setup (REQUIRED for Real Apps)

### Step 1: Export Distribution Certificate

1. Open **Keychain Access** on your Mac
2. Find your "Apple Distribution" certificate
3. Right-click → Export → Save as `.p12` file
4. Set a password for the file
5. **Important:** You need the "Apple Distribution" certificate, NOT "Apple Development"

### Step 2: Get Your Team ID

1. Go to https://developer.apple.com/account
2. Look in the top-right, under your name - you'll see your **Team ID** (10 characters like `A1B2C3D4E5`)
3. Or go to: Membership → Team ID

### Step 3: Create App ID (Bundle Identifier)

1. Go to https://developer.apple.com/account/resources/identifiers
2. Click **+** to create a new identifier
3. Select **App IDs** → Continue
4. Select **App** → Continue
5. Configure:
   - **Description:** Applyn Wildcard (or specific app name)
   - **Bundle ID:** Choose **Wildcard** and enter `com.applyn.*`
   - This allows any app built with `com.applyn.xxxxx` bundle ID
6. Click **Continue** → **Register**

### Step 4: Create Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles
2. Click **+** to create new profile
3. Select **Ad Hoc** (for device distribution without App Store)
4. Select your App ID (the wildcard `com.applyn.*`)
5. Select your distribution certificate
6. Select devices (you can add more later)
7. Name it: `Applyn Ad Hoc`
8. **Download** the `.mobileprovision` file

### Step 5: Convert to Base64 (On Mac)

```bash
# Certificate - creates a single-line base64 string
base64 -i certificate.p12 -o certificate.b64
cat certificate.b64 | tr -d '\n' | pbcopy
# Paste this into APPLE_CERTIFICATE_BASE64 secret

# Provisioning Profile
base64 -i profile.mobileprovision -o profile.b64
cat profile.b64 | tr -d '\n' | pbcopy
# Paste this into APPLE_PROVISIONING_PROFILE_BASE64 secret
```

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.p12")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("profile.mobileprovision")) | Set-Clipboard
```

### Step 6: Add GitHub Secrets

In your `applyn-ios-builder` repo:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add these **Repository secrets**:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `APPLE_CERTIFICATE_BASE64` | Base64 string | Your .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password | The password you set when exporting |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64 string | Your .mobileprovision file |
| `APPLE_TEAM_ID` | `A1B2C3D4E5` | Your 10-character Team ID |
| `IOS_CALLBACK_SECRET` | Random string | Generate: `openssl rand -hex 32` |

---

## Part 3: Configure Your VPS

### Step 1: Edit Environment Variables

```bash
ssh root@your-vps
cd ~/applyn
nano .env
```

Add these lines:

```env
# GitHub iOS Build Configuration
GITHUB_OWNER=your-github-username
GITHUB_REPO=applyn-ios-builder
GITHUB_TOKEN=ghp_your_token_here
IOS_BUILD_CALLBACK_URL=https://your-domain.com/api/ios-build-callback
IOS_CALLBACK_SECRET=same_secret_as_github  # Must match GitHub secret!
```

### Step 2: Restart Services

```bash
pm2 restart all
```

---

## Part 4: Test iOS Build

1. Go to your Applyn dashboard
2. Create a new app
3. Select **iOS** or **Both** platform
4. Complete the creation flow
5. Check GitHub Actions tab in your `applyn-ios-builder` repo
6. You should see a workflow running!
7. Build takes ~5-10 minutes
8. Download the IPA from your dashboard when complete

---

## Troubleshooting

### Build Not Starting
- Check `GITHUB_TOKEN` has `repo` and `workflow` scopes
- Verify `GITHUB_OWNER` and `GITHUB_REPO` are correct
- Check VPS logs: `pm2 logs applyn-server`

### Build Failing at Code Signing
- Verify certificate is "Apple Distribution" not "Apple Development"
- Check provisioning profile matches your Team ID
- Ensure wildcard bundle ID is registered (`com.applyn.*`)
- Profile must be "Ad Hoc" for direct device installation

### Callback Not Working
- Verify `IOS_BUILD_CALLBACK_URL` is accessible from internet
- **Both secrets must match:** `IOS_CALLBACK_SECRET` on VPS and GitHub
- Check server logs: `pm2 logs applyn-server | grep "iOS Callback"`

### "No matching provisioning profile"
- Bundle ID must match your App ID (use wildcard `com.applyn.*`)
- Profile must be associated with the correct certificate
- Profile must include the test devices

---

## Cost Estimation (GitHub Free)

| Minutes Used | macOS Multiplier | Effective Minutes |
|--------------|------------------|-------------------|
| 2,000/month | 10x | 200 macOS minutes |
| 5-10 min/build | - | **~20-40 builds/month** |

**Tip:** Builds are faster on subsequent runs due to caching!

---

## Installing IPA on Devices

### Method 1: Apple Configurator 2 (Mac)
1. Download Apple Configurator 2 from Mac App Store
2. Connect iPhone via USB
3. Drag IPA onto the device

### Method 2: Sideloading Tools
- **AltStore** - https://altstore.io
- **Sideloadly** - https://sideloadly.io

### Method 3: Enterprise Distribution
If you have an Apple Enterprise Account, you can host IPAs for over-the-air installation.

---

## For App Store Distribution

To publish to App Store instead of Ad Hoc:
1. Create an "App Store" provisioning profile instead of "Ad Hoc"
2. Upload the IPA to App Store Connect
3. Or modify the workflow to use `app-store` method in ExportOptions.plist
