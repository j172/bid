import mysql from "mysql2/promise";

let pool: mysql.Pool | undefined;
let ready: Promise<void> | undefined;

// Kept in sync with db/init.sql (which exists for reference / manual runs).
// Inlined here — rather than read from disk at runtime — because the deploy
// pipeline only ships the compiled .next output, not the repo's plain files.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  display_name VARCHAR(50) NULL,
  phone VARCHAR(20) NULL,
  address VARCHAR(200) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Self-service "forgot password" reset tokens (issue #89) — see db/init.sql
-- for the fuller header comment. Brand-new table, whole final schema from
-- day one, same as homepage_sections/exchange_rates above.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  request_ip VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (token),
  KEY idx_password_reset_tokens_user (user_id),
  KEY idx_password_reset_tokens_ip_created (request_ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registration email-ownership verification tokens (issue #118) — see
-- db/init.sql for the fuller header comment. Brand-new table, whole final
-- schema from day one, same as password_reset_tokens above.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  request_ip VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (token),
  KEY idx_email_verification_tokens_user (user_id),
  KEY idx_email_verification_tokens_ip_created (request_ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pending Email-OTP login challenges (issue #93) — see db/init.sql for the
-- fuller header comment. Brand-new table, whole final schema from day one,
-- same as password_reset_tokens above.
CREATE TABLE IF NOT EXISTS email_otp_challenges (
  token VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  request_ip VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (token),
  KEY idx_email_otp_challenges_user (user_id),
  KEY idx_email_otp_challenges_ip_created (request_ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Short-lived WebAuthn ceremony challenges (issue #95) — see db/init.sql for
-- the fuller header comment. Brand-new table, whole final schema from day
-- one, same as password_reset_tokens/email_otp_challenges above.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  token VARCHAR(64) NOT NULL,
  challenge VARCHAR(255) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  user_id BIGINT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (token),
  KEY idx_webauthn_challenges_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registered passkeys / WebAuthn credentials (issue #95) — see db/init.sql
-- for the fuller header comment. Brand-new table, whole final schema from
-- day one, same as webauthn_challenges above.
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  credential_id VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name VARCHAR(100) NULL,
  transports VARCHAR(100) NULL,
  created_at DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  PRIMARY KEY (credential_id),
  KEY idx_webauthn_credentials_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TOTP setup-in-progress secrets + one-time recovery codes (issue #97) — see
-- db/init.sql for the fuller header comments. Brand-new tables, whole final
-- schema from day one, same as webauthn_challenges/webauthn_credentials
-- above.
CREATE TABLE IF NOT EXISTS totp_setup_challenges (
  token VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  secret VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (token),
  KEY idx_totp_setup_challenges_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS totp_backup_codes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_totp_backup_codes_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  starting_price BIGINT NOT NULL,
  buy_it_now_price BIGINT NULL,
  ends_at DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  settled_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_listings_status_ends (status, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_photos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  listing_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_listing_photos_listing (listing_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bids (
  id BIGINT NOT NULL AUTO_INCREMENT,
  listing_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  amount BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_bids_listing_amount (listing_id, amount),
  KEY idx_bids_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT NOT NULL AUTO_INCREMENT,
  listing_id BIGINT NOT NULL,
  buyer_id BIGINT NOT NULL,
  quantity BIGINT NOT NULL,
  unit_price BIGINT NOT NULL,
  total_amount BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  settled_at DATETIME NULL,
  settlement_account VARCHAR(30) NULL,
  settlement_amount BIGINT NULL,
  PRIMARY KEY (id),
  KEY idx_purchases_listing (listing_id),
  KEY idx_purchases_buyer (buyer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CMS foundation (issue #33 / #32) — see db/init.sql for the fuller
-- per-column comments; this is a brand-new table with its whole final
-- schema from day one, so (unlike the ensureColumn migrations below,
-- which patch already-deployed columns) it can just be a plain
-- CREATE TABLE IF NOT EXISTS statement here, same as listing_photos/bids/
-- purchases above were originally.
CREATE TABLE IF NOT EXISTS homepage_sections (
  id BIGINT NOT NULL AUTO_INCREMENT,
  section_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  image_file_name VARCHAR(255) NOT NULL,
  link_url VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_homepage_sections_type_sort (section_type, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily TWD/USD + TWD/CNY exchange-rate history (issue #45) — a brand-new
-- table introduced whole, same as the CMS table above. rate_date is
-- the calendar date this row was synced *for* (usually "today", see
-- lib/exchangeRates.ts's syncExchangeRates); source_date is the trading date
-- the rate value actually came from, which can trail behind rate_date when
-- TAIFEX has nothing new yet (holiday, not-yet-published) and the sync falls
-- back to the most recent successful rate instead of leaving that day blank.
CREATE TABLE IF NOT EXISTS exchange_rates (
  id BIGINT NOT NULL AUTO_INCREMENT,
  currency VARCHAR(10) NOT NULL,       -- 'USD' | 'CNY' — TWD is always the implicit base
  rate_date DATE NOT NULL,
  source_date DATE NOT NULL,
  rate DECIMAL(12,6) NOT NULL,         -- TWD per 1 unit of currency
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exchange_rates_currency_date (currency, rate_date),
  KEY idx_exchange_rates_currency_date (currency, rate_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 入賞鴿／進口鴿／代表種鴿 showcase entries (issue #54; 'representative' 代表種鴿
-- added by issue #170 — see ensurePigeonShowcaseCategories below for how it's
-- added to already-deployed databases) — deliberately NOT a revival of the
-- pigeon_gallery_* tables removed in #52 ("方向錯誤"): only a small set of
-- fixed categories (no custom category table), admin CRUD + a homepage
-- carousel/category list/detail page instead of a standalone gallery. loft_id is a
-- real DB-level FK to homepage_sections(id) (unlike listings.loft_id, which
-- stays a plain BIGINT per its own comment above) because this ticket
-- explicitly requires deletes of a still-referenced 合作鴿舍 to be rejected
-- rather than silently cascaded/nulled — see ON DELETE/UPDATE RESTRICT below
-- (RESTRICT is InnoDB's default when unspecified too; spelled out here for
-- clarity) and deleteHomepageSection's ER_ROW_IS_REFERENCED_2 handling in
-- lib/homepageSections.ts. MySQL foreign keys can't be scoped to only rows
-- matching section_type = 'partner_loft' — that check is enforced at the
-- application layer (lib/pigeonShowcase.ts) on write instead.
-- image_file_name (issue #70) is the 主圖; see ensureShowcaseNewsImageColumns
-- below for how it's added to already-deployed databases.
CREATE TABLE IF NOT EXISTS pigeon_showcase (
  id BIGINT NOT NULL AUTO_INCREMENT,
  category ENUM('award','imported','representative') NOT NULL,  -- 'award' 入賞鴿 | 'imported' 進口鴿 | 'representative' 代表種鴿
  name VARCHAR(100) NOT NULL,
  loft_id BIGINT NOT NULL,
  image_file_name VARCHAR(255) NULL,            -- 主圖 (issue #70); NULL only on pre-#70 rows
  description TEXT NOT NULL,                   -- sanitizeDescriptionHtml'd TinyMCE HTML, 2000-char plain-text cap
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_pigeon_showcase_category_created (category, created_at),
  KEY idx_pigeon_showcase_loft (loft_id),
  CONSTRAINT fk_pigeon_showcase_loft FOREIGN KEY (loft_id) REFERENCES homepage_sections (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 最新訊息 announcements (issue #56) — a public, browsable news/announcement
-- list rendered on /news and /news/[id] plus a homepage carousel. Simpler
-- than pigeon_showcase above — no FK, no dropdown/category dependency, id is
-- never shown publicly (U/D operate on it from the admin list only).
-- image_file_name (issue #70) is the 主圖 — same NULL-only-for-pre-#70-rows
-- story as pigeon_showcase.image_file_name above.
-- broadcast_id (issue #80) — see ensureNewsBroadcastColumn below for how
-- it's added to already-deployed databases; the newsletter feature
-- (lib/newsletter.ts) no longer has a standalone compose/send flow and only
-- ever broadcasts a post it's linked to from here.
CREATE TABLE IF NOT EXISTS news_posts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  image_file_name VARCHAR(255) NULL,  -- 主圖 (issue #70); NULL only on pre-#70 rows
  content TEXT NOT NULL,           -- sanitizeDescriptionHtml'd TinyMCE HTML, 2000-char plain-text cap
  broadcast_id VARCHAR(255) NULL,  -- Resend broadcast id (issue #80); NULL until a newsletter is sent/scheduled for this post
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_news_posts_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Public /contact form submissions (issue #104) — see db/init.sql for the
-- fuller header comment. Brand-new table, whole final schema from day one,
-- same as news_posts above.
CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_contact_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Failed password-login attempts (issue #140 H-1) — see db/init.sql for the
-- fuller header comment. Brand-new table, whole final schema from day one,
-- same as contact_messages above.
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  request_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_login_attempts_email_created (email, created_at),
  KEY idx_login_attempts_ip_created (request_ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// Columns added after their table's initial CREATE TABLE IF NOT EXISTS;
// existing rows on already-deployed databases need them added explicitly
// rather than assumed to exist.
async function ensureColumn(db: mysql.Pool, table: string, column: string, definition: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  const count = (rows as { cnt: number }[])[0].cnt;
  if (count === 0) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
  }
  return false;
}

// Counterpart to ensureColumn for columns removed after their table's
// initial CREATE TABLE IF NOT EXISTS — used by the #45 GRILL ME follow-up to
// drop homepage_sections.link_url on already-deployed databases (this
// project has no migration framework/history, just these idempotent
// boot-time checks).
async function dropColumnIfExists(db: mysql.Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  const count = (rows as { cnt: number }[])[0].cnt;
  if (count > 0) {
    await db.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    return true;
  }
  return false;
}

async function ensureIndex(
  db: mysql.Pool,
  table: string,
  indexName: string,
  definitionSql: string,
): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  const count = (rows as { cnt: number }[])[0].cnt;
  if (count === 0) {
    await db.query(`ALTER TABLE ${table} ADD ${definitionSql}`);
    return true;
  }
  return false;
}

async function ensureBiddingColumns(db: mysql.Pool): Promise<void> {
  const currentPriceAdded = await ensureColumn(db, "listings", "current_price", "BIGINT NOT NULL DEFAULT 0");
  if (currentPriceAdded) {
    await db.query("UPDATE listings SET current_price = starting_price WHERE current_price = 0");
  }

  await ensureColumn(db, "listings", "leader_user_id", "BIGINT NULL");
  await ensureColumn(db, "listings", "leader_max_amount", "BIGINT NULL");

  const maxAmountAdded = await ensureColumn(db, "bids", "max_amount", "BIGINT NOT NULL DEFAULT 0");
  if (maxAmountAdded) {
    await db.query("UPDATE bids SET max_amount = amount WHERE max_amount = 0");
  }
}

// display_name/phone/address are required at the application layer (see
// lib/profile.ts) for every *new* registration, but stay NULL-able at the
// DB level so already-deployed rows (accounts created before this ticket)
// don't need a synthetic backfill value.
async function ensureAccountColumns(db: mysql.Pool): Promise<void> {
  await ensureColumn(db, "users", "display_name", "VARCHAR(50) NULL");
  await ensureColumn(db, "users", "phone", "VARCHAR(20) NULL");
  await ensureColumn(db, "users", "address", "VARCHAR(200) NULL");
  await ensureColumn(db, "users", "deleted_at", "DATETIME NULL");
  await ensureColumn(db, "listings", "settled_at", "DATETIME NULL");
  await ensureColumn(db, "users", "suspended_at", "DATETIME NULL");
  // 'expired' | 'buy_now' | 'auto_bin', set at the moment each closing path
  // fires (see closeExpiredListings/buyNow/placeBid in lib/listings.ts).
  // NULL on listings that closed before this column existed — displayed as
  // "未知" rather than guessed at, since guessing from current_price alone
  // can't distinguish an explicit buy-now click from an auto-triggered one.
  await ensureColumn(db, "listings", "close_reason", "VARCHAR(20) NULL");
  // Recorded when an admin marks a listing settled (see markListingSettled
  // in lib/listings.ts). Deliberately NOT cleared by unsettleListing — kept
  // around so the settle modal can pre-fill the last-entered values if the
  // admin unsettles to fix a typo and re-settles.
  await ensureColumn(db, "listings", "settlement_account", "VARCHAR(30) NULL");
  await ensureColumn(db, "listings", "settlement_amount", "BIGINT NULL");
  // Set when notifyWinner/sendWinnerEmail (lib/notifications.ts) successfully
  // sends the winner-congratulations email — from closeExpiredListings,
  // buyNow, the auto-buyout branch of placeBid, or the admin's "重新寄送得標信"
  // resend button (issue #48). Left NULL on failure (sendEmail returning
  // false) so the admin closed-listings page can show "尚未寄送成功" and offer
  // a resend, rather than a multi-attempt history table (explicitly out of
  // scope for #48).
  await ensureColumn(db, "listings", "winner_notified_at", "DATETIME NULL");
  // 'auction' (default, existing proxy-bidding behavior) | 'fixed_price'
  // (一般商品: no bidding, fixed unit price, multi-unit stock — see
  // lib/purchase.ts and purchaseListing in lib/listings.ts). price/
  // stock_quantity/stock_remaining are NULL for auction listings; ends_at
  // is NULL for fixed_price listings (no time limit — see
  // ensureEndsAtNullable below).
  await ensureColumn(db, "listings", "listing_type", "VARCHAR(20) NOT NULL DEFAULT 'auction'");
  await ensureColumn(db, "listings", "price", "BIGINT NULL");
  await ensureColumn(db, "listings", "stock_quantity", "BIGINT NULL");
  await ensureColumn(db, "listings", "stock_remaining", "BIGINT NULL");
  // Optional scheduled-start timestamp for auction listings. Status stays
  // 'scheduled' until this moment, then openScheduledListings() lazily flips
  // to 'open'. Must exist on already-deployed DBs too, not just fresh init.sql.
  await ensureColumn(db, "listings", "starts_at", "DATETIME NULL");
  await ensureIndex(db, "listings", "idx_listings_status_starts", "INDEX idx_listings_status_starts (status, starts_at)");
  // Set at registration time from whichever locale the registration page was
  // on (see app/api/auth/register/route.ts) — used to pick the language for
  // that user's email notifications (see lib/notifications.ts). Existing
  // rows default to 'zh-TW' (this site's original/default language).
  await ensureColumn(db, "users", "locale", "VARCHAR(10) NOT NULL DEFAULT 'zh-TW'");
  // Which second factor (if any) this account requires at login (issue #93)
  // — see db/init.sql's CREATE TABLE users for the fuller comment on why
  // this is a single mutually-exclusive field rather than a boolean.
  await ensureColumn(db, "users", "two_factor_method", "VARCHAR(20) NOT NULL DEFAULT 'none'");
  // The confirmed TOTP shared secret (issue #97) — see db/init.sql's CREATE
  // TABLE users for the fuller comment on why this is set only via
  // confirmTotpSetup, never directly from totp_setup_challenges.
  await ensureColumn(db, "users", "totp_secret", "VARCHAR(64) NULL");
  // TOTP login brute-force guard (issue #97 code review follow-up) — see
  // db/init.sql's CREATE TABLE users for the fuller comment.
  await ensureColumn(db, "users", "totp_failed_attempts", "INT NOT NULL DEFAULT 0");
  await ensureColumn(db, "users", "totp_locked_until", "DATETIME NULL");
}

// buy_it_now_price started out NOT NULL (every listing required one);
// making it optional needs the already-deployed column relaxed, not just
// added — ensureColumn only handles brand-new columns. MODIFY COLUMN is
// idempotent (re-running it once already nullable is a no-op), so this is
// safe to call unconditionally on every boot rather than probing
// information_schema.IS_NULLABLE first.
async function ensureBuyItNowNullable(db: mysql.Pool): Promise<void> {
  await db.query("ALTER TABLE listings MODIFY COLUMN buy_it_now_price BIGINT NULL");
}

// ends_at started out NOT NULL (every listing had a deadline); fixed_price
// listings (see ensureAccountColumns) have no time limit, so the
// already-deployed column needs relaxing the same way buy_it_now_price did.
async function ensureEndsAtNullable(db: mysql.Pool): Promise<void> {
  await db.query("ALTER TABLE listings MODIFY COLUMN ends_at DATETIME NULL");
}

// GRILL ME follow-up (issue #45) amending #34's already-merged partner-loft
// (合作鴿舍) implementation: link_url is dropped (homepage cards now link to
// /listings?loft=<id> instead of an admin-entered URL — see
// app/[locale]/(with-loading)/page.tsx), replaced by an optional bio/簡介 shown on both the
// admin form and the homepage card excerpt. listings.loft_id is the new
// nullable single-select FK (this project has no DB-level FK constraints,
// so it's a plain BIGINT).
async function ensurePartnerLoftColumns(db: mysql.Pool): Promise<void> {
  await ensureColumn(db, "homepage_sections", "bio", "TEXT NULL");
  await dropColumnIfExists(db, "homepage_sections", "link_url");
  await ensureColumn(db, "listings", "loft_id", "BIGINT NULL");
}

// GRILL ME follow-up (issue #70) amending #54/#56's already-merged
// pigeon_showcase / news_posts implementations: both gain a required-at-the-
// app-layer 主圖 (main image), following the same image_file_name convention
// as homepage_sections (see lib/uploads.ts's savePigeonShowcaseImage/
// saveNewsImage). NULL-able at the DB level since already-deployed rows have
// no image and backfilling them for real is explicitly out of scope for #70
// — the public site falls back to a placeholder image wherever one is NULL.
async function ensureShowcaseNewsImageColumns(db: mysql.Pool): Promise<void> {
  await ensureColumn(db, "pigeon_showcase", "image_file_name", "VARCHAR(255) NULL");
  await ensureColumn(db, "news_posts", "image_file_name", "VARCHAR(255) NULL");
}

// Issue #80: 電子報功能合併進最新訊息管理 — the standalone Newsletter admin
// pages (app/z04urru6/newsletter/) are gone; every broadcast is now sent
// from the news form and tied to the news_posts row it was sent for. This
// column is the link; see lib/news.ts's setNewsBroadcastId.
async function ensureNewsBroadcastColumn(db: mysql.Pool): Promise<void> {
  await ensureColumn(db, "news_posts", "broadcast_id", "VARCHAR(255) NULL");
}

// Issue #118: registration email-ownership verification. email_verified
// defaults to FALSE at the column-definition level (see SCHEMA_SQL's users
// table above) so brand-new registrations on a fresh install start out
// unverified — but on an already-deployed database, ADD COLUMN applies that
// same FALSE default to every existing row too, which would wrongly lock out
// every account that registered before this ticket. The one-time UPDATE
// below (gated on `added`, so it only ever runs the boot right after the
// column is created — same "ensureColumn's return value decides whether a
// one-time backfill runs" convention as ensureBiddingColumns' current_price
// above) grandfathers every pre-existing row in as already verified.
// Exported (unlike its sibling ensureX helpers above) specifically so
// lib/db.test.ts can exercise the backfill decision directly against a
// mocked mysql.Pool, the same "verify a migration's exact query/UPDATE
// sequence" style lib/passwordReset.test.ts uses for its own DB-touching
// functions — this is the one migration in this file issue #118 explicitly
// requires a test for (grandfathering every existing account in as
// verified), so it gets a wider export surface than the others.
export async function ensureEmailVerificationColumns(db: mysql.Pool): Promise<void> {
  const added = await ensureColumn(db, "users", "email_verified", "TINYINT(1) NOT NULL DEFAULT 0");
  if (added) {
    await db.query("UPDATE users SET email_verified = 1");
  }
}

// Issue #170: adds the third 'representative' (代表種鴿) pigeon_showcase
// category alongside 'award'/'imported'. Same story as
// ensureBuyItNowNullable/ensureEndsAtNullable above — an already-deployed
// database's category column was created with the two-value ENUM from
// SCHEMA_SQL's original CREATE TABLE, so a fresh install picks up the third
// value from SCHEMA_SQL directly but an existing one needs its ENUM
// definition widened explicitly. MODIFY COLUMN is idempotent (re-running it
// once the ENUM already includes 'representative' is a no-op), so this is
// safe to call unconditionally on every boot rather than probing
// information_schema first.
async function ensurePigeonShowcaseCategories(db: mysql.Pool): Promise<void> {
  await db.query("ALTER TABLE pigeon_showcase MODIFY COLUMN category ENUM('award','imported','representative') NOT NULL");
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? {} : undefined,
    // multipleStatements is deliberately left off (issue #140 I-1). It was
    // only ever needed to fire SCHEMA_SQL's whole CREATE TABLE list in one
    // query — which splitSqlStatements now handles instead — while leaving
    // it on turns any future "one statement" SQL-injection slip anywhere in
    // this codebase into "attacker appends arbitrary extra statements".
    // Pure defence in depth: every query in this project is parameterised
    // today, and this keeps the blast radius small if one day one isn't.
    connectionLimit: 5,
  });
}

// SCHEMA_SQL above is one string per the "kept in sync with db/init.sql"
// convention, but has to reach the driver one statement at a time now that
// multipleStatements is off. Statements are separated by a semicolon at end
// of line; the semicolons that appear inside the `--` comments are all
// mid-line, so they never split a statement (the test in lib/db.test.ts
// pins that invariant: every chunk this produces is exactly one CREATE
// TABLE). Leading `--` comment lines stay attached to the statement that
// follows them, which MySQL accepts.
//
// splitSqlStatements/schemaStatements are exported for that test only — same
// reason ensureEmailVerificationColumns above has a wider export surface than
// its sibling helpers (SCHEMA_SQL itself stays private).
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");
}

export function schemaStatements(): string[] {
  return splitSqlStatements(SCHEMA_SQL);
}

async function ensureSchema(db: mysql.Pool): Promise<void> {
  for (const statement of schemaStatements()) {
    await db.query(statement);
  }
  await ensureBiddingColumns(db);
  await ensureAccountColumns(db);
  await ensureBuyItNowNullable(db);
  await ensureEndsAtNullable(db);
  await ensurePartnerLoftColumns(db);
  await ensureShowcaseNewsImageColumns(db);
  await ensureNewsBroadcastColumn(db);
  await ensureEmailVerificationColumns(db);
  await ensurePigeonShowcaseCategories(db);
}

export async function getDb(): Promise<mysql.Pool> {
  if (!pool) {
    pool = createPool();
  }
  if (!ready) {
    ready = ensureSchema(pool);
  }
  await ready;
  return pool;
}
