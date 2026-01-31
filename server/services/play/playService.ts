import type { User } from "@shared/schema";
import type { IStorage } from "../../storage";
import { getMysqlPool } from "../../db-mysql";
import { decryptToken } from "../../security/token-encryption";
import { PlayPublisher, type PlayCredentials, type PlayTrack } from "../../publishing/playPublisher";

export type PlayService = {
  playPublisher: PlayPublisher;
  resolvePlayCredentialsForApp: (appItem: any, user: User) => Promise<PlayCredentials>;
  withPlayPublishLock: <T>(appId: string, fn: () => Promise<T>) => Promise<T>;
};

export function createPlayService(opts: { storage: IStorage; artifactsRoot: string }): PlayService {
  const inProcessPublishLocks = new Map<string, number>();

  const withPlayPublishLock = async <T,>(appId: string, fn: () => Promise<T>): Promise<T> => {
    const lockName = `play_publish:${appId}`;
    const timeoutSec = Number(process.env.PUBLISH_LOCK_TIMEOUT_SEC || 10);

    // Prefer MySQL advisory lock when STORAGE=mysql.
    try {
      if (String(process.env.STORAGE || "").toLowerCase() === "mysql") {
        const pool = getMysqlPool();
        const [rows] = await pool.query("SELECT GET_LOCK(?, ?) AS got", [lockName, timeoutSec]);
        const got = Array.isArray(rows) ? (rows as any)[0]?.got : (rows as any)?.got;
        if (Number(got) !== 1) {
          throw Object.assign(new Error("Publish already in progress for this app."), { status: 409 });
        }
        try {
          return await fn();
        } finally {
          try {
            await pool.query("SELECT RELEASE_LOCK(?)", [lockName]);
          } catch {
            // ignore
          }
        }
      }
    } catch (err: any) {
      // If MySQL lock fails unexpectedly, fall back to in-process locking.
      if (err?.status === 409) throw err;
    }

    const now = Date.now();
    const ttlMs = Number(process.env.PUBLISH_LOCK_TTL_MS || 2 * 60 * 1000);
    const existingUntil = inProcessPublishLocks.get(lockName);
    if (existingUntil && existingUntil > now) {
      throw Object.assign(new Error("Publish already in progress for this app."), { status: 409 });
    }

    inProcessPublishLocks.set(lockName, now + ttlMs);
    try {
      return await fn();
    } finally {
      inProcessPublishLocks.delete(lockName);
    }
  };

  const playPublisher = new PlayPublisher({
    storage: opts.storage,
    artifactsRoot: opts.artifactsRoot,
  });

  const resolvePlayCredentialsForApp = async (appItem: any, user: User): Promise<PlayCredentials> => {
    const mode = (appItem as any)?.playPublishingMode === "user" ? "user" : "central";
    if (mode === "central") return { type: "central" };

    const freshUser = await opts.storage.getUser(user.id);
    const enc = typeof (freshUser as any)?.playRefreshTokenEnc === "string" ? String((freshUser as any).playRefreshTokenEnc).trim() : "";
    if (!enc) {
      throw new Error("No Google Play account connected. Connect your Play account via OAuth first.");
    }

    let refreshToken: string;
    try {
      refreshToken = decryptToken(enc);
    } catch (err: any) {
      throw new Error(err?.message || "Failed to decrypt Play refresh token");
    }

    return { type: "user", oauthRefreshToken: refreshToken };
  };

  return {
    playPublisher,
    resolvePlayCredentialsForApp,
    withPlayPublishLock,
  };
}

export type { PlayCredentials, PlayTrack };
