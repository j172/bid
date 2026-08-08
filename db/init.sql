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
  suspended_at DATETIME NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'zh-TW',
  -- Which second factor (if any) this account requires at login (issue #93).
  -- 'none' | 'email_otp' | 'totp' — deliberately a single mutually-exclusive
  -- field rather than a boolean per method, since an account can only have
  -- one second factor active at a time (turning on email OTP later needs to
  -- imply turning off TOTP, and vice versa, once #93's roadmap sibling adds
  -- TOTP) — see lib/auth.ts's setTwoFactorMethod.
  two_factor_method VARCHAR(20) NOT NULL DEFAULT 'none',
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

-- Self-service "forgot password" reset tokens (issue #89). token is the
-- primary key (same 32-byte randomBytes().toString("hex") shape as
-- sessions.id, just reused as its own lookup key rather than paired with a
-- separate id column). One row per requested reset — never updated back to
-- unused, so used_at NOT NULL also means "one-time use, permanently spent"
-- and expires_at NOW()-comparison means "30 minutes came and went"; see
-- lib/passwordReset.ts's isResetTokenValid. request_ip is the requesting
-- client's IP (lib/clientIp.ts) recorded purely so the forgot-password route
-- can count recent rows per IP for its 5-per-15-minutes abuse limit — it is
-- never used to look up or validate a token.
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

-- Pending Email-OTP login challenges (issue #93) — same shape/lifecycle
-- convention as password_reset_tokens above (token as its own PK, one row
-- per issued challenge, request_ip recorded purely for the per-IP abuse
-- limit). code_hash is sha256(`${token}:${code}`) — see
-- lib/emailOtp.ts's hashEmailOtpCode — never the plaintext 6-digit code;
-- the token itself doubles as this row's per-challenge salt, so no separate
-- salt column is needed. used_at NOT NULL means "spent" (either a correct
-- verify, or attempts hit the cap and the whole challenge was invalidated —
-- see lib/emailOtp.ts's verifyEmailOtpChallenge); expires_at NOW()-comparison
-- means "10 minutes came and went". attempts counts failed verify tries and
-- is capped at EMAIL_OTP_MAX_ATTEMPTS (5) — once reached the challenge is
-- invalidated and the visitor must log in again to get a fresh code.
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

CREATE TABLE IF NOT EXISTS listings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  starting_price BIGINT NOT NULL,
  current_price BIGINT NOT NULL,
  buy_it_now_price BIGINT NULL,
  -- Optional scheduled start (auction listings only); status is 'scheduled'
  -- until this passes, then lazily flips to 'open' — see openScheduledListings
  -- in lib/listings.ts, which mirrors closeExpiredListings' pattern.
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  leader_user_id BIGINT NULL,
  leader_max_amount BIGINT NULL,
  settled_at DATETIME NULL,
  close_reason VARCHAR(20) NULL,
  settlement_account VARCHAR(30) NULL,
  settlement_amount BIGINT NULL,
  listing_type VARCHAR(20) NOT NULL DEFAULT 'auction',
  price BIGINT NULL,
  stock_quantity BIGINT NULL,
  stock_remaining BIGINT NULL,
  loft_id BIGINT NULL,                        -- optional homepage_sections.id (合作鴿舍) this listing belongs to; single-select, no DB-level FK (see below)
  winner_notified_at DATETIME NULL,           -- set on a successful "you won" email (lib/notifications.ts's notifyWinner/sendWinnerEmail, issue #48); NULL means never sent or last send failed
  PRIMARY KEY (id),
  KEY idx_listings_status_ends (status, ends_at),
  KEY idx_listings_status_starts (status, starts_at)
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
  max_amount BIGINT NOT NULL,
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

-- CMS foundation (see GitHub issue #33, spec in #32) — generic homepage CMS
-- blocks. Fully decoupled from `listings`: this is display-only marketing
-- content, never a real transactable product.

-- Generic image+sort_order homepage block entries. section_type is an
-- application-level tag (currently only 'partner_loft' / 合作鴿舍) rather
-- than its own lookup table, since new section types are expected to be rare
-- and code-driven (each type gets its own homepage placement).
-- No link_url (removed in issue #45's GRILL ME follow-up): homepage cards
-- now link to /listings?loft=<id> (that loft's listings, via listings.loft_id
-- below) rather than an admin-entered URL. bio is an optional free-text
-- excerpt shown on both the admin form and the homepage card.
CREATE TABLE IF NOT EXISTS homepage_sections (
  id BIGINT NOT NULL AUTO_INCREMENT,
  section_type VARCHAR(30) NOT NULL,          -- 'partner_loft' (合作鴿舍)
  title VARCHAR(255) NOT NULL,
  image_file_name VARCHAR(255) NOT NULL,
  bio TEXT NULL,                              -- optional 簡介 shown in admin + homepage card excerpt
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_homepage_sections_type_sort (section_type, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily TWD/USD + TWD/CNY exchange-rate history (issue #45), fetched from
-- TAIFEX's open-data feed by an in-process node-cron scheduler (see
-- lib/scheduler.ts / lib/exchangeRates.ts). rate_date is the calendar date
-- this row was synced for (usually "today"); source_date is the trading
-- date the `rate` value actually came from — falls behind rate_date when
-- TAIFEX has nothing new yet (holiday / not yet published) and the sync
-- reuses the most recent successful rate instead of leaving the day blank.
CREATE TABLE IF NOT EXISTS exchange_rates (
  id BIGINT NOT NULL AUTO_INCREMENT,
  currency VARCHAR(10) NOT NULL,              -- 'USD' | 'CNY' — TWD is always the implicit base
  rate_date DATE NOT NULL,
  source_date DATE NOT NULL,
  rate DECIMAL(12,6) NOT NULL,                -- TWD per 1 unit of `currency`
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exchange_rates_currency_date (currency, rate_date),
  KEY idx_exchange_rates_currency_date (currency, rate_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 入賞鴿／進口鴿 showcase entries (issue #54) — deliberately NOT a revival of
-- the pigeon_gallery_* tables removed in #52 ("方向錯誤"): only two fixed
-- categories (no custom category table), admin CRUD + a homepage carousel/
-- category list/detail page instead of a standalone gallery. loft_id is a
-- real DB-level FK to homepage_sections(id) (unlike listings.loft_id, which
-- stays a plain BIGINT per its own comment above) because this ticket
-- explicitly requires deletes of a still-referenced 合作鴿舍 to be rejected
-- rather than silently cascaded/nulled — see ON DELETE/UPDATE RESTRICT below
-- (RESTRICT is InnoDB's default when unspecified too; spelled out here for
-- clarity) and deleteHomepageSection's ER_ROW_IS_REFERENCED_2 handling in
-- lib/homepageSections.ts. MySQL foreign keys can't be scoped to only rows
-- matching section_type = 'partner_loft' — that check is enforced at the
-- application layer (lib/pigeonShowcase.ts) on write instead.
-- image_file_name (issue #70) is the 主圖 (main image), stored/served the
-- same way as homepage_sections.image_file_name (see lib/uploads.ts's
-- savePigeonShowcaseImage/pigeonShowcaseImageUrl). NULL-able at the DB level
-- only so rows created before #70 don't need a synthetic backfill value —
-- the admin form (PigeonShowcaseFormModal.tsx) and its API routes require an
-- upload on every create/edit, so every row written after #70 always has one.
CREATE TABLE IF NOT EXISTS pigeon_showcase (
  id BIGINT NOT NULL AUTO_INCREMENT,
  category ENUM('award','imported') NOT NULL,  -- 'award' 入賞鴿 | 'imported' 進口鴿
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

-- 最新訊息 announcements (issue #56) — public, browsable news/announcement
-- content rendered on /news and /news/[id] plus a homepage carousel.
-- Simpler than pigeon_showcase above — no FK, no dropdown/category
-- dependency, id is never shown publicly (U/D operate on it from the admin
-- list only).
-- image_file_name (issue #70) is the 主圖 (main image) — same NULL-able-only-
-- for-pre-#70-rows story as pigeon_showcase.image_file_name above.
-- broadcast_id (issue #80) links a post to the Resend broadcast sent for it
-- when an admin opts in via NewsFormModal's "同時發送電子報" checkbox — the
-- newsletter feature (lib/newsletter.ts) is no longer a standalone
-- compose/send flow (app/z04urru6/newsletter/ removed) and only ever sends
-- broadcasts tied to a news_posts row. NULL when no newsletter has ever been
-- associated with the post. Status/schedule/subject are never cached here —
-- always read live from Resend via lib/newsletter.ts's listBroadcasts/
-- getBroadcast so there's a single source of truth.
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
