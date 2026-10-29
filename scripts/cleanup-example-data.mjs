// One-off production data-deletion script: permanently deletes all `@example.com`
// test user accounts (`LOWER(email) LIKE '%@example.com'`) and every related row
// across listings, bids, purchases, product_orders, auth/challenge tables,
// contact_messages, and login_attempts inside a single transaction.
// See GitHub issue #375 and docs/specs/cleanup-example-com-data.md.
//
// Usage:
//   node scripts/cleanup-example-data.mjs                      # dry run (default) — reports counts & users only
//   node scripts/cleanup-example-data.mjs --dry-run            # same, explicit
//   node scripts/cleanup-example-data.mjs --backup <filepath>  # exports all matching rows to a 0600 JSON backup file
//   node scripts/cleanup-example-data.mjs --confirm            # ACTUALLY DELETES inside one transaction. Irreversible.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
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

export const EXAMPLE_EMAIL_WHERE = "LOWER(email) LIKE '%@example.com'";
export const EXAMPLE_USER_IDS_SUBQUERY = `SELECT id FROM users WHERE ${EXAMPLE_EMAIL_WHERE}`;
export const EXAMPLE_LISTING_IDS_SUBQUERY = `SELECT id FROM listings WHERE created_by IN (${EXAMPLE_USER_IDS_SUBQUERY})`;

export const LISTING_CASCADE_TABLES = ["bids", "purchases", "listing_photos"];
export const USER_AUTH_CASCADE_TABLES = [
  "sessions",
  "password_reset_tokens",
  "email_verification_tokens",
  "email_otp_challenges",
  "webauthn_challenges",
  "webauthn_credentials",
  "totp_setup_challenges",
  "totp_backup_codes",
];
export const DIRECT_EMAIL_TABLES = ["contact_messages", "login_attempts"];

export async function listExampleUsers(conn) {
  const [rows] = await conn.query(
    `SELECT id, email, role, display_name, created_at FROM users WHERE ${EXAMPLE_EMAIL_WHERE} ORDER BY id ASC`,
  );
  return rows;
}

// Read-only: counts what --confirm would delete or recalculate, without modifying anything.
export async function planCleanup(conn) {
  const counts = {};

  for (const table of LISTING_CASCADE_TABLES) {
    const key = table.startsWith("listing_") ? table : `listing_${table}`;
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM ${table} WHERE listing_id IN (${EXAMPLE_LISTING_IDS_SUBQUERY})`,
    );
    counts[key] = Number(rows[0].cnt);
  }

  const [listingRows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM listings WHERE created_by IN (${EXAMPLE_USER_IDS_SUBQUERY})`,
  );
  counts.listings = Number(listingRows[0].cnt);

  const [userBidRows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM bids WHERE user_id IN (${EXAMPLE_USER_IDS_SUBQUERY}) AND listing_id NOT IN (${EXAMPLE_LISTING_IDS_SUBQUERY})`,
  );
  counts.user_bids = Number(userBidRows[0].cnt);

  const [userPurchaseRows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM purchases WHERE buyer_id IN (${EXAMPLE_USER_IDS_SUBQUERY}) AND listing_id NOT IN (${EXAMPLE_LISTING_IDS_SUBQUERY})`,
  );
  counts.user_purchases = Number(userPurchaseRows[0].cnt);

  const [productOrderRows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM product_orders WHERE buyer_id IN (${EXAMPLE_USER_IDS_SUBQUERY})`,
  );
  counts.product_orders = Number(productOrderRows[0].cnt);

  const [recalcRows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM listings WHERE created_by NOT IN (${EXAMPLE_USER_IDS_SUBQUERY}) AND (leader_user_id IN (${EXAMPLE_USER_IDS_SUBQUERY}) OR id IN (SELECT listing_id FROM bids WHERE user_id IN (${EXAMPLE_USER_IDS_SUBQUERY})))`,
  );
  counts.recalculated_listings = Number(recalcRows[0].cnt);

  for (const table of USER_AUTH_CASCADE_TABLES) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM ${table} WHERE user_id IN (${EXAMPLE_USER_IDS_SUBQUERY})`,
    );
    counts[table] = Number(rows[0].cnt);
  }

  const [userRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM users WHERE ${EXAMPLE_EMAIL_WHERE}`);
  counts.users = Number(userRows[0].cnt);

  for (const table of DIRECT_EMAIL_TABLES) {
    const [rows] = await conn.query(`SELECT COUNT(*) AS cnt FROM ${table} WHERE ${EXAMPLE_EMAIL_WHERE}`);
    counts[table] = Number(rows[0].cnt);
  }

  return counts;
}

// Read-only snapshot of all rows that executeCleanup will delete or recalculate.
export async function backupExampleData(conn) {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    tables: {},
  };

  const [users] = await conn.query(
    `SELECT id, email, google_id, line_user_id, role, display_name, phone, address, line_id, terms_accepted_at, deleted_at, suspended_at, locale, email_verified, two_factor_method, created_at FROM users WHERE ${EXAMPLE_EMAIL_WHERE} ORDER BY id ASC`,
  );
  snapshot.tables.users = users;

  const [listings] = await conn.query(
    `SELECT * FROM listings WHERE created_by IN (${EXAMPLE_USER_IDS_SUBQUERY}) ORDER BY id ASC`,
  );
  snapshot.tables.listings = listings;

  for (const table of LISTING_CASCADE_TABLES) {
    const key = table.startsWith("listing_") ? table : `listing_${table}`;
    const [rows] = await conn.query(
      `SELECT * FROM ${table} WHERE listing_id IN (${EXAMPLE_LISTING_IDS_SUBQUERY}) ORDER BY id ASC`,
    );
    snapshot.tables[key] = rows;
  }

  const [userBids] = await conn.query(
    `SELECT * FROM bids WHERE user_id IN (${EXAMPLE_USER_IDS_SUBQUERY}) AND listing_id NOT IN (${EXAMPLE_LISTING_IDS_SUBQUERY}) ORDER BY id ASC`,
  );
  snapshot.tables.user_bids = userBids;

  const [userPurchases] = await conn.query(
    `SELECT * FROM purchases WHERE buyer_id IN (${EXAMPLE_USER_IDS_SUBQUERY}) AND listing_id NOT IN (${EXAMPLE_LISTING_IDS_SUBQUERY}) ORDER BY id ASC`,
  );
  snapshot.tables.user_purchases = userPurchases;

  const [productOrders] = await conn.query(
    `SELECT * FROM product_orders WHERE buyer_id IN (${EXAMPLE_USER_IDS_SUBQUERY}) ORDER BY id ASC`,
  );
  snapshot.tables.product_orders = productOrders;

  const [affectedListings] = await conn.query(
    `SELECT * FROM listings WHERE created_by NOT IN (${EXAMPLE_USER_IDS_SUBQUERY}) AND (leader_user_id IN (${EXAMPLE_USER_IDS_SUBQUERY}) OR id IN (SELECT listing_id FROM bids WHERE user_id IN (${EXAMPLE_USER_IDS_SUBQUERY}))) ORDER BY id ASC`,
  );
  snapshot.tables.affected_surviving_listings = affectedListings;

  for (const table of DIRECT_EMAIL_TABLES) {
    const [rows] = await conn.query(`SELECT * FROM ${table} WHERE ${EXAMPLE_EMAIL_WHERE} ORDER BY id ASC`);
    snapshot.tables[table] = rows;
  }

  return snapshot;
}

// Destructive: deletes all @example.com data and recalculates affected surviving
// listings inside one transaction. Rolls back on any error.
export async function executeCleanup(conn) {
  const counts = {};
  await conn.beginTransaction();
  try {
    // 1. Listings created by @example.com users & their cascade child rows
    for (const table of LISTING_CASCADE_TABLES) {
      const key = table.startsWith("listing_") ? table : `listing_${table}`;
      const [result] = await conn.query(
        `DELETE FROM ${table} WHERE listing_id IN (${EXAMPLE_LISTING_IDS_SUBQUERY})`,
      );
      counts[key] = result.affectedRows;
    }
    const [listingResult] = await conn.query(
      `DELETE FROM listings WHERE created_by IN (${EXAMPLE_USER_IDS_SUBQUERY})`,
    );
    counts.listings = listingResult.affectedRows;

    // 2. Surviving listings where an @example.com user bid or was leading
    const [affectedListingRows] = await conn.query(
      `SELECT id FROM listings WHERE leader_user_id IN (${EXAMPLE_USER_IDS_SUBQUERY}) OR id IN (SELECT listing_id FROM bids WHERE user_id IN (${EXAMPLE_USER_IDS_SUBQUERY})) ORDER BY id ASC`,
    );

    const [userBidsResult] = await conn.query(
      `DELETE FROM bids WHERE user_id IN (${EXAMPLE_USER_IDS_SUBQUERY})`,
    );
    counts.user_bids = userBidsResult.affectedRows;

    const [userPurchasesResult] = await conn.query(
      `DELETE FROM purchases WHERE buyer_id IN (${EXAMPLE_USER_IDS_SUBQUERY})`,
    );
    counts.user_purchases = userPurchasesResult.affectedRows;

    const [productOrdersResult] = await conn.query(
      `DELETE FROM product_orders WHERE buyer_id IN (${EXAMPLE_USER_IDS_SUBQUERY})`,
    );
    counts.product_orders = productOrdersResult.affectedRows;

    for (const row of affectedListingRows) {
      const [topBids] = await conn.query(
        "SELECT user_id, amount, max_amount FROM bids WHERE listing_id = ? ORDER BY max_amount DESC, amount DESC, id ASC LIMIT 1",
        [row.id],
      );
      if (topBids.length > 0) {
        const topBid = topBids[0];
        await conn.query(
          "UPDATE listings SET leader_user_id = ?, leader_max_amount = ?, current_price = ? WHERE id = ?",
          [topBid.user_id, topBid.max_amount, topBid.amount, row.id],
        );
      } else {
        await conn.query(
          "UPDATE listings SET leader_user_id = NULL, leader_max_amount = NULL, current_price = COALESCE(starting_price, price, 0) WHERE id = ?",
          [row.id],
        );
      }
    }
    counts.recalculated_listings = affectedListingRows.length;

    // 3. Auth & challenge rows belonging to @example.com users
    for (const table of USER_AUTH_CASCADE_TABLES) {
      const [result] = await conn.query(
        `DELETE FROM ${table} WHERE user_id IN (${EXAMPLE_USER_IDS_SUBQUERY})`,
      );
      counts[table] = result.affectedRows;
    }

    // 4. @example.com user accounts
    const [userResult] = await conn.query(`DELETE FROM users WHERE ${EXAMPLE_EMAIL_WHERE}`);
    counts.users = userResult.affectedRows;

    // 5. Non-FK tables directly storing @example.com emails
    for (const table of DIRECT_EMAIL_TABLES) {
      const [result] = await conn.query(`DELETE FROM ${table} WHERE ${EXAMPLE_EMAIL_WHERE}`);
      counts[table] = result.affectedRows;
    }

    await conn.commit();
    return counts;
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

const SUMMARY_KEYS = [
  "listing_bids",
  "listing_purchases",
  "listing_photos",
  "listings",
  "user_bids",
  "user_purchases",
  "product_orders",
  "recalculated_listings",
  ...USER_AUTH_CASCADE_TABLES,
  "users",
  ...DIRECT_EMAIL_TABLES,
];

function formatSummary(counts, { dryRun }) {
  const lines = [
    `\n=== @example.com 測試資料清理摘要${dryRun ? "（dry run，尚未刪除任何資料）" : "（已實際刪除）"} ===`,
  ];
  for (const key of SUMMARY_KEYS) {
    const isRecalc = key === "recalculated_listings";
    const verb = isRecalc
      ? dryRun
        ? "將被重算"
        : "已重算"
      : dryRun
        ? "將被刪除"
        : "已刪除";
    lines.push(`  ${key.padEnd(28)} ${String(counts[key] ?? 0).padStart(8)} 筆 ${verb}`);
  }
  lines.push("=".repeat(60));
  return lines.join("\n");
}

function printIrreversibleWarning() {
  const bar = "!".repeat(70);
  console.warn(bar);
  console.warn("!! 危險操作：即將永久刪除所有 @example.com 測試帳號及其關聯紀錄。");
  console.warn("!! 此操作不可逆。");
  console.warn("!! 執行前請確認：(1) 已完成資料庫備份、");
  console.warn("!!               (2) 已先用 --dry-run 檢視過筆數並確認合理。");
  console.warn(bar);
}

async function main() {
  const args = process.argv.slice(2);
  const backupIdx = args.indexOf("--backup");
  const backupPath = backupIdx !== -1 ? args[backupIdx + 1] : null;
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
    if (backupPath) {
      const snapshot = await backupExampleData(conn);
      writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
      console.log(`[backup] 已將 @example.com 關聯資料快照寫入 ${backupPath}`);
      return;
    }

    if (dryRun) {
      console.log("[dry run] 試算「若執行 --confirm 會刪除多少筆 @example.com 資料」，不會變更任何資料列。");
      const exampleUsers = await listExampleUsers(conn);
      console.log(`\n匹配到的 @example.com 帳號共 ${exampleUsers.length} 筆：`);
      for (const u of exampleUsers) {
        console.log(`  - id=${u.id} email=${u.email} role=${u.role} display_name=${u.display_name ?? ""}`);
      }
      const counts = await planCleanup(conn);
      console.log(formatSummary(counts, { dryRun: true }));
      const totalAffected = Object.values(counts).reduce((sum, n) => sum + Number(n), 0);
      if (totalAffected === 0) {
        console.log("\n目前沒有任何 @example.com 測試資料，無需執行。");
      } else {
        console.log("\n確認上方筆數合理，且已完成備份後，再執行：");
        console.log("  node scripts/cleanup-example-data.mjs --confirm");
      }
    } else {
      printIrreversibleWarning();
      const counts = await executeCleanup(conn);
      console.log(formatSummary(counts, { dryRun: false }));
      console.log("\n完成。建議再次執行 `node scripts/cleanup-example-data.mjs --dry-run` 驗證所有計數皆為 0。");
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
