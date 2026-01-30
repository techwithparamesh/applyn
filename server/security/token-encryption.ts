import crypto from "crypto";

type EncPayloadV1 = {
	v: 1;
	alg: "aes-256-gcm";
	iv: string; // base64
	tag: string; // base64
	data: string; // base64
};

function getKey(): Buffer {
	const raw = (process.env.TOKEN_ENCRYPTION_KEY || "").trim();
	if (!raw) {
		throw new Error(
			"Missing TOKEN_ENCRYPTION_KEY. Set a strong secret (32+ chars) to encrypt OAuth refresh tokens at rest.",
		);
	}

	// Allow base64-encoded 32 bytes or any string (hashed to 32 bytes)
	const b64Maybe = raw.replace(/^base64:/i, "").trim();
	try {
		const buf = Buffer.from(b64Maybe, "base64");
		if (buf.length === 32) return buf;
	} catch {
		// ignore
	}

	return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptToken(plaintext: string): string {
	const text = typeof plaintext === "string" ? plaintext : "";
	if (!text) throw new Error("Cannot encrypt empty token");

	const key = getKey();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

	const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();

	const payload: EncPayloadV1 = {
		v: 1,
		alg: "aes-256-gcm",
		iv: iv.toString("base64"),
		tag: tag.toString("base64"),
		data: enc.toString("base64"),
	};
	return `v1:${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
}

export function decryptToken(tokenEnc: string): string {
	const raw = typeof tokenEnc === "string" ? tokenEnc.trim() : "";
	if (!raw) throw new Error("Missing encrypted token");

	const pref = "v1:";
	if (!raw.startsWith(pref)) {
		throw new Error("Unsupported encrypted token format");
	}

	const b64 = raw.slice(pref.length);
	let payload: EncPayloadV1;
	try {
		payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
	} catch {
		throw new Error("Invalid encrypted token payload");
	}

	if (!payload || payload.v !== 1 || payload.alg !== "aes-256-gcm") {
		throw new Error("Unsupported encrypted token payload version");
	}

	const key = getKey();
	const iv = Buffer.from(payload.iv, "base64");
	const tag = Buffer.from(payload.tag, "base64");
	const data = Buffer.from(payload.data, "base64");

	const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(tag);
	const dec = Buffer.concat([decipher.update(data), decipher.final()]);
	const text = dec.toString("utf8");
	if (!text) throw new Error("Decrypted token is empty");
	return text;
}

