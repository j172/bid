// One-off schema migration: widens pigeon_showcase.category's ENUM to add
// the fourth 'world_famous' (世界名鴿) value, alongside the existing
// 'award'/'imported'/'representative'. See GitHub issue #307 ("首頁熱門成交
// 排行榜改為世界名鴿介紹專區 + 後台鴿種介紹專區調整").
//
//   ALTER TABLE pigeon_showcase
//     MODIFY COLUMN category ENUM('award','imported','representative','world_famous') NOT NULL;
//
// IMPORTANT — this ALTER is already applied automatically, on every boot:
// lib/db.ts's ensureSchema() (called from getDb()) runs
// ensurePigeonShowcaseCategories(), which issues this exact statement
// unconditionally every time the app starts, including in production. That
// mechanism already covers this migration end-to-end — the next deploy/
// restart after this change ships widens the ENUM with no manual step.
// MODIFY COLUMN is idempotent (a no-op once the ENUM already includes every
// value), so running this script too is harmless, just redundant.
//
// This standalone script exists per issue #307's explicit request, as an
// independent, auditable, hand-run equivalent of that same statement — useful
// if anyone wants to apply the ENUM widening ahead of a deploy, or verify it
// against production directly rather than trusting the next boot to do it.
//
// This is NOT a repeatable admin feature and must never be wired into a
// button, cron, or CI job — same "an agent may prepare and test this script,
// but only a human runs it with --confirm against production, after taking a
// verified backup and reviewing the --dry-run output" convention as
// scripts/migrate-product-prices.mjs / cleanup-closed-listings.mjs /
// cleanup-herbots-news.mjs.
//
// Usage:
//   node scripts/migrate-pigeon-showcase-world-famous-category.mjs               # dry run (default) — reports current ENUM definition, writes nothing
//   node scripts/migrate-pigeon-showcase-world-famous-category.mjs --dry-run      # same, explicit
//   node scripts/migrate-pigeon-showcase-world-famous-category.mjs --confirm      # ACTUALLY RUNS the ALTER TABLE statement.
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

const ALTER_SQL =
  "ALTER TABLE pigeon_showcase MODIFY COLUMN category ENUM('award','imported','representative','world_famous') NOT NULL";

// Read-only: reports the column's current ENUM definition without writing
// anything. Safe to call against production at any time.
export async function planMigration(conn) {
  const [rows] = await conn.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pigeon_showcase' AND COLUMN_NAME = 'category'",
  );
  const currentType = rows[0]?.COLUMN_TYPE ?? null;
  const alreadyApplied = currentType !== null && currentType.includes("world_famous");
  return { currentType, alreadyApplied };
}

// Runs the ALTER TABLE statement. `conn` must be a dedicated connection
// (e.g. from pool.getConnection()), matching the other scripts/migrate-*.mjs
// files' convention, even though this single DDL statement has nothing to
// wrap in an explicit transaction (MySQL/MariaDB DDL auto-commits).
export async function executeMigration(conn) {
  await conn.query(ALTER_SQL);
  return planMigration(conn);
}

function printWarning() {
  const bar = "!".repeat(70);
  console.warn(bar);
  console.warn("!! 即將對正式站執行 ALTER TABLE，加寬 pigeon_showcase.category 的 ENUM。");
  console.warn("!! 這個操作本身應該已經由 lib/db.ts 的 ensureSchema() 在每次應用程式啟動時");
  console.warn("!! 自動執行過了（見本檔案開頭註解）——手動執行這支腳本只是多一次相同、");
  console.warn("!! 幂等的 ALTER，理論上不會有風險，但仍建議：");
  console.warn("!! (1) 已完成資料庫備份、(2) 已先用 --dry-run 檢視目前的 ENUM 定義。");
  console.warn(bar);
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  // Anything short of an explicit --confirm is treated as a dry run —
  // including no flags at all and an explicit --dry-run. This is
  // deliberately fail-safe: there is no flag combination that writes data
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
      console.log("[dry run] 檢視 pigeon_showcase.category 目前的 ENUM 定義，不會變更任何資料表結構。");
      const result = await planMigration(conn);
      console.log(`  目前欄位定義：${result.currentType ?? "（找不到 pigeon_showcase.category 欄位）"}`);
      if (result.alreadyApplied) {
        console.log("\n  已經包含 world_famous，無需執行。");
      } else {
        console.log("\n  尚未包含 world_famous。確認已備份後，再由人工執行：");
        console.log("    node scripts/migrate-pigeon-showcase-world-famous-category.mjs --confirm");
        console.log("\n  （或者，直接部署／重啟一次應用程式——lib/db.ts 的 ensureSchema() 會自動套用同一個 ALTER。）");
      }
    } else {
      printWarning();
      const result = await executeMigration(conn);
      console.log(`\n完成。目前欄位定義：${result.currentType}`);
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

// Guarded so importing this module's pure/query-building exports
// (planMigration, executeMigration) from a test file doesn't also connect to
// a database as a side effect of the import — same convention as
// scripts/cleanup-closed-listings.mjs / migrate-product-prices.mjs.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
