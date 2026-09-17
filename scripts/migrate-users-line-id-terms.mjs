// One-off schema migration: adds `users.line_id` and
// `users.terms_accepted_at`, both nullable, to an already-deployed database.
// See GitHub issue #304 ("註冊頁新增姓名必填/LINE ID/同意拍賣規則與隱私權條款
// checkbox").
//
//   ALTER TABLE users ADD COLUMN line_id VARCHAR(20) NULL;
//   ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME NULL;
//
// IMPORTANT — this ALTER is already applied automatically, on every boot:
// lib/db.ts's ensureSchema() (called from getDb()) runs
// ensureLineIdAndTermsColumns(), which adds both columns (if missing) every
// time the app starts, including in production. That mechanism already
// covers this migration end-to-end — the next deploy/restart after this
// change ships adds both columns with no manual step.
//
// This standalone script exists for the same reason
// scripts/migrate-pigeon-showcase-world-famous-category.mjs does (issue
// #307's explicit request, kept here as the same kind of precedent): an
// independent, auditable, hand-run equivalent of that same pair of
// statements — useful if anyone wants to apply them ahead of a deploy, or
// verify the column definitions against production directly rather than
// trusting the next boot to do it. Both ADD COLUMN statements are
// individually idempotent as implemented below (each is skipped once its
// column already exists), so running this script is harmless even after
// ensureLineIdAndTermsColumns has already run, just redundant.
//
// Both new columns are added NULL-able here (not NOT NULL) even though
// line_id is required at the application layer for every *new* registration
// (see lib/profile.ts's validateProfile) — existing accounts have no LINE ID
// on file and are not backfilled; an admin/user fills theirs in later via
// /account (issue #304 item 4). terms_accepted_at is stamped only at the
// moment of registration (lib/auth.ts's createUser) and is left NULL for
// every pre-existing row — there is no real "when did they agree" timestamp
// to invent for accounts that registered before this consent checkbox
// existed.
//
// This is NOT a repeatable admin feature and must never be wired into a
// button, cron, or CI job — same "an agent may prepare and test this script,
// but only a human runs it with --confirm against production, after taking a
// verified backup and reviewing the --dry-run output" convention as
// scripts/migrate-product-prices.mjs /
// scripts/migrate-pigeon-showcase-world-famous-category.mjs /
// scripts/cleanup-closed-listings.mjs / scripts/cleanup-herbots-news.mjs.
//
// Usage:
//   node scripts/migrate-users-line-id-terms.mjs               # dry run (default) — reports which columns are missing, writes nothing
//   node scripts/migrate-users-line-id-terms.mjs --dry-run      # same, explicit
//   node scripts/migrate-users-line-id-terms.mjs --confirm      # ACTUALLY RUNS any missing ALTER TABLE ADD COLUMN statements.
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

const COLUMNS = [
  { name: "line_id", definition: "VARCHAR(20) NULL" },
  { name: "terms_accepted_at", definition: "DATETIME NULL" },
];

async function columnExists(conn, columnName) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?",
    [columnName],
  );
  return rows[0].cnt > 0;
}

// Read-only: reports which of the two columns are already present without
// writing anything. Safe to call against production at any time.
export async function planMigration(conn) {
  const columns = [];
  for (const column of COLUMNS) {
    columns.push({ ...column, exists: await columnExists(conn, column.name) });
  }
  return { columns, allApplied: columns.every((column) => column.exists) };
}

// Adds whichever of the two columns don't already exist. `conn` must be a
// dedicated connection (e.g. from pool.getConnection()), matching the other
// scripts/migrate-*.mjs files' convention, even though these DDL statements
// have nothing to wrap in an explicit transaction (MySQL/MariaDB DDL
// auto-commits).
export async function executeMigration(conn) {
  const plan = await planMigration(conn);
  for (const column of plan.columns) {
    if (!column.exists) {
      await conn.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
  return planMigration(conn);
}

function printWarning() {
  const bar = "!".repeat(70);
  console.warn(bar);
  console.warn("!! 即將對正式站 users 資料表執行 ALTER TABLE，新增 line_id / terms_accepted_at 欄位。");
  console.warn("!! 這個操作本身應該已經由 lib/db.ts 的 ensureSchema() 在每次應用程式啟動時");
  console.warn("!! 自動執行過了（見本檔案開頭註解）——手動執行這支腳本只是多一次相同、");
  console.warn("!! 對已存在欄位會自動略過的操作，理論上不會有風險，但仍建議：");
  console.warn("!! (1) 已完成資料庫備份、(2) 已先用 --dry-run 檢視目前缺少哪些欄位。");
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
      console.log("[dry run] 檢視 users.line_id / users.terms_accepted_at 目前是否已存在，不會變更任何資料表結構。");
      const plan = await planMigration(conn);
      for (const column of plan.columns) {
        console.log(`  ${column.name}：${column.exists ? "已存在" : "尚未存在"}`);
      }
      if (plan.allApplied) {
        console.log("\n  兩個欄位都已存在，無需執行。");
      } else {
        console.log("\n  尚有欄位缺少。確認已備份後，再由人工執行：");
        console.log("    node scripts/migrate-users-line-id-terms.mjs --confirm");
        console.log(
          "\n  （或者，直接部署／重啟一次應用程式——lib/db.ts 的 ensureSchema() 會自動新增缺少的欄位。）",
        );
      }
    } else {
      printWarning();
      const result = await executeMigration(conn);
      for (const column of result.columns) {
        console.log(`  ${column.name}：${column.exists ? "已存在" : "新增失敗"}`);
      }
      console.log("\n完成。");
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

// Guarded so importing this module's pure/query-building exports
// (planMigration, executeMigration) from a test file doesn't also connect to
// a database as a side effect of the import — same convention as
// scripts/cleanup-closed-listings.mjs / migrate-product-prices.mjs /
// migrate-pigeon-showcase-world-famous-category.mjs.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
