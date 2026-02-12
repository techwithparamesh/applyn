import { execFile } from "child_process";
import fs from "fs";
import path from "path";

export async function validateAndroidArtifact(
  artifactPath: string,
  expectedPackageName: string,
  previousVersionCode?: number,
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    packageName?: string;
    versionCode?: number;
    versionName?: string;
    minSdk?: number;
    targetSdk?: number;
    debuggable?: boolean;
    permissions?: string[];
  };
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const safeFail = (message: string) => ({ valid: false, errors: [message] as string[], warnings: [...warnings] as string[] });

  try {
    const normalizedArtifactPath = typeof artifactPath === "string" ? artifactPath.trim() : "";
    if (!normalizedArtifactPath) return safeFail("Build artifact not found");

    try {
      await fs.promises.access(normalizedArtifactPath, fs.constants.F_OK);
    } catch {
      return safeFail("Build artifact not found");
    }

    const ext = path.extname(normalizedArtifactPath).toLowerCase();
    const isAab = ext === ".aab";
    const isApk = ext === ".apk";

    const timeoutMs = 10_000;

    type ExecResult = { ok: true; stdout: string; stderr: string } | { ok: false; error: unknown; stdout?: string; stderr?: string };

    const runExecFile = async (file: string, args: string[]): Promise<ExecResult> => {
      return new Promise((resolve) => {
        execFile(
          file,
          args,
          {
            timeout: timeoutMs,
            windowsHide: true,
            maxBuffer: 1024 * 1024 * 2,
          },
          (error, stdout, stderr) => {
            if (error) return resolve({ ok: false, error, stdout: stdout?.toString?.() ?? String(stdout ?? ""), stderr: stderr?.toString?.() ?? String(stderr ?? "") });
            return resolve({ ok: true, stdout: stdout?.toString?.() ?? String(stdout ?? ""), stderr: stderr?.toString?.() ?? String(stderr ?? "") });
          },
        );
      });
    };

    const tryBundletoolDump = async (): Promise<string | null> => {
      const res = await runExecFile("bundletool", [
        "dump",
        "manifest",
        "--bundle",
        normalizedArtifactPath,
        "--xpath",
        "/manifest",
      ]);
      if (!res.ok) return null;
      const out = (res.stdout || "").trim();
      return out ? out : null;
    };

    const tryAaptBadging = async (): Promise<string | null> => {
      const res = await runExecFile("aapt", ["dump", "badging", normalizedArtifactPath]);
      if (!res.ok) return null;
      const out = (res.stdout || "").trim();
      return out ? out : null;
    };

    const manifestOrBadging = async (): Promise<{ source: "bundletool" | "aapt"; text: string } | null> => {
      if (isAab) {
        const fromBundletool = await tryBundletoolDump();
        if (fromBundletool) return { source: "bundletool", text: fromBundletool };
        const fromAapt = await tryAaptBadging();
        if (fromAapt) return { source: "aapt", text: fromAapt };
        return null;
      }

      if (isApk) {
        const fromAapt = await tryAaptBadging();
        if (fromAapt) return { source: "aapt", text: fromAapt };
        const fromBundletool = await tryBundletoolDump();
        if (fromBundletool) return { source: "bundletool", text: fromBundletool };
        return null;
      }

      // Unknown extension: best-effort.
      const fromAapt = await tryAaptBadging();
      if (fromAapt) return { source: "aapt", text: fromAapt };
      const fromBundletool = await tryBundletoolDump();
      if (fromBundletool) return { source: "bundletool", text: fromBundletool };
      return null;
    };

    const extracted = await manifestOrBadging();
    if (!extracted) {
      return {
        valid: false,
        errors: ["Unable to inspect build artifact (missing Android tooling: bundletool/aapt)", "Build artifact validation failed"],
        warnings,
      };
    }

    const text = extracted.text;

    const toInt = (v: string | undefined): number | undefined => {
      if (!v) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : undefined;
    };

    const uniq = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean);

    const metadata: {
      packageName?: string;
      versionCode?: number;
      versionName?: string;
      minSdk?: number;
      targetSdk?: number;
      debuggable?: boolean;
      permissions?: string[];
    } = {};

    if (extracted.source === "aapt") {
      const pkgLine = text.match(/^package:.*$/m)?.[0] || "";
      const name = pkgLine.match(/\bname='([^']+)'/)?.[1];
      const vCode = pkgLine.match(/\bversionCode='([^']+)'/)?.[1];
      const vName = pkgLine.match(/\bversionName='([^']+)'/)?.[1];

      metadata.packageName = name || undefined;
      metadata.versionCode = toInt(vCode);
      metadata.versionName = vName || undefined;

      const minSdk = text.match(/\bsdkVersion:'(\d+)'/)?.[1];
      const targetSdk = text.match(/\btargetSdkVersion:'(\d+)'/)?.[1];
      metadata.minSdk = toInt(minSdk);
      metadata.targetSdk = toInt(targetSdk);

      // aapt emits a literal line "application-debuggable" when debuggable=true
      metadata.debuggable = /\bapplication-debuggable\b/.test(text);

      const perms = Array.from(text.matchAll(/uses-permission:\s+name='([^']+)'/g)).map((m) => m[1]);
      metadata.permissions = uniq(perms);
    } else {
      // bundletool: XML-ish output
      const pkg = text.match(/<manifest[^>]*\bpackage\s*=\s*"([^"]+)"/i)?.[1];
      const vCode = text.match(/<manifest[^>]*\bandroid:versionCode\s*=\s*"(\d+)"/i)?.[1];
      const vName = text.match(/<manifest[^>]*\bandroid:versionName\s*=\s*"([^"]+)"/i)?.[1];

      metadata.packageName = pkg || undefined;
      metadata.versionCode = toInt(vCode);
      metadata.versionName = vName || undefined;

      const minSdk = text.match(/<uses-sdk[^>]*\bandroid:minSdkVersion\s*=\s*"(\d+)"/i)?.[1];
      const targetSdk = text.match(/<uses-sdk[^>]*\bandroid:targetSdkVersion\s*=\s*"(\d+)"/i)?.[1];

      metadata.minSdk = toInt(minSdk);
      metadata.targetSdk = toInt(targetSdk);

      const debug = text.match(/<application[^>]*\bandroid:debuggable\s*=\s*"(true|false)"/i)?.[1];
      metadata.debuggable = debug ? debug.toLowerCase() === "true" : undefined;

      const perms = Array.from(text.matchAll(/<uses-permission[^>]*\bandroid:name\s*=\s*"([^"]+)"/gi)).map((m) => m[1]);
      metadata.permissions = uniq(perms);
    }

    // Signing presence (best-effort): validate when tooling is available.
    // - APK: apksigner verify
    // - AAB: jarsigner -verify
    const checkSigning = async () => {
      if (isApk) {
        const res = await runExecFile("apksigner", ["verify", "--verbose", "--print-certs", normalizedArtifactPath]);
        if (res.ok) return;
        // If apksigner missing, don't hard-fail.
        const msg = String((res as any).error?.message || "");
        if (/ENOENT|not recognized/i.test(msg)) {
          warnings.push("Signing check skipped (apksigner not available)");
          return;
        }
        errors.push("Artifact is not signed (APK signature verification failed)");
      } else if (isAab) {
        const res = await runExecFile("jarsigner", ["-verify", "-certs", normalizedArtifactPath]);
        if (res.ok) return;
        const msg = String((res as any).error?.message || "");
        if (/ENOENT|not recognized/i.test(msg)) {
          warnings.push("Signing check skipped (jarsigner not available)");
          return;
        }
        errors.push("Artifact is not signed (AAB signature verification failed)");
      } else {
        warnings.push("Signing check skipped (unknown artifact type)");
      }
    };

    await checkSigning();

    // Validations
    const pkg = (metadata.packageName || "").trim();
    if (!pkg) errors.push("Unable to read packageName from artifact");
    else if (pkg !== expectedPackageName) errors.push("Artifact packageName does not match expected packageName");

    const versionCode = metadata.versionCode;
    if (typeof versionCode !== "number" || !Number.isFinite(versionCode)) {
      errors.push("Unable to read versionCode from artifact");
    } else if (typeof previousVersionCode === "number" && Number.isFinite(previousVersionCode)) {
      if (versionCode <= previousVersionCode) errors.push("versionCode must be incremented compared to previously published version");
    }

    const targetSdk = metadata.targetSdk;
    if (typeof targetSdk !== "number") {
      errors.push("Unable to read targetSdkVersion from artifact");
    } else if (targetSdk < 33) {
      errors.push("targetSdkVersion must be >= 33");
    }

    const minSdk = metadata.minSdk;
    if (typeof minSdk === "number" && minSdk < 21) {
      warnings.push("minSdkVersion is below 21");
    }

    if (metadata.debuggable === true) {
      errors.push("Artifact is debuggable");
    }

    const dangerous = new Set([
      "android.permission.READ_SMS",
      "android.permission.WRITE_SMS",
      "android.permission.READ_CALL_LOG",
      "android.permission.WRITE_CALL_LOG",
      "android.permission.READ_CONTACTS",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.MANAGE_EXTERNAL_STORAGE",
      // Accept raw short forms just in case a tool emits them.
      "READ_SMS",
      "WRITE_SMS",
      "READ_CALL_LOG",
      "WRITE_CALL_LOG",
      "READ_CONTACTS",
      "ACCESS_FINE_LOCATION",
      "MANAGE_EXTERNAL_STORAGE",
    ]);

    const perms = metadata.permissions || [];
    const dangerousFound = perms.filter((p) => dangerous.has(p) || dangerous.has(p.replace(/^android\.permission\./, "")));
    if (dangerousFound.length > 0) {
      warnings.push(`Dangerous permissions detected: ${uniq(dangerousFound).join(", ")}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  } catch {
    return {
      valid: false,
      errors: ["Build artifact validation failed"],
      warnings: [],
    };
  }
}
