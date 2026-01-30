import fs from "fs";
import { google } from "googleapis";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

function parseServiceAccountFromEnv(): ServiceAccount {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_B64;

  let jsonText = "";
  if (raw && raw.trim()) {
    jsonText = raw.trim();
  } else if (b64 && b64.trim()) {
    jsonText = Buffer.from(b64.trim(), "base64").toString("utf8");
  }

  if (!jsonText) {
    throw new Error(
      "Missing Google Play credentials. Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (raw JSON) or GOOGLE_PLAY_SERVICE_ACCOUNT_B64 (base64).",
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/B64 (must be valid JSON)");
  }

  const client_email = String(parsed?.client_email || "").trim();
  const private_key = String(parsed?.private_key || "").trim();
  if (!client_email || !private_key) {
    throw new Error("Google Play service account JSON missing client_email/private_key");
  }

  return {
    client_email,
    private_key,
    project_id: parsed?.project_id ? String(parsed.project_id) : undefined,
  };
}

export type PublishPlayInternalResult = {
  packageName: string;
  track: "internal";
  versionCode: number;
  testingUrl: string;
};

export async function publishAabToPlayInternalTesting(opts: {
  packageName: string;
  aabPath: string;
  releaseName?: string;
}): Promise<PublishPlayInternalResult> {
  const { packageName, aabPath } = opts;
  if (!packageName) throw new Error("Missing packageName");
  if (!aabPath) throw new Error("Missing aabPath");
  if (!fs.existsSync(aabPath)) throw new Error("AAB file not found");

  const credentials = parseServiceAccountFromEnv();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  const androidpublisher = google.androidpublisher({ version: "v3", auth });

  // 1) Create edit
  const editInsert = await androidpublisher.edits.insert({
    packageName,
    requestBody: {},
  });
  const editId = (editInsert.data as any)?.id as string | undefined;
  if (!editId) throw new Error("Google Play edit creation failed");

  // 2) Upload AAB
  const upload = await androidpublisher.edits.bundles.upload({
    packageName,
    editId,
    media: {
      mimeType: "application/octet-stream",
      body: fs.createReadStream(aabPath),
    },
  });

  const versionCodeRaw = (upload.data as any)?.versionCode;
  const versionCode = typeof versionCodeRaw === "number" ? versionCodeRaw : Number(versionCodeRaw);
  if (!Number.isFinite(versionCode) || versionCode <= 0) {
    throw new Error("Bundle upload succeeded but versionCode is missing");
  }

  // 3) Assign to internal testing track
  await androidpublisher.edits.tracks.update({
    packageName,
    editId,
    track: "internal",
    requestBody: {
      track: "internal",
      releases: [
        {
          name: opts.releaseName || `Build ${versionCode}`,
          status: "completed",
          versionCodes: [String(versionCode)],
        },
      ],
    } as any,
  });

  // 4) Commit
  await androidpublisher.edits.commit({
    packageName,
    editId,
  });

  return {
    packageName,
    track: "internal",
    versionCode,
    testingUrl: `https://play.google.com/apps/testing/${packageName}`,
  };
}
