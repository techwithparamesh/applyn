import fs from "fs";
import path from "path";
import { google } from "googleapis";
import type { App } from "@shared/schema";
import type { IStorage } from "../storage";

export interface PlayCredentials {
	type: "central" | "user";
	serviceAccountJson?: object;
	oauthRefreshToken?: string;
}

export type PlayTrack = "internal" | "alpha" | "beta" | "production";

export type PublishResult = {
	packageName: string;
	track: PlayTrack;
	versionCode: number;
	testingUrl?: string;
	committedAt: string;
};

export type ReleaseStatusResult = {
	packageName: string;
	tracks: Array<{
		track: PlayTrack;
		releases: Array<{
			name?: string;
			status?: string;
			versionCodes: number[];
		}>;
	}>;
};

type ServiceAccount = {
	client_email: string;
	private_key: string;
	project_id?: string;
};

function parseServiceAccountFromEnv(): ServiceAccount {
	const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
	const b64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_B64;

	let jsonText = "";
	if (raw && raw.trim()) jsonText = raw.trim();
	else if (b64 && b64.trim()) jsonText = Buffer.from(b64.trim(), "base64").toString("utf8");

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

function normalizeString(v: unknown) {
	return typeof v === "string" ? v.trim() : "";
}

function toErrorMessage(err: any) {
	if (!err) return "Unknown error";
	const msg = typeof err?.message === "string" ? err.message : String(err);
	const code = err?.code || err?.response?.status;
	const details = err?.response?.data?.error?.message;
	const reason = err?.errors?.[0]?.reason;
	const bits = [msg];
	if (code) bits.push(`code=${code}`);
	if (reason) bits.push(`reason=${reason}`);
	if (details && !msg.includes(details)) bits.push(details);
	return bits.join(" | ");
}

function getArtifactsRoot(): string {
	return process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");
}

function resolveAabPathForApp(app: App, artifactsRoot: string): string | null {
	const root = path.resolve(artifactsRoot);
	const appDir = path.resolve(root, app.id);
	if (!appDir.startsWith(root)) return null;

	// 1) If stored artifactPath points to an APK/AAB, prefer its sibling AAB.
	const artifactPath = normalizeString(app.artifactPath);
	if (artifactPath) {
		const candidateRel = artifactPath.endsWith(".apk")
			? artifactPath.replace(/\.apk$/i, ".aab")
			: artifactPath.endsWith(".aab")
				? artifactPath
				: "";

		if (candidateRel) {
			const abs = path.resolve(root, candidateRel);
			if (abs.startsWith(root) && fs.existsSync(abs)) return abs;
		}
	}

	// 2) Otherwise choose newest *.aab under artifacts/<appId>/
	try {
		if (!fs.existsSync(appDir)) return null;
		const entries = fs.readdirSync(appDir);
		const aabs = entries
			.filter((n) => n.toLowerCase().endsWith(".aab"))
			.map((n) => {
				const abs = path.resolve(appDir, n);
				try {
					const st = fs.statSync(abs);
					return { abs, mtimeMs: st.mtimeMs };
				} catch {
					return null;
				}
			})
			.filter(Boolean) as Array<{ abs: string; mtimeMs: number }>;

		if (!aabs.length) return null;
		aabs.sort((a, b) => b.mtimeMs - a.mtimeMs);
		return aabs[0].abs;
	} catch {
		return null;
	}
}

async function authFromCredentials(credentials: PlayCredentials) {
	if (credentials.type === "central") {
		const serviceAccountJson = credentials.serviceAccountJson || parseServiceAccountFromEnv();
		return new google.auth.GoogleAuth({
			credentials: serviceAccountJson as any,
			scopes: ["https://www.googleapis.com/auth/androidpublisher"],
		});
	}

	const refreshToken = normalizeString(credentials.oauthRefreshToken);
	if (!refreshToken) throw new Error("Missing oauthRefreshToken for user Play credentials");

	const clientId = normalizeString(process.env.GOOGLE_CLIENT_ID);
	const clientSecret = normalizeString(process.env.GOOGLE_CLIENT_SECRET);
	if (!clientId || !clientSecret) {
		throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET for Play OAuth publishing");
	}

	const redirect = normalizeString(process.env.GOOGLE_PLAY_OAUTH_REDIRECT_URL) || undefined;
	const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirect);
	oauth2.setCredentials({ refresh_token: refreshToken });
	return oauth2;
}

async function getAccessTokenFor(credentials: PlayCredentials): Promise<{ accessToken: string; scopes?: string }>{
	const auth = await authFromCredentials(credentials);

	// googleapis allows token acquisition through the auth client.
	const tokenRes = await (auth as any).getAccessToken?.();
	const accessToken = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
	if (!accessToken) throw new Error("Failed to obtain access token");

	try {
		const oauth2 = google.oauth2("v2");
		const tokenInfo = await oauth2.tokeninfo({ access_token: accessToken } as any);
		const scopes = (tokenInfo.data as any)?.scope as string | undefined;
		return { accessToken, scopes };
	} catch {
		return { accessToken };
	}
}

export async function validatePlayConnection(credentials: PlayCredentials): Promise<{ ok: boolean; scopes?: string[] }>{
	const { scopes } = await getAccessTokenFor(credentials);
	const list = normalizeString(scopes).split(/\s+/g).filter(Boolean);
	const ok = list.includes("https://www.googleapis.com/auth/androidpublisher");
	return { ok, scopes: list.length ? list : undefined };
}

async function withEdit<T>(androidpublisher: any, packageName: string, fn: (editId: string) => Promise<T>): Promise<T> {
	const editInsert = await androidpublisher.edits.insert({ packageName, requestBody: {} });
	const editId = (editInsert.data as any)?.id as string | undefined;
	if (!editId) throw new Error("Google Play edit creation failed");

	try {
		return await fn(editId);
	} finally {
		// Best-effort cleanup (avoid leaving open edits)
		try {
			await androidpublisher.edits.delete({ packageName, editId });
		} catch {
			// ignore
		}
	}
}

async function publishBundleToTrack(opts: {
	credentials: PlayCredentials;
	packageName: string;
	aabPath: string;
	track: PlayTrack;
	releaseName?: string;
}): Promise<PublishResult> {
	const packageName = normalizeString(opts.packageName);
	if (!packageName) throw new Error("Missing packageName");
	if (!opts.aabPath) throw new Error("Missing aabPath");
	if (!fs.existsSync(opts.aabPath)) throw new Error("AAB file not found");

	const auth = await authFromCredentials(opts.credentials);
	const androidpublisher = google.androidpublisher({ version: "v3", auth: auth as any });

	return await withEdit(androidpublisher, packageName, async (editId) => {
		const upload = await androidpublisher.edits.bundles.upload({
			packageName,
			editId,
			media: {
				mimeType: "application/octet-stream",
				body: fs.createReadStream(opts.aabPath),
			},
		});

		const versionCodeRaw = (upload.data as any)?.versionCode;
		const versionCode = typeof versionCodeRaw === "number" ? versionCodeRaw : Number(versionCodeRaw);
		if (!Number.isFinite(versionCode) || versionCode <= 0) {
			throw new Error("Bundle upload succeeded but versionCode is missing");
		}

		await androidpublisher.edits.tracks.update({
			packageName,
			editId,
			track: opts.track,
			requestBody: {
				track: opts.track,
				releases: [
					{
						name: opts.releaseName || `Build ${versionCode}`,
						status: "completed",
						versionCodes: [String(versionCode)],
					},
				],
			} as any,
		});

		await androidpublisher.edits.commit({ packageName, editId });

		return {
			packageName,
			track: opts.track,
			versionCode,
			testingUrl: opts.track === "internal" ? `https://play.google.com/apps/testing/${packageName}` : undefined,
			committedAt: new Date().toISOString(),
		};
	});
}

export async function promoteTrack(opts: {
	credentials: PlayCredentials;
	packageName: string;
	fromTrack: PlayTrack;
	toTrack: PlayTrack;
}): Promise<{ ok: true; packageName: string; fromTrack: PlayTrack; toTrack: PlayTrack; versionCodes: number[]; committedAt: string }>{
	const packageName = normalizeString(opts.packageName);
	if (!packageName) throw new Error("Missing packageName");
	if (opts.fromTrack === opts.toTrack) throw new Error("fromTrack and toTrack must differ");

	const auth = await authFromCredentials(opts.credentials);
	const androidpublisher = google.androidpublisher({ version: "v3", auth: auth as any });

	return await withEdit(androidpublisher, packageName, async (editId) => {
		const from = await androidpublisher.edits.tracks.get({ packageName, editId, track: opts.fromTrack });
		const releases = ((from.data as any)?.releases || []) as any[];
		const versionCodes = Array.from(
			new Set(
				releases
					.flatMap((r) => (Array.isArray(r?.versionCodes) ? r.versionCodes : []))
					.map((v) => Number(v))
					.filter((n) => Number.isFinite(n) && n > 0),
			),
		).sort((a, b) => b - a);

		if (!versionCodes.length) {
			throw new Error(`No versionCodes found on source track (${opts.fromTrack})`);
		}

		await androidpublisher.edits.tracks.update({
			packageName,
			editId,
			track: opts.toTrack,
			requestBody: {
				track: opts.toTrack,
				releases: [
					{
						name: `Promoted from ${opts.fromTrack}`,
						status: "completed",
						versionCodes: versionCodes.map(String),
					},
				],
			} as any,
		});

		await androidpublisher.edits.commit({ packageName, editId });

		return {
			ok: true,
			packageName,
			fromTrack: opts.fromTrack,
			toTrack: opts.toTrack,
			versionCodes,
			committedAt: new Date().toISOString(),
		};
	});
}

export async function checkReleaseStatus(opts: {
	credentials: PlayCredentials;
	packageName: string;
	tracks?: PlayTrack[];
}): Promise<ReleaseStatusResult> {
	const packageName = normalizeString(opts.packageName);
	if (!packageName) throw new Error("Missing packageName");

	const auth = await authFromCredentials(opts.credentials);
	const androidpublisher = google.androidpublisher({ version: "v3", auth: auth as any });
	const tracks: PlayTrack[] = (opts.tracks && opts.tracks.length ? opts.tracks : ["internal", "production"]) as PlayTrack[];

	return await withEdit(androidpublisher, packageName, async (editId) => {
		const out: ReleaseStatusResult = { packageName, tracks: [] };
		for (const track of tracks) {
			try {
				const resp = await androidpublisher.edits.tracks.get({ packageName, editId, track });
				const releases = ((resp.data as any)?.releases || []) as any[];
				out.tracks.push({
					track,
					releases: releases.map((r) => ({
						name: r?.name,
						status: r?.status,
						versionCodes: Array.isArray(r?.versionCodes)
							? r.versionCodes.map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n) && n > 0)
							: [],
					})),
				});
			} catch (err) {
				out.tracks.push({ track, releases: [{ name: "error", status: toErrorMessage(err), versionCodes: [] }] });
			}
		}
		return out;
	});
}

export class PlayPublisher {
	private artifactsRoot: string;

	constructor(
		private deps: {
			storage: IStorage;
			artifactsRoot?: string;
		},
	) {
		this.artifactsRoot = deps.artifactsRoot ? path.resolve(deps.artifactsRoot) : path.resolve(getArtifactsRoot());
	}

	async publishToInternalTrack(appId: string, credentials: PlayCredentials): Promise<PublishResult> {
		const app = await this.deps.storage.getApp(appId);
		if (!app) throw new Error("App not found");

		const pkg = normalizeString(app.packageName);
		if (!pkg) throw new Error("Missing packageName");
		const aabPath = resolveAabPathForApp(app, this.artifactsRoot);
		if (!aabPath) throw new Error("AAB artifact not found");

		try {
			return await publishBundleToTrack({
				credentials,
				packageName: pkg,
				aabPath,
				track: "internal",
				releaseName: `${app.name} (v${app.versionCode || "?"})`,
			});
		} catch (err: any) {
			throw new Error(toErrorMessage(err));
		}
	}

	async publishToProduction(appId: string, credentials: PlayCredentials): Promise<PublishResult> {
		const app = await this.deps.storage.getApp(appId);
		if (!app) throw new Error("App not found");

		const pkg = normalizeString(app.packageName);
		if (!pkg) throw new Error("Missing packageName");
		const aabPath = resolveAabPathForApp(app, this.artifactsRoot);
		if (!aabPath) throw new Error("AAB artifact not found");

		try {
			return await publishBundleToTrack({
				credentials,
				packageName: pkg,
				aabPath,
				track: "production",
				releaseName: `${app.name} (v${app.versionCode || "?"})`,
			});
		} catch (err: any) {
			throw new Error(toErrorMessage(err));
		}
	}

	async promoteTrack(appId: string, fromTrack: PlayTrack, toTrack: PlayTrack, credentials: PlayCredentials) {
		const app = await this.deps.storage.getApp(appId);
		if (!app) throw new Error("App not found");
		const pkg = normalizeString(app.packageName);
		if (!pkg) throw new Error("Missing packageName");
		try {
			return await promoteTrack({ credentials, packageName: pkg, fromTrack, toTrack });
		} catch (err: any) {
			throw new Error(toErrorMessage(err));
		}
	}

	async checkReleaseStatus(packageName: string, credentials: PlayCredentials) {
		try {
			return await checkReleaseStatus({ credentials, packageName });
		} catch (err: any) {
			throw new Error(toErrorMessage(err));
		}
	}

	async validatePlayConnection(credentials: PlayCredentials) {
		try {
			return await validatePlayConnection(credentials);
		} catch (err: any) {
			throw new Error(toErrorMessage(err));
		}
	}
}

