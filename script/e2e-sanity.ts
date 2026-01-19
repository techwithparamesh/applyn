import fs from "fs/promises";
import path from "path";

type Json = any;

function baseUrl() {
  return (process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
}

function originHeader() {
  const raw = (process.env.SANITY_ORIGIN || "").trim();
  if (raw) return raw.replace(/\/$/, "");
  try {
    return new URL(baseUrl()).origin;
  } catch {
    return "";
  }
}

function refererHeader() {
  const raw = (process.env.SANITY_REFERER || "").trim();
  if (raw) return raw;
  const origin = originHeader();
  return origin ? `${origin}/` : "";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function parseJsonSafe(res: Response): Promise<Json | null> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractCookie(setCookie: string | null) {
  if (!setCookie) return "";
  // Express-session sets connect.sid; keep only the first cookie pair.
  return setCookie.split(";")[0] || "";
}

async function main() {
  const username = `sanity-${Date.now()}@example.com`;
  const password = "SanityPass-123456";

  let cookie = "";

  async function req(method: string, p: string, body?: any) {
    const url = `${baseUrl()}${p}`;
    const origin = originHeader();
    const referer = refererHeader();
    const res = await fetch(url, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
        ...(referer ? { referer } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie && !cookie) {
      const c = extractCookie(setCookie);
      if (c) cookie = c;
    }

    const json = await parseJsonSafe(res);
    return { res, json };
  }

  // Register (also logs in)
  {
    const { res, json } = await req("POST", "/api/auth/register", {
      name: "Sanity User",
      username,
      password,
    });
    if (!res.ok) throw new Error(`register failed: ${res.status} ${JSON.stringify(json)}`);
  }

  // Create app (buildNow true)
  let appId = "";
  {
    const { res, json } = await req("POST", "/api/apps", {
      name: `Sanity App ${new Date().toISOString()}`,
      url: "https://example.com",
      icon: "🚀",
      primaryColor: "#2563EB",
      platform: "android",
      buildNow: true,
    });
    if (!res.ok) throw new Error(`create app failed: ${res.status} ${JSON.stringify(json)}`);
    appId = json?.id;
    if (!appId) throw new Error("create app returned no id");
  }

  // Poll for status; if failed, trigger retry build.
  const started = Date.now();
  const timeoutMs = Number(process.env.SANITY_TIMEOUT_MS || 120_000);
  let lastStatus = "";

  while (Date.now() - started < timeoutMs) {
    const { res, json } = await req("GET", `/api/apps/${appId}`);
    if (!res.ok) throw new Error(`get app failed: ${res.status} ${JSON.stringify(json)}`);

    const status = json?.status;
    if (status && status !== lastStatus) {
      lastStatus = status;
      process.stdout.write(`status=${status}`);
      if (json?.buildError) process.stdout.write(` buildError=${String(json.buildError).slice(0, 120)}`);
      process.stdout.write("\n");
    }

    if (status === "live") break;

    if (status === "failed") {
      const { res: r2, json: j2 } = await req("POST", `/api/apps/${appId}/build`);
      if (!r2.ok) throw new Error(`retry build failed: ${r2.status} ${JSON.stringify(j2)}`);
    }

    await sleep(1500);
  }

  {
    const { res, json } = await req("GET", `/api/apps/${appId}`);
    if (!res.ok) throw new Error(`final get app failed: ${res.status} ${JSON.stringify(json)}`);
    if (json?.status !== "live") {
      throw new Error(`expected live, got ${json?.status} (timeout ${timeoutMs}ms)`);
    }
  }

  // Download artifact
  {
    const url = `${baseUrl()}/api/apps/${appId}/download`;
    const res = await fetch(url, { headers: cookie ? { cookie } : {} });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`download failed: ${res.status} ${text.slice(0, 200)}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const outDir = path.resolve(process.cwd(), "tmp");
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, `sanity-${appId}.apk`);
    await fs.writeFile(outPath, buf);
    process.stdout.write(`downloaded=${outPath} bytes=${buf.length}\n`);
  }

  process.stdout.write("E2E sanity pass OK\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
