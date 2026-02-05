import "dotenv/config";

import os from "os";
import path from "path";
import fs from "fs/promises";
import { createHmac, randomUUID } from "crypto";
import { pathToFileURL } from "url";
import { and, asc, eq, sql } from "drizzle-orm";
import { storage } from "./storage";
import { generateAndroidWrapperProject } from "./build/android-wrapper";
import { runDockerGradleBuild } from "./build/docker-gradle";
import { triggerIOSBuild } from "./build/github-ios";
import { getPlan, PlanId } from "@shared/pricing";
import { User } from "@shared/schema";
import { sendBuildCompleteEmail } from "./email";
import { getEntitlements } from "./entitlements";
import { getMysqlDb } from "./db-mysql";
import { appWebhooks, webhookDeliveries } from "@shared/db.mysql";

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

function webhookRetryDelayMs(attemptCount: number) {
  // attemptCount is 1-based (1st failure retry)
  if (attemptCount <= 1) return 60_000;
  if (attemptCount === 2) return 5 * 60_000;
  if (attemptCount === 3) return 15 * 60_000;
  if (attemptCount === 4) return 60 * 60_000;
  return 6 * 60 * 60_000;
}

async function processWebhookDeliveryRetries() {
  try {
    if (!process.env.DATABASE_URL?.startsWith("mysql://")) return;
    const db = getMysqlDb();
    const due = await db.transaction(async (tx) => {
      const candidates = await tx
        .select({
          id: webhookDeliveries.id,
          webhookId: webhookDeliveries.webhookId,
          appId: webhookDeliveries.appId,
          eventName: webhookDeliveries.eventName,
          payload: webhookDeliveries.payload,
          attemptCount: webhookDeliveries.attemptCount,
          url: appWebhooks.url,
          secret: appWebhooks.secret,
          enabled: appWebhooks.enabled,
          disabledUntil: appWebhooks.disabledUntil,
          consecutiveFailures: appWebhooks.consecutiveFailures,
        })
        .from(webhookDeliveries)
        .leftJoin(appWebhooks, eq(appWebhooks.id, webhookDeliveries.webhookId))
        .where(
          and(
            sql`${webhookDeliveries.deliveredAt} IS NULL`,
            sql`${webhookDeliveries.nextRetryAt} IS NOT NULL`,
            sql`${webhookDeliveries.nextRetryAt} <= NOW()`,
            sql`${webhookDeliveries.attemptCount} < 10`,
            sql`(${webhookDeliveries.leaseUntil} IS NULL OR ${webhookDeliveries.leaseUntil} < NOW())`,
            // Skip disabled webhooks during their cooldown window.
            sql`(${appWebhooks.disabledUntil} IS NULL OR ${appWebhooks.disabledUntil} <= NOW())`,
          ),
        )
        .orderBy(asc(webhookDeliveries.nextRetryAt))
        .limit(50);

      if (!candidates.length) return [];

      const claimed: any[] = [];

      for (const d of candidates as any[]) {
        const leaseToken = randomUUID();

        const result = await tx
          .update(webhookDeliveries)
          .set({
            leaseUntil: sql`DATE_ADD(NOW(), INTERVAL 30 SECOND)`,
            leaseToken,
          })
          .where(
            and(
              eq(webhookDeliveries.id, String(d.id)),
              sql`(${webhookDeliveries.leaseUntil} IS NULL OR ${webhookDeliveries.leaseUntil} < NOW())`,
            ),
          );

        const affected =
          (result as any)?.rowsAffected ??
          (result as any)?.affectedRows ??
          (result as any)?.[0]?.affectedRows ??
          0;

        if (Number(affected) === 1) {
          claimed.push({ ...d, leaseToken });
        }
      }

      return claimed;
    });

    if (!due.length) return;

    await Promise.allSettled(
      due.map(async (d: any) => {
        // If the webhook becomes disabled between selection/claim and execution, skip without mutating attempts.
        const disabledUntilMs = d?.disabledUntil ? new Date(d.disabledUntil).getTime() : NaN;
        if (Number.isFinite(disabledUntilMs) && disabledUntilMs > Date.now()) {
          await db
            .update(webhookDeliveries)
            .set({ leaseUntil: null, leaseToken: null })
            .where(eq(webhookDeliveries.id, String(d.id)));
          return;
        }

        const enabled = Number(d.enabled || 0) === 1;
        const url = typeof d.url === "string" ? d.url : "";

        if (!enabled || !url) {
          await db
            .update(webhookDeliveries)
            .set({
              attemptCount: 10,
              nextRetryAt: null,
              lastError: "Webhook missing or disabled",
              leaseUntil: null,
              leaseToken: null,
            })
            .where(eq(webhookDeliveries.id, String(d.id)));
          return;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);

        try {
          const payload = d.payload ?? {};

          let normalizedPayload: any = payload;
          if (typeof payload === "string") {
            try {
              normalizedPayload = JSON.parse(payload);
            } catch {
              normalizedPayload = payload;
            }
          }

          const body = JSON.stringify(normalizedPayload);

          const headers: Record<string, string> = {
            "content-type": "application/json",
            "x-app-id": String(d.appId),
            "x-app-event": String(d.eventName || ""),
            "x-app-delivery-id": String((payload as any)?.id || ""),
            "x-app-webhook-delivery-id": String(d.id),
          };

          const secret = typeof d.secret === "string" ? d.secret : "";
          if (secret) {
            headers["x-app-signature"] = createHmac("sha256", secret).update(body).digest("hex");
          }

          const resp = await fetch(String(url), {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });

          const nextAttempt = Number(d.attemptCount || 0) + 1;

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }

          await db
            .update(webhookDeliveries)
            .set({
              attemptCount: nextAttempt,
              lastError: null,
              nextRetryAt: null,
              deliveredAt: new Date(),
              leaseUntil: null,
              leaseToken: null,
            })
            .where(eq(webhookDeliveries.id, String(d.id)));

          // Circuit breaker reset.
          try {
            await db
              .update(appWebhooks)
              .set({
                consecutiveFailures: 0,
                disabledUntil: null,
                updatedAt: new Date(),
              } as any)
              .where(eq(appWebhooks.id, String(d.webhookId)));
          } catch {
            // Best-effort.
          }
        } catch (err: any) {
          const message = err?.name === "AbortError" ? "Timeout" : err?.message || String(err);
          const nextAttempt = Number(d.attemptCount || 0) + 1;
          const nextRetryAt = nextAttempt >= 10 ? null : new Date(Date.now() + webhookRetryDelayMs(nextAttempt));
          await db
            .update(webhookDeliveries)
            .set({
              attemptCount: nextAttempt,
              lastError: String(message).slice(0, 10_000),
              nextRetryAt,
              leaseUntil: null,
              leaseToken: null,
            })
            .where(eq(webhookDeliveries.id, String(d.id)));

          // Circuit breaker increment + possible disable.
          const nextFailures = Number(d?.consecutiveFailures ?? 0) + 1;
          if (nextFailures >= 5) {
            console.warn(
              `[Worker] Disabling webhook ${String(d.webhookId)} for 15 minutes after ${nextFailures} consecutive failures`,
            );
          }
          try {
            await db
              .update(appWebhooks)
              .set({
                consecutiveFailures: sql`COALESCE(consecutive_failures, 0) + 1`,
                disabledUntil: sql`CASE WHEN COALESCE(consecutive_failures, 0) + 1 >= 5 THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE) ELSE disabled_until END`,
                updatedAt: new Date(),
              } as any)
              .where(eq(appWebhooks.id, String(d.webhookId)));
          } catch {
            // Best-effort.
          }
        } finally {
          clearTimeout(timer);
        }
      }),
    );
  } catch (err) {
    console.error("[Worker] Webhook retry loop error:", err);
  }
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

/**
 * Get features allowed for a user based on their plan
 * Used during build to enable/disable native features
 */
function getPlanBasedFeatures(user: User | null, appFeatures: any) {
  // If no user (shouldn't happen), use app's stored features
  const entitlements = getEntitlements(user);
  if (!entitlements.isActive || !entitlements.plan) {
    return appFeatures || {
      bottomNav: false,
      pullToRefresh: true,
      offlineScreen: true,
    };
  }

  const planDef = getPlan(entitlements.plan as PlanId);
  
  // Apply plan-based restrictions:
  // - Starter: No push, no bottom nav, no native progress
  // - Standard: Push + bottom nav + deep linking
  // - Pro: All features
  return {
    bottomNav: planDef.features.bottomNavigation && (appFeatures?.bottomNav ?? false),
    pullToRefresh: planDef.features.pullToRefresh && (appFeatures?.pullToRefresh ?? true),
    offlineScreen: planDef.features.offlineScreen && (appFeatures?.offlineScreen ?? true),
    nativeLoadingProgress: planDef.features.nativeLoadingProgress,
    deepLinking: planDef.features.deepLinking,
    pushNotifications: planDef.features.pushNotifications,
  };
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

  const lockToken = job.lockToken;
  if (!lockToken) {
    console.warn(`[Worker] Claimed job ${job.id} missing lockToken; skipping completion to avoid corruption`);
    return;
  }

  console.log(`[Worker] Claimed job ${job.id} for app ${job.appId}`);

  try {
    const app = await storage.getApp(job.appId);
    if (!app) {
      console.log(`[Worker] App not found for job ${job.id}`);
      await storage.completeBuildJob(job.id, lockToken, "failed", "App not found");
      return;
    }

    // Fetch the app owner to check their plan
    const owner = await storage.getUser(app.ownerId);
    
    console.log(`[Worker] Building app: ${app.name} (${app.id})`);
    console.log(`[Worker] Owner plan: ${owner?.plan || 'none'}`);

    const platform = (app as any).platform || "android";

    // Enforce subscription + plan eligibility before executing any build.
    const entitlements = getEntitlements(owner || null);
    if (entitlements.canBuild !== true) {
      const failureReason = "Subscription inactive or plan not eligible";
      console.warn(`[Worker] Blocking build job ${job.id} for app ${app.id}: ${failureReason}`);

      await storage.updateAppBuild(app.id, {
        status: "failed",
        buildError: failureReason,
        lastBuildAt: new Date(),
      });
      await storage.completeBuildJob(job.id, lockToken, "failed", failureReason);
      return;
    }

    if ((platform === "ios" || platform === "both") && entitlements.canBuildIos !== true) {
      const failureReason = "iOS builds require eligible plan";
      console.warn(`[Worker] Blocking iOS build job ${job.id} for app ${app.id}: ${failureReason}`);

      await storage.updateAppBuild(app.id, {
        status: "failed",
        buildError: failureReason,
        lastBuildAt: new Date(),
      });
      await storage.completeBuildJob(job.id, lockToken, "failed", failureReason);
      return;
    }
    const pkg = app.packageName || safePackageName(app.id);
    const versionCode = (app.versionCode ?? 0) + 1;

    // Get plan-based feature restrictions
    const features = getPlanBasedFeatures(owner || null, (app as any).features);
    
    console.log(`[Worker] Platform: ${platform}, Package: ${pkg}, Version: ${versionCode}`);
    console.log(`[Worker] Features:`, features);

    await storage.updateAppBuild(app.id, {
      status: "processing",
      packageName: pkg,
      versionCode,
      buildError: null,
      buildLogs: null,
    });

    console.log(`[Worker] Updated app status to processing`);

    // Store computed features for build
    (app as any).computedFeatures = features;

    // Route to the appropriate build handler based on platform
    if (platform === "ios") {
      await handleIOSBuild(job, lockToken, app, pkg, versionCode);
      return;
    } else if (platform === "both") {
      // For "both", we need to build Android first, then trigger iOS
      // iOS build is async via GitHub Actions, so we handle Android here
      // and iOS will be triggered separately
      await handleAndroidBuild(job, lockToken, app, pkg, versionCode);
      // Trigger iOS build in background (doesn't block)
      triggerIOSBuildAsync(app, pkg, versionCode);
      return;
    } else {
      // Default: Android
      console.log(`[Worker] Starting Android build...`);
      await handleAndroidBuild(job, lockToken, app, pkg, versionCode);
      return;
    }
  } catch (err: any) {
    console.error(`[Worker] Error processing job ${job.id}:`, err);
    try {
      await storage.completeBuildJob(job.id, lockToken, "failed", err?.message || String(err));
    } catch (e) {
      console.error(`[Worker] Failed to mark job as failed:`, e);
    }
  }
}

// iOS build via GitHub Actions
async function handleIOSBuild(job: any, lockToken: string, app: any, pkg: string, versionCode: number) {
  if (!isIOSBuildConfigured()) {
    await storage.updateAppBuild(app.id, {
      status: "failed",
      buildError: "iOS builds not configured. Please contact support.",
      lastBuildAt: new Date(),
    });
    await storage.completeBuildJob(job.id, lockToken, "failed", "iOS builds not configured");
    return;
  }

  try {
    const result = await triggerIOSBuild({
      appId: app.id,
      appName: app.name,
      bundleId: pkg,
      websiteUrl: app.url,
      primaryColor: app.primaryColor,
      versionCode,
      features: (app as any).features || {
        bottomNav: false,
        pullToRefresh: true,
        offlineScreen: true,
      },
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
      await storage.completeBuildJob(job.id, lockToken, "succeeded", null);
    } else {
      await storage.updateAppBuild(app.id, {
        status: "failed",
        buildError: result.error || "Failed to trigger iOS build",
        lastBuildAt: new Date(),
      });
      await storage.completeBuildJob(job.id, lockToken, "failed", result.error || "iOS build trigger failed");
    }
  } catch (err: any) {
    await storage.updateAppBuild(app.id, {
      status: "failed",
      buildError: err?.message || "iOS build failed",
      lastBuildAt: new Date(),
    });
    await storage.completeBuildJob(job.id, lockToken, "failed", err?.message || "iOS build failed");
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
      primaryColor: app.primaryColor,
      versionCode,
      features: (app as any).features || {
        bottomNav: false,
        pullToRefresh: true,
        offlineScreen: true,
      },
    });
    console.log(`[iOS] Triggered build for app ${app.id}`);
  } catch (err) {
    console.error(`[iOS] Failed to trigger build for app ${app.id}:`, err);
  }
}

// Android build handler (extracted from original handleOneJob)
async function handleAndroidBuild(job: any, lockToken: string, app: any, pkg: string, versionCode: number) {
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

      await storage.completeBuildJob(job.id, lockToken, "succeeded", null);
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
        // Use computed features (plan-restricted)
        features: (app as any).computedFeatures || {
          bottomNav: false,
          pullToRefresh: true,
          offlineScreen: true,
        },
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
        await storage.requeueBuildJob(job.id, lockToken);
        console.log(`[Worker] Requeued job ${job.id} for retry (attempt ${job.attempts} of ${maxBuildAttempts()})`);
        return;
      }

      // Max attempts reached - mark as failed permanently
      await storage.completeBuildJob(job.id, lockToken, "failed", msg);
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

  await storage.completeBuildJob(job.id, lockToken, "succeeded", null);

    // Send build success email notification
    const owner = await storage.getUser(app.ownerId);
    if (owner) {
      const dashboardUrl = `${process.env.APP_URL || 'https://applyn.co.in'}/dashboard`;
      sendBuildCompleteEmail(owner.username, app.name, "success", dashboardUrl).catch(err =>
        console.error("[Worker] Failed to send build success email:", err)
      );
    }

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
      await storage.requeueBuildJob(job.id, lockToken);
      console.log(`[Worker] Requeued job ${job.id} for retry (attempt ${job.attempts} of ${maxBuildAttempts()})`);
      return;
    }

    // Max attempts reached - mark as failed permanently
    await storage.completeBuildJob(job.id, lockToken, "failed", msg);
    await storage.updateAppBuild(app.id, {
      status: "failed",
      buildError: msg,
      buildLogs: logs.slice(-20000),
      lastBuildAt: new Date(),
    });

    // Send build failure email notification
    const owner = await storage.getUser(app.ownerId);
    if (owner) {
      const dashboardUrl = `${process.env.APP_URL || 'https://applyn.co.in'}/apps/${app.id}/edit`;
      sendBuildCompleteEmail(owner.username, app.name, "failed", dashboardUrl, msg).catch(err =>
        console.error("[Worker] Failed to send build failure email:", err)
      );
    }
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
  let lastWebhookRetryAt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    pollCount++;
    if (pollCount % 150 === 1) {  // Log every 5 minutes (150 * 2 seconds)
      console.log(`[Worker] Worker alive, poll #${pollCount}`);
    }

    if (Date.now() - lastWebhookRetryAt >= 60_000) {
      lastWebhookRetryAt = Date.now();
      await processWebhookDeliveryRetries();
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
