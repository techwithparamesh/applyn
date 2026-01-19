import os from "os";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { pathToFileURL } from "url";
import { storage } from "./storage";
import { generateAndroidWrapperProject } from "./build/android-wrapper";
import { runDockerGradleBuild } from "./build/docker-gradle";

function artifactsRoot() {
  return process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");
}

function builderImage() {
  return process.env.ANDROID_BUILDER_IMAGE || "applyn-android-builder:latest";
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
  const suffix = appId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "app";
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
  const job = await storage.claimNextBuildJob(workerId);
  if (!job) return;

  const app = await storage.getApp(job.appId);
  if (!app) {
    await storage.completeBuildJob(job.id, "failed", "App not found");
    return;
  }

  const pkg = app.packageName || safePackageName(app.id);
  const versionCode = (app.versionCode ?? 0) + 1;

  await storage.updateAppBuild(app.id, {
    status: "processing",
    packageName: pkg,
    versionCode,
    buildError: null,
    buildLogs: null,
  });

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

    const { projectDir } = await generateAndroidWrapperProject(
      {
        appId: app.id,
        appName: app.name,
        startUrl: app.url,
        primaryColor: app.primaryColor,
        packageName: pkg,
        versionCode,
      },
      workDir,
    );

    const build = await runDockerGradleBuild({
      image: builderImage(),
      projectDir,
      gradleTask: "assembleDebug",
      timeoutMs: buildTimeoutMs(),
    });

    logs = build.output;

    if (!build.ok) {
      const msg = "Android build failed";
      await storage.completeBuildJob(job.id, "failed", msg);

      if (job.attempts < maxBuildAttempts()) {
        await storage.updateAppBuild(app.id, {
          status: "processing",
          buildError: "Build failed. Retrying...",
          buildLogs: logs.slice(-20000),
          lastBuildAt: new Date(),
        });

        const delay = retryBackoffMs(job.attempts);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        await storage.enqueueBuildJob(app.ownerId, app.id);
        return;
      }

      await storage.updateAppBuild(app.id, {
        status: "failed",
        buildError: msg,
        buildLogs: logs.slice(-20000),
        lastBuildAt: new Date(),
      });

      return;
    }

    const apkSrc = path.join(projectDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
    const appDir = path.join(artifactsRoot(), app.id);
    await ensureDir(appDir);

    const artifactRel = path.join(app.id, `${job.id}.apk`);
    const apkDest = path.join(artifactsRoot(), artifactRel);

    await fs.copyFile(apkSrc, apkDest);
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
  } catch (err: any) {
    const msg = err?.message || String(err);

    await storage.completeBuildJob(job.id, "failed", msg);

    if (job.attempts < maxBuildAttempts()) {
      await storage.updateAppBuild(app.id, {
        status: "processing",
        buildError: "Build failed. Retrying...",
        buildLogs: logs.slice(-20000),
        lastBuildAt: new Date(),
      });

      const delay = retryBackoffMs(job.attempts);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      await storage.enqueueBuildJob(app.ownerId, app.id);
      return;
    }

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
  await ensureDir(artifactsRoot());

  // eslint-disable-next-line no-constant-condition
  while (true) {
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
