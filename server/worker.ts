import "dotenv/config";

import os from "os";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { pathToFileURL } from "url";
import { storage } from "./storage";
import { generateAndroidWrapperProject } from "./build/android-wrapper";
import { runDockerGradleBuild } from "./build/docker-gradle";
import { triggerIOSBuild } from "./build/github-ios";

function artifactsRoot() {
  return process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");
}

function builderImage() {
  return process.env.ANDROID_BUILDER_IMAGE || "applyn-android-builder:latest";
}

function isIOSBuildConfigured() {
  return !!(process.env.GITHUB_OWNER && process.env.GITHUB_REPO && process.env.GITHUB_TOKEN);
}

function pollIntervalMs() {
  return Number(process.env.WORKER_POLL_MS || 2000);
}

function buildTimeoutMs() {
  return Number(process.env.BUILD_TIMEOUT_MS || 20 * 60 * 1000);
}

function maxBuildAttempts() {
  return Number(process.env.MAX_BUILD_ATTEMPTS || 3);
}

function retryBackoffMs(attempt: number) {
  const base = Number(process.env.BUILD_RETRY_BACKOFF_MS || 10_000);
  return Math.max(0, base) * Math.max(1, attempt);
}

function artifactRetentionDays() {
  return Number(process.env.ARTIFACT_RETENTION_DAYS || 30);
}

function maxArtifactsPerApp() {
  return Number(process.env.ARTIFACT_MAX_PER_APP || 10);
}

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function mockAndroidBuildEnabled() {
  return isTruthyEnv(process.env.MOCK_ANDROID_BUILD);
}

function mockAndroidFailOnce() {
  return isTruthyEnv(process.env.MOCK_ANDROID_BUILD_FAIL_ONCE);
}

function safePackageName(appId: string) {
  // Java package names cannot start with a number
  // Remove non-alphanumeric, take first 8 chars, ensure starts with letter
  let suffix = appId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "app";
  
  // If it starts with a number, prefix with 'a'
  if (/^[0-9]/.test(suffix)) {
    suffix = "a" + suffix.slice(0, 7);
  }
  
  return `com.applyn.${suffix}`;
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function cleanupArtifactsForApp(appId: string) {
  const dir = path.join(artifactsRoot(), appId);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".apk"));

    const stats = await Promise.all(
      files.map(async (e) => {
        const p = path.join(dir, e.name);
        const st = await fs.stat(p);
        return { path: p, mtimeMs: st.mtimeMs };
      }),
    );

    stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const keepN = Math.max(0, maxArtifactsPerApp());
    const cutoffDays = artifactRetentionDays();
    const cutoffMs = cutoffDays > 0 ? Date.now() - cutoffDays * 24 * 60 * 60 * 1000 : -Infinity;

    const toDelete = stats.filter((s, idx) => {
      if (keepN && idx < keepN) return false;
      return s.mtimeMs < cutoffMs || idx >= keepN;
    });

    await Promise.all(toDelete.map((f) => fs.rm(f.path, { force: true })));
  } catch {
    // Best-effort cleanup.
  }
}

export async function handleOneJob(workerId: string) {
  let job;
  try {
    job = await storage.claimNextBuildJob(workerId);
  } catch (err) {
    console.error(`[Worker] Error claiming job:`, err);
    return;
  }
  
  if (!job) return;

  console.log(`[Worker] Claimed job ${job.id} for app ${job.appId}`);

  try {
    const app = await storage.getApp(job.appId);
    if (!app) {
      console.log(`[Worker] App not found for job ${job.id}`);
      await storage.completeBuildJob(job.id, "failed", "App not found");
      return;
    }

    console.log(`[Worker] Building app: ${app.name} (${app.id})`);

    const platform = (app as any).platform || "android";
    const pkg = app.packageName || safePackageName(app.id);
    const versionCode = (app.versionCode ?? 0) + 1;

    console.log(`[Worker] Platform: ${platform}, Package: ${pkg}, Version: ${versionCode}`);

    await storage.updateAppBuild(app.id, {
      status: "processing",
      packageName: pkg,
      versionCode,
      buildError: null,
      buildLogs: null,
    });

    console.log(`[Worker] Updated app status to processing`);

    // Route to the appropriate build handler based on platform
    if (platform === "ios") {
      await handleIOSBuild(job, app, pkg, versionCode);
      return;
    } else if (platform === "both") {
      // For "both", we need to build Android first, then trigger iOS
      // iOS build is async via GitHub Actions, so we handle Android here
      // and iOS will be triggered separately
      await handleAndroidBuild(job, app, pkg, versionCode);
      // Trigger iOS build in background (doesn't block)
      triggerIOSBuildAsync(app, pkg, versionCode);
      return;
    } else {
      // Default: Android
      console.log(`[Worker] Starting Android build...`);
      await handleAndroidBuild(job, app, pkg, versionCode);
      return;
    }
  } catch (err: any) {
    console.error(`[Worker] Error processing job ${job.id}:`, err);
    try {
      await storage.completeBuildJob(job.id, "failed", err?.message || String(err));
    } catch (e) {
      console.error(`[Worker] Failed to mark job as failed:`, e);
    }
  }
}

// iOS build via GitHub Actions
async function handleIOSBuild(job: any, app: any, pkg: string, versionCode: number) {
  if (!isIOSBuildConfigured()) {
    await storage.updateAppBuild(app.id, {
      status: "failed",
      buildError: "iOS builds not configured. Please contact support.",
      lastBuildAt: new Date(),
    });
    await storage.completeBuildJob(job.id, "failed", "iOS builds not configured");
    return;
  }

  try {
    const result = await triggerIOSBuild({
      appId: app.id,
      appName: app.name,
      bundleId: pkg,
      websiteUrl: app.url,
      versionCode,
    });

    if (result.success) {
      // iOS build is async - mark as processing and store the run ID
      // The callback endpoint will update the status when done
      await storage.updateAppBuild(app.id, {
        status: "processing",
        buildError: null,
        buildLogs: `iOS build triggered. GitHub Actions run ID: ${result.runId || 'pending'}\nBuild will complete in 5-10 minutes.`,
        lastBuildAt: new Date(),
      });
      // Don't complete the job yet - callback will do it
      // But we need to release the job so worker can process other jobs
      await storage.completeBuildJob(job.id, "succeeded", null);
    } else {
      await storage.updateAppBuild(app.id, {
        status: "failed",
        buildError: result.error || "Failed to trigger iOS build",
        lastBuildAt: new Date(),
      });
      await storage.completeBuildJob(job.id, "failed", result.error || "iOS build trigger failed");
    }
  } catch (err: any) {
    await storage.updateAppBuild(app.id, {
      status: "failed",
      buildError: err?.message || "iOS build failed",
      lastBuildAt: new Date(),
    });
    await storage.completeBuildJob(job.id, "failed", err?.message || "iOS build failed");
  }
}

// Fire-and-forget iOS build trigger for "both" platform
async function triggerIOSBuildAsync(app: any, pkg: string, versionCode: number) {
  if (!isIOSBuildConfigured()) return;
  
  try {
    await triggerIOSBuild({
      appId: app.id,
      appName: app.name,
      bundleId: pkg,
      websiteUrl: app.url,
      versionCode,
    });
    console.log(`[iOS] Triggered build for app ${app.id}`);
  } catch (err) {
    console.error(`[iOS] Failed to trigger build for app ${app.id}:`, err);
  }
}

// Android build handler (extracted from original handleOneJob)
async function handleAndroidBuild(job: any, app: any, pkg: string, versionCode: number) {
  let logs = "";
  let workDir: string | null = null;
  try {
    // Optional mock mode: allows end-to-end sanity checks without Docker/Android SDK.
    if (mockAndroidBuildEnabled()) {
      logs = `MOCK_ANDROID_BUILD enabled at ${new Date().toISOString()}\n`;
      if (mockAndroidFailOnce() && job.attempts <= 1) {
        throw new Error("Mock build forced failure (first attempt)");
      }

      const appDir = path.join(artifactsRoot(), app.id);
      await ensureDir(appDir);

      const artifactRel = path.join(app.id, `${job.id}.apk`);
      const apkDest = path.join(artifactsRoot(), artifactRel);

      // Not a real APK, but sufficient to validate the download pipeline.
      const content = Buffer.from(
        `APPLYN-MOCK-APK\nappId=${app.id}\njobId=${job.id}\ncreatedAt=${new Date().toISOString()}\n`,
        "utf8",
      );
      await fs.writeFile(apkDest, content);
      const st = await fs.stat(apkDest);

      await storage.updateAppBuild(app.id, {
        status: "live",
        artifactPath: artifactRel.replace(/\\/g, "/"),
        artifactMime: "application/vnd.android.package-archive",
        artifactSize: st.size,
        buildError: null,
        buildLogs: logs.slice(-20000),
        lastBuildAt: new Date(),
        versionCode,
        packageName: pkg,
      });

      await storage.completeBuildJob(job.id, "succeeded", null);
      await cleanupArtifactsForApp(app.id);
      return;
    }

    workDir = path.join(os.tmpdir(), `applyn-build-${job.id}-${randomUUID()}`);
    await ensureDir(workDir);

    const hasCustomIcon = !!(app as any).iconUrl;

    // Write initial build log so admin can see progress
    logs = `[${new Date().toISOString()}] Starting Android build for ${app.name}\n`;
    logs += `[${new Date().toISOString()}] Package: ${pkg}\n`;
    logs += `[${new Date().toISOString()}] Version Code: ${versionCode}\n`;
    logs += `[${new Date().toISOString()}] Custom Icon: ${hasCustomIcon ? 'Yes (using uploaded logo)' : 'No (using default)'}\n`;
    logs += `[${new Date().toISOString()}] Generating Android project...\n`;
    
    await storage.updateAppBuild(app.id, {
      buildLogs: logs,
      buildError: null,
    });

    const { projectDir } = await generateAndroidWrapperProject(
      {
        appId: app.id,
        appName: app.name,
        startUrl: app.url,
        primaryColor: app.primaryColor,
        packageName: pkg,
        versionCode,
        iconUrl: (app as any).iconUrl || null,
      },
      workDir,
    );

    logs += `[${new Date().toISOString()}] Project generated. Starting Gradle build...\n`;
    logs += `[${new Date().toISOString()}] Docker image: ${builderImage()}\n`;
    logs += `[${new Date().toISOString()}] This may take 5-10 minutes...\n`;
    
    await storage.updateAppBuild(app.id, {
      buildLogs: logs,
    });

    // Build release APK and AAB (bundle)
    const build = await runDockerGradleBuild({
      image: builderImage(),
      projectDir,
      gradleTask: "assembleRelease bundleRelease",
      timeoutMs: buildTimeoutMs(),
    });

    logs += `\n=== Gradle Build Output ===\n`;
    logs += build.output;

    if (!build.ok) {
      const msg = "Android build failed";

      if (job.attempts < maxBuildAttempts()) {
        await storage.updateAppBuild(app.id, {
          status: "processing",
          buildError: "Build failed. Retrying...",
          buildLogs: logs.slice(-20000),
          lastBuildAt: new Date(),
        });

        const delay = retryBackoffMs(job.attempts);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        
        // Requeue the same job instead of creating a new one
        await storage.requeueBuildJob(job.id);
        console.log(`[Worker] Requeued job ${job.id} for retry (attempt ${job.attempts} of ${maxBuildAttempts()})`);
        return;
      }

      // Max attempts reached - mark as failed permanently
      await storage.completeBuildJob(job.id, "failed", msg);
      await storage.updateAppBuild(app.id, {
        status: "failed",
        buildError: msg,
        buildLogs: logs.slice(-20000),
        lastBuildAt: new Date(),
      });

      return;
    }

    // Copy release APK
    const apkSrc = path.join(projectDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
    const appDir = path.join(artifactsRoot(), app.id);
    await ensureDir(appDir);

    const artifactRel = path.join(app.id, `${job.id}.apk`);
    const apkDest = path.join(artifactsRoot(), artifactRel);

    await fs.copyFile(apkSrc, apkDest);
    const st = await fs.stat(apkDest);

    // Also copy AAB (Android App Bundle) for Play Store upload
    const aabSrc = path.join(projectDir, "app", "build", "outputs", "bundle", "release", "app-release.aab");
    const aabRel = path.join(app.id, `${job.id}.aab`);
    const aabDest = path.join(artifactsRoot(), aabRel);
    try {
      await fs.copyFile(aabSrc, aabDest);
    } catch {
      // AAB might not exist in some build configurations, continue without it
    }

    await storage.updateAppBuild(app.id, {
      status: "live",
      artifactPath: artifactRel.replace(/\\/g, "/"),
      artifactMime: "application/vnd.android.package-archive",
      artifactSize: st.size,
      buildError: null,
      buildLogs: logs.slice(-20000),
      lastBuildAt: new Date(),
      versionCode,
      packageName: pkg,
    });

    await storage.completeBuildJob(job.id, "succeeded", null);

    await cleanupArtifactsForApp(app.id);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[Worker] Build error for job ${job.id}:`, msg);

    if (job.attempts < maxBuildAttempts()) {
      await storage.updateAppBuild(app.id, {
        status: "processing",
        buildError: "Build failed. Retrying...",
        buildLogs: logs.slice(-20000),
        lastBuildAt: new Date(),
      });

      const delay = retryBackoffMs(job.attempts);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      
      // Requeue the same job instead of creating a new one
      await storage.requeueBuildJob(job.id);
      console.log(`[Worker] Requeued job ${job.id} for retry (attempt ${job.attempts} of ${maxBuildAttempts()})`);
      return;
    }

    // Max attempts reached - mark as failed permanently
    await storage.completeBuildJob(job.id, "failed", msg);
    await storage.updateAppBuild(app.id, {
      status: "failed",
      buildError: msg,
      buildLogs: logs.slice(-20000),
      lastBuildAt: new Date(),
    });
  } finally {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }
}

export async function runWorkerLoop() {
  const workerId = process.env.WORKER_ID || os.hostname();
  console.log(`[Worker] Starting worker with ID: ${workerId}`);
  console.log(`[Worker] Artifacts root: ${artifactsRoot()}`);
  console.log(`[Worker] Docker image: ${builderImage()}`);
  console.log(`[Worker] Poll interval: ${pollIntervalMs()}ms`);
  
  await ensureDir(artifactsRoot());

  let pollCount = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    pollCount++;
    if (pollCount % 150 === 1) {  // Log every 5 minutes (150 * 2 seconds)
      console.log(`[Worker] Worker alive, poll #${pollCount}`);
    }
    // run one job at a time
    await handleOneJob(workerId);
    await new Promise((r) => setTimeout(r, pollIntervalMs()));
  }
}

function isEntrypoint() {
  try {
    return pathToFileURL(process.argv[1]).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  runWorkerLoop().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
