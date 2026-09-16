// One-off, production data-migration script: converts `products.price_text`
// (a free-text display field, issue #277/#293) into the new structured
// `products.price` column (issue #298). See GitHub issue #298 ("Products
// 新增真正的線上下單/付款流程").
//
// Classification rule (per the issue body):
//   - price_text trimmed is a pure-digit string ("12000")  -> price = that number
//   - anything else ("電洽", "NT$12,000", "面議", "", ...) -> price = NULL
//     (call-for-price; an admin must manually open the product in
//     app/z04urru6/products/ and fill in the real price later before it can
//     be sold online)
//
// This script ONLY ever writes `products.price` — it never touches
// stock_quantity/stock_remaining. Those two columns have no legacy data to
// derive from (they're a brand-new concept added by this same ticket) and
// stay NULL (the ensureColumn default) regardless of a row's price outcome;
// an admin must explicitly set a stock quantity via the edit form before a
// migrated, now-priced product becomes purchasable online. This is
// deliberate: silently inventing a stock number for a pre-existing
// display-only item would be guessing, and getting it wrong either opens it
// for sale with fictional inventory or blocks a sale that should have gone
// through.
//
// This is NOT a repeatable admin feature and must never be wired into a
// button, cron, or CI job — like scripts/cleanup-closed-listings.mjs
// (issue #279) and scripts/cleanup-herbots-news.mjs (issue #280), an agent
// may prepare and test this script, but only a human runs it with --confirm
// against production, after taking a verified backup and reviewing the
// --dry-run output.
//
// Usage:
//   node scripts/migrate-product-prices.mjs               # dry run (default) — reports counts only, writes nothing
//   node scripts/migrate-product-prices.mjs --dry-run      # same, explicit
//   node scripts/migrate-product-prices.mjs --confirm      # ACTUALLY WRITES products.price, inside one transaction.
//
// Run this once, right after deploying the products.price/stock_quantity/
// stock_remaining columns (this ticket's lib/db.ts ensureProductOrderColumns)
// and before any admin creates/edits a product through the new price/
// call-for-price form — otherwise a product an admin has already
// deliberately marked call-for-price under the new UI (price = NULL by
// intent, not because it's unmigrated) is indistinguishable from one this
// script hasn't looked at yet, though re-running it is harmless either way
// (a call-for-price row's price_text is never a pure-digit string, so it
// always re-classifies to price = NULL, same as it already is).
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

// Same "digits-only string" rule as lib/productPriceText.ts's
// formatProductPriceText — kept as an independent copy (not imported) so
// this standalone script has no dependency on the Next.js app's module
// graph/path aliases, same reasoning scripts/cleanup-closed-listings.mjs
// gives for not importing from lib/.
const ALL_DIGITS = /^[0-9]+$/;

// Pure classification, no I/O — directly unit-testable (see
// migrate-product-prices.test.mjs) without a live database.
export function classifyPriceText(priceText) {
  const trimmed = String(priceText ?? "").trim();
  if (trimmed.length > 0 && ALL_DIGITS.test(trimmed)) {
    const value = Number(trimmed);
    if (Number.isSafeInteger(value) && value > 0) {
      return { price: value };
    }
  }
  return { price: null };
}

async function classifyAllProducts(conn) {
  const [rows] = await conn.query("SELECT id, title, price_text FROM products ORDER BY id ASC");
  return rows.map((row) => ({ ...row, ...classifyPriceText(row.price_text) }));
}

// Read-only: classifies every product's price_text without writing
// anything. Safe to call against production at any time.
export async function planMigration(conn) {
  const classified = await classifyAllProducts(conn);
  const numeric = classified.filter((row) => row.price !== null);
  const callForPrice = classified.filter((row) => row.price === null);
  return { total: classified.length, numeric, callForPrice };
}

// Writes every row's derived `price` inside a single transaction. Rolls
// back (leaving the database untouched) if any statement fails partway
// through. `conn` must be a dedicated connection (e.g. from
// pool.getConnection()), not a pool — transactions are per-connection in
// mysql2.
export async function executeMigration(conn) {
  const classified = await classifyAllProducts(conn);
  await conn.beginTransaction();
  try {
    for (const row of classified) {
      await conn.query("UPDATE products SET price = ? WHERE id = ?", [row.price, row.id]);
    }
    await conn.commit();
    const numeric = classified.filter((row) => row.price !== null);
    const callForPrice = classified.filter((row) => row.price === null);
    return { total: classified.length, numeric, callForPrice };
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

function formatSummary(result, { dryRun }) {
  const lines = [`\n=== 商品價格遷移摘要${dryRun ? "（dry run，尚未寫入任何資料）" : "（已實際寫入）"} ===`];
  lines.push(`  總筆數：${result.total}`);
  lines.push(`  自動轉為數字價格：${result.numeric.length} 筆`);
  lines.push(`  轉為電洽（price = NULL，需人工後台補填）：${result.callForPrice.length} 筆`);
  if (result.callForPrice.length > 0) {
    lines.push("\n  以下商品轉為電洽，請人工至後台「商品管理」確認／補填正確價格：");
    for (const row of result.callForPrice) {
      lines.push(`    #${row.id} ${row.title}（原始 price_text：${JSON.stringify(row.price_text)}）`);
    }
  }
  lines.push("=".repeat(50));
  return lines.join("\n");
}

function printWarning() {
  const bar = "!".repeat(70);
  console.warn(bar);
  console.warn("!! 即將寫入正式站 products.price 欄位（不可逆的資料轉換，雖非刪除，");
  console.warn("!! 但轉為電洽的商品在人工補填價格前無法線上下單）。");
  console.warn("!! 執行前請確認：(1) 已完成完整資料庫備份並驗證可還原、");
  console.warn("!!               (2) 已先用 --dry-run 檢視過分類結果並確認合理、");
  console.warn("!!               (3) 尚未有管理員透過新版「價格／電洽」表單建立或編輯過商品");
  console.warn("!!                   （避免把管理員剛設定好的真實電洽商品跟舊資料混淆——");
  console.warn("!!                   雖然重跑本身無害，見檔案開頭註解）。");
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
      console.log("[dry run] 試算「若執行 --confirm 會如何分類每一筆商品價格」，不會變更任何資料列。");
      const result = await planMigration(conn);
      console.log(formatSummary(result, { dryRun: true }));
      if (result.total === 0) {
        console.log("\n目前沒有任何商品，無需執行。");
      } else {
        console.log("\n確認上方分類結果合理，且已完成備份後，再由人工執行：");
        console.log("  node scripts/migrate-product-prices.mjs --confirm");
      }
    } else {
      printWarning();
      const result = await executeMigration(conn);
      console.log(formatSummary(result, { dryRun: false }));
      console.log("\n完成。請至後台「商品管理」逐一確認上方列出的電洽商品，補填正確價格與庫存後即可開放線上下單。");
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

// Guarded so importing this module's pure/query-building exports
// (classifyPriceText, planMigration, executeMigration) from a test file
// doesn't also connect to a database as a side effect of the import — same
// convention as scripts/cleanup-closed-listings.mjs.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
