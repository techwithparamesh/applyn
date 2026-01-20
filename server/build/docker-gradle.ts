import { spawn } from "child_process";

export async function runDockerGradleBuild(params: {
  image: string;
  projectDir: string;
  gradleTask: string;
  timeoutMs: number;
}): Promise<{ ok: boolean; output: string }>
{
  const { image, projectDir, gradleTask, timeoutMs } = params;

  const args = [
    "run",
    "--rm",
    "--user", "root",  // Run as root to avoid permission issues with mounted volumes
    "-v",
    `${projectDir}:/work`,
    "-w",
    "/work",
    image,
    "bash",
    "-lc",
    `gradle --no-daemon ${gradleTask}`,
  ];

  return await new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";

    const timer = setTimeout(() => {
      output += `\n[timeout] exceeded ${timeoutMs}ms\n`;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      output += `\n[error] ${String(err)}\n`;
      resolve({ ok: false, output });
    });
  });
}
