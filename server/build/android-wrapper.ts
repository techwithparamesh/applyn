import path from "path";
import fs from "fs/promises";

export type AndroidWrapperConfig = {
  appId: string;
  appName: string;
  startUrl: string;
  primaryColor: string;
  packageName: string;
  versionCode: number;
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

  const common = {
    "__PACKAGE_NAME__": config.packageName,
    "__PACKAGE_PATH__": config.packageName.replace(/\./g, path.sep),
    "__VERSION_CODE__": String(config.versionCode),
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

  await replaceInFile(path.join(projectDir, "app", "build.gradle"), gradleReplacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "AndroidManifest.xml"), xmlReplacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "res", "values", "strings.xml"), xmlReplacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "res", "values", "colors.xml"), xmlReplacements);
  await replaceInFile(path.join(newPath, "MainActivity.kt"), kotlinReplacements);

  return { projectDir };
}
