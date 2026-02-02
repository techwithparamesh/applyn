import "dotenv/config";

import { sql } from "drizzle-orm";
import { getMysqlDb } from "../server/db-mysql";
import { payments } from "../shared/db.mysql";

/**
 * One-time migration helper:
 * - Adds amount_paise column via drizzle migration/push (schema already updated)
 * - Backfills existing rows where amount_paise is NULL using amount_inr * 100
 *
 * Usage:
 *   tsx script/migrate-payments-amount-paise.ts --apply
 *   tsx script/migrate-payments-amount-paise.ts (dry-run)
 */

function isApply() {
  return process.argv.includes("--apply");
}

async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
    throw new Error("DATABASE_URL must be a mysql:// URL");
  }

  const apply = isApply();
  const db = getMysqlDb();

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(payments)
    .where(sql`${payments.amountPaise} is null`);

  console.log(`[payments] rows needing backfill: ${Number(count || 0)}`);

  if (!apply) {
    console.log("[payments] dry-run: re-run with --apply to backfill");
    return;
  }

  await db.execute(sql`
    update ${payments}
    set ${payments.amountPaise} = ${payments.amountInr} * 100
    where ${payments.amountPaise} is null
  `);

  console.log("[payments] backfill complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
