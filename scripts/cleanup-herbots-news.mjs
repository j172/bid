// One-off, production data-deletion script: permanently deletes every
// herbots.be-imported news post (`news_posts.source = 'herbots'`). See
// GitHub issue #280 ("移除最新消息自動匯入機制") — the automated herbots.be
// import pipeline (lib/herbotsNews.ts / lib/newsSync.ts / lib/newsImportLog.ts)
// was removed in that issue, and this script is the follow-up one-off
// cleanup of the articles it left behind. Much lower risk than
// scripts/cleanup-closed-listings.mjs (issue #279): news_posts has no
// cascading financial records, and nothing else in the schema references a
// news_posts row via a foreign key or listing_id-style column (broadcast_id
// only ever points *out* at a Resend broadcast id, never the other way).
//
// This is NOT a repeatable admin feature and must never be wired into a
// button, cron, or CI job — same "an agent may prepare and test this
// script, but only a human may run --confirm against production, after
// taking a verified backup and reviewing the --dry-run output" rule as
// cleanup-closed-listings.mjs.
//
// This script deliberately does NOT drop the `news_import_log` table (also
// part of issue #280's cleanup) — that's a one-line schema change
// (`DROP TABLE IF EXISTS news_import_log;`) with no data-loss ambiguity to
// weigh, unlike this script's row-count-dependent DELETE, so it doesn't need
// a dry-run/--confirm harness. Run it by hand, separately, after this
// script (order doesn't actually matter, but doing the data cleanup first
// keeps the two steps independently reviewable). It is intentionally not run
// automatically by lib/db.ts's ensureSchema() either — this project has no
// migration framework/history, and dropping a table on every boot is a
// destructive operation this codebase reserves for hand-run commands.
//
// This script also does NOT delete the physical image files under
// uploads/news/ that herbots-imported rows may have (news_posts.image_file_name)
// — same "DB rows only, orphaned upload files left in place" scope as
// cleanup-closed-listings.mjs leaves listing_photos' files untouched. A
// leftover unreferenced file under uploads/news/ is a harmless, low-volume
// side effect, not tracked here.
//
// Usage:
//   node scripts/cleanup-herbots-news.mjs               # dry run (default) — reports counts only, deletes nothing
//   node scripts/cleanup-herbots-news.mjs --dry-run      # same, explicit
//   node scripts/cleanup-herbots-news.mjs --confirm      # ACTUALLY DELETES. Irreversible.
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

// Read-only: counts what --confirm would delete, without deleting anything.
// Safe to call against production at any time.
export async function planCleanup(conn) {
  const [rows] = await conn.query("SELECT COUNT(*) AS cnt FROM news_posts WHERE source = 'herbots'");
  return { news_posts: Number(rows[0].cnt) };
}

// Destructive: deletes every herbots-sourced news_posts row. No cascade
// tables (see header comment above), so this is a single statement — still
// wrapped for symmetry with cleanup-closed-listings.mjs's transaction
// pattern and so a future cascade addition has somewhere to slot in.
export async function executeCleanup(conn) {
  const counts = {};
  await conn.beginTransaction();
  try {
    const [result] = await conn.query("DELETE FROM news_posts WHERE source = 'herbots'");
    counts.news_posts = result.affectedRows;
    await conn.commit();
    return counts;
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

function formatSummary(counts, { dryRun }) {
  const verb = dryRun ? "將被刪除" : "已刪除";
  const lines = [`\n=== herbots.be 匯入新聞清理摘要${dryRun ? "（dry run，尚未刪除任何資料）" : "（已實際刪除）"} ===`];
  lines.push(`  news_posts (source='herbots')  ${String(counts.news_posts).padStart(8)} 筆 ${verb}`);
  lines.push("=".repeat(50));
  return lines.join("\n");
}

function printIrreversibleWarning() {
  const bar = "!".repeat(70);
  console.warn(bar);
  console.warn("!! 危險操作：即將永久刪除所有 herbots.be 自動匯入的最新消息");
  console.warn("!! （news_posts.source = 'herbots'）。手動撰寫的公告不受影響。");
  console.warn("!! 此操作不可逆。");
  console.warn("!! 執行前請確認：(1) 已完成完整資料庫備份並驗證可還原、");
  console.warn("!!               (2) 已先用 --dry-run 檢視過筆數並確認合理。");
  console.warn("!! 別忘了另外手動執行 `DROP TABLE IF EXISTS news_import_log;`");
  console.warn("!! （issue #280 的另一項一次性清理，本腳本不處理）。");
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
      if (counts.news_posts === 0) {
        console.log("\n目前沒有 source='herbots' 的最新消息，無需執行。");
      } else {
        console.log("\n確認上方筆數合理，且已完成備份後，再由人工執行：");
        console.log("  node scripts/cleanup-herbots-news.mjs --confirm");
      }
    } else {
      printIrreversibleWarning();
      const counts = await executeCleanup(conn);
      console.log(formatSummary(counts, { dryRun: false }));
      console.log(
        "\n完成。請檢查前台 /news、首頁輪播與後台「最新訊息管理」頁面顯示正常，" +
          "並記得另外手動執行 DROP TABLE IF EXISTS news_import_log;",
      );
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

// Guarded so importing this module's pure/query-building exports
// (planCleanup, executeCleanup) from a test file doesn't also connect to a
// database as a side effect of the import.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
