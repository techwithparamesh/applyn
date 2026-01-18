import os from "os";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
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

function safePackageName(appId: string) {
  const suffix = appId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "app";
  return `com.applyn.${suffix}`;
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function handleOneJob(workerId: string) {
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

  const workDir = path.join(os.tmpdir(), `applyn-build-${job.id}-${randomUUID()}`);
  await ensureDir(workDir);

  let logs = "";
  try {
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
      await storage.updateAppBuild(app.id, {
        status: "failed",
        buildError: "Android build failed",
        buildLogs: logs.slice(-20000),
        lastBuildAt: new Date(),
      });
      await storage.completeBuildJob(job.id, "failed", "Android build failed");
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
  } catch (err: any) {
    const msg = err?.message || String(err);
    await storage.updateAppBuild(app.id, {
      status: "failed",
      buildError: msg,
      buildLogs: logs.slice(-20000),
      lastBuildAt: new Date(),
    });
    await storage.completeBuildJob(job.id, "failed", msg);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const workerId = process.env.WORKER_ID || os.hostname();
  await ensureDir(artifactsRoot());

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // run one job at a time
    await handleOneJob(workerId);
    await new Promise((r) => setTimeout(r, pollIntervalMs()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
