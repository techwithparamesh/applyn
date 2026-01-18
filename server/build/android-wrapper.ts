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

  // Copy template
  await fs.cp(templateDir, projectDir, { recursive: true });

  const replacements = {
    "__PACKAGE_NAME__": config.packageName,
    "__PACKAGE_PATH__": config.packageName.replace(/\./g, path.sep),
    "__APP_NAME__": config.appName,
    "__START_URL__": config.startUrl,
    "__PRIMARY_COLOR__": config.primaryColor,
    "__VERSION_CODE__": String(config.versionCode),
  };

  // Fix placeholder folder name
  const oldPath = path.join(projectDir, "app", "src", "main", "java", "__PACKAGE_PATH__");
  const newPath = path.join(projectDir, "app", "src", "main", "java", replacements["__PACKAGE_PATH__"]);
  await fs.mkdir(newPath, { recursive: true });
  await fs.rename(path.join(oldPath, "MainActivity.kt"), path.join(newPath, "MainActivity.kt"));
  await fs.rm(oldPath, { recursive: true, force: true });

  await replaceInFile(path.join(projectDir, "app", "build.gradle"), replacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "AndroidManifest.xml"), replacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "res", "values", "strings.xml"), replacements);
  await replaceInFile(path.join(projectDir, "app", "src", "main", "res", "values", "colors.xml"), replacements);
  await replaceInFile(path.join(newPath, "MainActivity.kt"), replacements);

  return { projectDir };
}
