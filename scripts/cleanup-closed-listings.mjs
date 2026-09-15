// One-off, production data-deletion script: permanently deletes every
// closed listing (`listings.status = 'closed'`, no date filtering — a full
// wipe) and every row that references it via `listing_id`, inside a single
// transaction. See GitHub issue #279 ("一次性清空所有已結標商品紀錄").
//
// This is NOT a repeatable admin feature and must never be wired into a
// button, cron, or CI job — issue #279 is deliberately labeled
// `ready-for-human`, not `ready-for-agent`: an agent may prepare and test
// this script, but only a human may run it with --confirm against
// production, after taking a verified backup and reviewing the --dry-run
// output. See docs/agents/closed-listings-cleanup-runbook.md for the full
// pre-execution checklist.
//
// Cascade table list (CASCADE_TABLES below) was determined by inspecting the
// complete schema in db/init.sql — the only .sql file in this repository —
// for every column named `listing_id`, and cross-checked with a repo-wide
// grep for `listing_id` / `listingId`. Exactly three tables reference
// listings this way: `bids`, `purchases`, `listing_photos` (matching the
// issue body's own list). No other table has a listing_id or equivalent FK:
// - `homepage_sections` / `pigeon_showcase` link to each other or to a
//   "loft" (also a homepage_sections row), never to `listings`.
// - `listings.loft_id` points the other way (listing -> loft), so it needs
//   no cleanup here; it's dropped along with the listing row itself.
// - relistClosedListing (lib/listings.ts) creates a brand-new, independent
//   listing row when an admin relists a closed auction with no winner — it
//   does not link back to the original listing anywhere in the database, so
//   there is no "relist history" table to cascade either.
// - There is no notifications/winner-log table: lib/notifications.ts only
//   sends email, it never persists a row tied to listing_id.
// If a future migration adds another listing_id-bearing table, this list
// (and its accompanying comment) must be updated before this script is
// trusted again — re-run the same grep as a sanity check:
//   grep -rn "listing_id" --include=*.sql --include=*.ts .
//
// Usage:
//   node scripts/cleanup-closed-listings.mjs               # dry run (default) — reports counts only, deletes nothing
//   node scripts/cleanup-closed-listings.mjs --dry-run      # same, explicit
//   node scripts/cleanup-closed-listings.mjs --confirm      # ACTUALLY DELETES, inside one transaction. Irreversible.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

// Minimal .env loader — see migrate-description-html.mjs for the fuller
// header comment on why this is needed (this script runs standalone via
// `node`, outside Next.js's own env loading).
function loadEnvFile(fileName) {
  const path = join(process.cwd(), fileName);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

// Tables that reference `listings` via a `listing_id` column, deleted in
// this order (children before the `listings` row they point at) — see the
// header comment above for how this list was verified complete. There is no
// DB-level FOREIGN KEY on any of these columns (see db/init.sql), so delete
// order isn't enforced by MySQL, but children-first keeps the transaction's
// intent obvious and matches the issue body's own ordering.
export const CASCADE_TABLES = ["bids", "purchases", "listing_photos"];

const CLOSED_LISTING_IDS_SUBQUERY = "SELECT id FROM listings WHERE status = 'closed'";

// Read-only: counts what --confirm would delete, without deleting anything.
// Safe to call against production at any time.
export async function planCleanup(conn) {
  const counts = {};
  for (const table of CASCADE_TABLES) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM ${table} WHERE listing_id IN (${CLOSED_LISTING_IDS_SUBQUERY})`,
    );
    counts[table] = Number(rows[0].cnt);
  }
  const [listingRows] = await conn.query("SELECT COUNT(*) AS cnt FROM listings WHERE status = 'closed'");
  counts.listings = Number(listingRows[0].cnt);
  return counts;
}

// Destructive: deletes every closed listing and its cascade rows inside one
// transaction. Rolls back (leaving the database untouched) if any statement
// fails partway through, so a failure can never leave half-deleted data.
// `conn` must be a dedicated connection (e.g. from pool.getConnection()),
// not a pool — transactions are per-connection in mysql2.
export async function executeCleanup(conn) {
  const counts = {};
  await conn.beginTransaction();
  try {
    for (const table of CASCADE_TABLES) {
      const [result] = await conn.query(
        `DELETE FROM ${table} WHERE listing_id IN (${CLOSED_LISTING_IDS_SUBQUERY})`,
      );
      counts[table] = result.affectedRows;
    }
    const [listingResult] = await conn.query("DELETE FROM listings WHERE status = 'closed'");
    counts.listings = listingResult.affectedRows;
    await conn.commit();
    return counts;
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

function formatSummary(counts, { dryRun }) {
  const lines = [`\n=== 已結標商品清理摘要${dryRun ? "（dry run，尚未刪除任何資料）" : "（已實際刪除）"} ===`];
  for (const table of [...CASCADE_TABLES, "listings"]) {
    const verb = dryRun ? "將被刪除" : "已刪除";
    lines.push(`  ${table.padEnd(15)} ${String(counts[table]).padStart(8)} 筆 ${verb}`);
  }
  lines.push("=".repeat(50));
  return lines.join("\n");
}

function printIrreversibleWarning() {
  const bar = "!".repeat(70);
  console.warn(bar);
  console.warn("!! 危險操作：即將永久刪除所有已結標（status='closed'）商品，");
  console.warn("!! 以及其關聯的出價（bids）／購買訂單（purchases）／照片（listing_photos）。");
  console.warn("!! 此操作不可逆，且不限時間範圍（全部刪除）。");
  console.warn("!! 執行前請確認：(1) 已完成完整資料庫備份並驗證可還原、");
  console.warn("!!               (2) 已先用 --dry-run 檢視過筆數並確認合理。");
  console.warn("!! 詳見 docs/agents/closed-listings-cleanup-runbook.md。");
  console.warn(bar);
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  // Anything short of an explicit --confirm is treated as a dry run —
  // including no flags at all and an explicit --dry-run. This is
  // deliberately fail-safe: there is no flag combination that deletes data
  // by accident.
  const dryRun = !confirm;

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? {} : undefined,
  });

  const conn = await pool.getConnection();
  try {
    if (dryRun) {
      console.log("[dry run] 試算「若執行 --confirm 會刪除多少筆資料」，不會變更任何資料列。");
      const counts = await planCleanup(conn);
      console.log(formatSummary(counts, { dryRun: true }));
      if (counts.listings === 0) {
        console.log("\n目前沒有 status='closed' 的商品，無需執行。");
      } else {
        console.log("\n確認上方筆數合理，且已完成備份後，再由人工執行：");
        console.log("  node scripts/cleanup-closed-listings.mjs --confirm");
      }
    } else {
      printIrreversibleWarning();
      const counts = await executeCleanup(conn);
      console.log(formatSummary(counts, { dryRun: false }));
      console.log("\n完成。請將以上摘要貼到執行紀錄／runbook 中留存，並檢查後台「已結標結算」與「訂單管理」頁面。");
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

// Guarded so importing this module's pure/query-building exports
// (CASCADE_TABLES, planCleanup, executeCleanup) from a test file doesn't
// also connect to a database as a side effect of the import.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
