import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

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

export async function planMigration(conn) {
  const [loftRows] = await conn.query(
    "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pigeon_showcase' AND COLUMN_NAME = 'loft_id'",
  );
  const loftNullable = loftRows[0]?.IS_NULLABLE === "YES";

  const [photoSourceRows] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pigeon_showcase' AND COLUMN_NAME = 'photo_source'",
  );
  const photoSourceExists = photoSourceRows.length > 0;

  return {
    loftNullable,
    photoSourceExists,
    alreadyApplied: loftNullable && photoSourceExists,
  };
}

export async function executeMigration(conn) {
  const plan = await planMigration(conn);
  if (!plan.loftNullable) {
    await conn.query("ALTER TABLE pigeon_showcase MODIFY COLUMN loft_id BIGINT NULL");
  }
  if (!plan.photoSourceExists) {
    await conn.query("ALTER TABLE pigeon_showcase ADD COLUMN photo_source VARCHAR(100) NULL");
  }
  return planMigration(conn);
}

function printWarning() {
  const bar = "!".repeat(70);
  console.warn(bar);
  console.warn("!! 即將對資料庫執行 ALTER TABLE：");
  console.warn("!! 1. 將 pigeon_showcase.loft_id 改為允許 NULL");
  console.warn("!! 2. 為 pigeon_showcase 新增 photo_source VARCHAR(100) NULL 欄位");
  console.warn(bar);
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
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
      console.log("[dry run] 檢視 pigeon_showcase 結構，不會變更任何資料表結構。");
      const result = await planMigration(conn);
      console.log(`  loft_id 允許 NULL：${result.loftNullable ? "是" : "否"}`);
      console.log(`  photo_source 欄位已存在：${result.photoSourceExists ? "是" : "否"}`);
      if (result.alreadyApplied) {
        console.log("\n  已經套用過，無需執行。");
      } else {
        console.log("\n  尚未完全套用。執行指令：");
        console.log("    node scripts/migrate-pigeon-showcase-photo-source.mjs --confirm");
      }
    } else {
      printWarning();
      const result = await executeMigration(conn);
      console.log(`\n完成。loft_id 允許 NULL：${result.loftNullable}，photo_source 已存在：${result.photoSourceExists}`);
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
