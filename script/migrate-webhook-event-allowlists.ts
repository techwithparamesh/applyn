import { and, eq } from "drizzle-orm";
import { getMysqlDb } from "../server/db-mysql";
import { mapLegacyToPrefixed } from "../server/events/naming";
import { appWebhooks } from "../shared/db.mysql";

function safeJsonParseArray(raw: unknown): string[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const out = parsed.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => String(x));
    return out;
  } catch {
    return null;
  }
}

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith("--")) return null;
  return v;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function usage(exitCode: number): never {
  // eslint-disable-next-line no-console
  console.log(`\nMigrates webhook allowlists to include prefixed event names (idempotent).\n\nUsage:\n  tsx script/migrate-webhook-event-allowlists.ts [--apply] [--appId <id>] [--webhookId <id>]\n\nDefaults:\n  - Dry-run (no DB writes) unless --apply is provided\n  - Skips webhooks with empty allowlist (events=[] or null)\n\nExamples:\n  # Dry-run all webhooks\n  tsx script/migrate-webhook-event-allowlists.ts\n\n  # Apply changes for a single app\n  tsx script/migrate-webhook-event-allowlists.ts --apply --appId 00000000-0000-0000-0000-000000000000\n\nEnv:\n  DATABASE_URL must be set to mysql://...\n`);
  process.exit(exitCode);
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) usage(0);

  const apply = hasFlag("--apply");
  const appId = argValue("--appId");
  const webhookId = argValue("--webhookId");

  if (hasFlag("--dry-run") && apply) {
    // eslint-disable-next-line no-console
    console.error("Cannot pass both --dry-run and --apply");
    process.exit(2);
  }

  const db = getMysqlDb();

  const conditions: any[] = [];
  if (appId) conditions.push(eq(appWebhooks.appId, appId));
  if (webhookId) conditions.push(eq(appWebhooks.id, webhookId));

  let query: any = db.select().from(appWebhooks);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const hooks: any[] = await query;

  let scanned = 0;
  let skippedNoAllowlist = 0;
  let updated = 0;
  let noops = 0;

  for (const hook of hooks) {
    scanned++;

    const events = safeJsonParseArray(hook?.events);
    if (!events || events.length === 0) {
      skippedNoAllowlist++;
      continue;
    }

    const next = [...events];
    const added: string[] = [];

    for (const e of events) {
      const prefixed = mapLegacyToPrefixed(e);
      if (!prefixed) continue;
      if (next.includes(prefixed)) continue;
      next.push(prefixed);
      added.push(prefixed);
    }

    if (added.length === 0) {
      noops++;
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(
      `${apply ? "APPLY" : "DRY"} webhook=${hook.id} app=${hook.appId} name=${JSON.stringify(hook.name)} +${added.length}`,
    );

    if (apply) {
      await db
        .update(appWebhooks)
        .set({
          events: JSON.stringify(next),
          updatedAt: new Date(),
        } as any)
        .where(and(eq(appWebhooks.appId, String(hook.appId)), eq(appWebhooks.id, String(hook.id))));
      updated++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `\nDone. scanned=${scanned} skippedNoAllowlist=${skippedNoAllowlist} noops=${noops} ${apply ? `updated=${updated}` : "updated=0 (dry-run)"}`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
