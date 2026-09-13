CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  password_salt VARCHAR(255) NULL,
  -- Google OAuth / Identity Services unique identifier (sub claim, issue #237)
  -- NULL for accounts registered via traditional email + password.
  google_id VARCHAR(255) NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  display_name VARCHAR(50) NULL,
  phone VARCHAR(20) NULL,
  address VARCHAR(200) NULL,
  deleted_at DATETIME NULL,
  suspended_at DATETIME NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'zh-TW',
  -- Registration email-ownership proof (issue #118): FALSE for every newly
  -- registered account until POST /api/auth/verify-email confirms the token
  -- sent to their inbox (see email_verification_tokens below); the login
  -- route rejects EMAIL_OR_PASSWORD_INCORRECT-passing attempts here with
  -- EMAIL_NOT_VERIFIED instead of creating a session. Every account that
  -- existed before this column was added is grandfathered in as already
  -- verified — see lib/db.ts's ensureEmailVerificationColumns, which
  -- backfills every pre-existing row to TRUE in the same migration step that
  -- adds the column, so no current user is ever locked out by this change.
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  -- Which second factor (if any) this account requires at login (issue #93,
  -- 'totp' added by #97). 'none' | 'email_otp' | 'totp' — deliberately a
  -- single mutually-exclusive field rather than a boolean per method, since
  -- an account can only have one second factor active at a time (turning on
  -- email OTP implies turning off TOTP, and vice versa) — see
  -- lib/auth.ts's setTwoFactorMethod.
  two_factor_method VARCHAR(20) NOT NULL DEFAULT 'none',
  -- The account's confirmed TOTP shared secret (base32), set only once
  -- confirmTotpSetup (issue #97) verifies a correct code from the
  -- Authenticator app — never written directly from totp_setup_challenges.
  -- NULL whenever two_factor_method isn't 'totp'; left behind (inert) rather
  -- than eagerly cleared if the visitor later switches to Email OTP via
  -- setTwoFactorMethod directly, same "orphaned row is harmless because the
  -- mutex field is what's actually checked at login" tolerance this project
  -- already accepts for #93's email_otp_challenges after an admin disables
  -- 2FA — only lib/totp.ts's disableTotp clears it explicitly.
  totp_secret VARCHAR(64) NULL,
  -- Brute-force guard for POST /api/auth/verify-totp (issue #97 code review
  -- follow-up): unlike #93's Email OTP, a TOTP login check has no per-attempt
  -- challenge row to cap attempts on (the secret lives on the visitor's own
  -- device, nothing is emailed/issued per login try), so the cap lives on
  -- the account itself instead. totp_failed_attempts counts consecutive
  -- wrong codes (TOTP *or* backup code) at login; reaching
  -- TOTP_LOGIN_MAX_ATTEMPTS (5, see lib/totp.ts) sets totp_locked_until 15
  -- minutes out, during which verifyTotpLogin refuses to even check a
  -- submitted code. A successful verify resets both back to 0/NULL — see
  -- verifyTotpLogin's own header comment.
  totp_failed_attempts INT NOT NULL DEFAULT 0,
  totp_locked_until DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_google_id (google_id)
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

-- Registration email-ownership verification tokens (issue #118) — same
-- shape/lifecycle convention as password_reset_tokens above (token as its
-- own PK, one row per issued link, used_at NOT NULL means "spent",
-- expires_at NOW()-comparison means "24 hours came and went", request_ip
-- recorded purely for the resend endpoint's per-IP abuse limit — never used
-- to look up or validate a token). See lib/emailVerification.ts's
-- isEmailVerificationTokenValid. Issued at registration (POST
-- /api/auth/register) and reissued by POST /api/auth/resend-verification;
-- a successful POST /api/auth/verify-email sets the owning users row's
-- email_verified to TRUE and marks this row used_at, same one-time-use
-- treatment resetPassword gives password_reset_tokens.
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

-- Short-lived WebAuthn ceremony challenges (issue #95) — every passkey
-- registration/authentication is a two-step round trip (options → browser →
-- verify) and the challenge the browser signed has to be looked back up on
-- the verify step. Same shape/lifecycle convention as password_reset_tokens/
-- email_otp_challenges above (token as its own PK, used_at NOT NULL means
-- "spent", expires_at NOW()-comparison means "5 minutes came and went") but
-- purpose ('register' | 'login') keeps a registration challenge from being
-- replayed against the login-verify route or vice versa — see
-- lib/webauthn.ts's isWebauthnChallengeUsable. user_id is set for
-- registration (bound to whoever is logged in when it's requested) and NULL
-- for login (issue #95's usernameless/discoverable-credential flow — there's
-- no account to bind to until the browser itself picks a passkey). Unlike
-- those two tables, the token here never reaches client-side JS — it's
-- carried in an httpOnly cookie exactly like sessions.id, not sent back and
-- forth as request/response JSON.
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

-- Registered passkeys / WebAuthn credentials (issue #95). credential_id (the
-- browser/authenticator-issued base64url credential ID) is the primary key —
-- it's already globally unique per the WebAuthn spec, so no separate
-- surrogate id column is needed, same convention as password_reset_tokens/
-- email_otp_challenges using their own token as PK. One account can hold
-- many rows (a phone's passkey, a security key, etc — see USER ACCOUNT's
-- passkey list). public_key is the credential's COSE public key, stored as
-- its base64url encoding (see lib/webauthnCredentials.ts's toCredential/
-- isoBase64URL round-trip) rather than raw bytes, since this project's MySQL
-- columns are all text-based. counter is WebAuthn's per-credential signature
-- counter — advanced on every successful login (see
-- updateCredentialAfterLogin) as the spec's clone-detection signal.
-- device_name is the visitor's own label for this passkey ("我的 iPhone")
-- set at registration time; transports (["internal","hybrid"], etc) is
-- stored as its JSON serialization — a handful of short enum strings, never
-- queried on, so a join table would be pure overhead.
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

-- TOTP ("App 驗證碼") setup-in-progress secrets (issue #97), the fifth and
-- final account-security ticket. Same two-stage pattern webauthn_challenges
-- established for passkeys (issue #95): a freshly generated secret is
-- stashed here first, and only promoted to users.totp_secret once the
-- visitor proves they actually copied it into an Authenticator app by
-- entering a correct 6-digit code — see lib/totp.ts's confirmTotpSetup. If
-- they abandon the wizard partway, this row just expires unused and
-- users.totp_secret/two_factor_method are never touched, so a half-finished
-- setup can never lock an account into requiring a code nobody has. Same
-- shape/lifecycle convention as webauthn_challenges/email_otp_challenges
-- (token as its own PK, used_at NOT NULL means "spent", expires_at
-- NOW()-comparison means "10 minutes came and went") except there's no
-- purpose column (this table only ever serves one ceremony) and — unlike
-- webauthn_challenges's httpOnly-cookie-only token — the token here also
-- travels through the setup wizard's own request/response JSON between the
-- setup and confirm steps, same as email_otp_challenges's token.
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

-- One-time TOTP recovery codes (issue #97), generated once
-- confirmTotpSetup succeeds and shown to the visitor exactly once (see
-- app/[locale]/account/TotpSection.tsx) — the plaintext is never persisted,
-- only code_hash (sha256 of the normalized code; see lib/totp.ts's
-- hashBackupCode — a plain, unsalted hash is fine here since each code is
-- itself a high-entropy random value, not a low-entropy secret like a
-- password). One row per code (10 generated per setup — see
-- lib/totp.ts's BACKUP_CODE_COUNT); used_at NOT NULL means "already
-- redeemed at login", same one-time-use convention as every other
-- token/challenge table in this file. Cleared out entirely (DELETE) when
-- TOTP is disabled (lib/totp.ts's disableTotp) rather than kept around, so a
-- later re-enable always starts from a fresh set of 10.
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
-- application-level tag ('partner_loft' / 合作鴿舍 is the only one still in
-- use) rather than its own lookup table, since new section types are
-- expected to be rare and code-driven (each type gets its own front-end
-- placement). Issue #168 added a second tag, 'featured_loft' / 名家專區;
-- issue #176 replaced that whole mechanism with its own independent table
-- (featured_loft_posts, see below) and 'featured_loft' is no longer a valid
-- section_type for new rows — any pre-existing rows with it are harmless
-- orphaned data, deliberately left as-is (not migrated/deleted) by #176.
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
  currency VARCHAR(10) NOT NULL,              -- 'USD' | 'CNY' | 'EUR' — TWD is always the implicit base
  rate_date DATE NOT NULL,
  source_date DATE NOT NULL,
  rate DECIMAL(12,6) NOT NULL,                -- TWD per 1 unit of `currency`
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exchange_rates_currency_date (currency, rate_date),
  KEY idx_exchange_rates_currency_date (currency, rate_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 入賞鴿／進口鴿／代表種鴿 showcase entries (issue #54; 'representative' 代表種鴿
-- added by issue #170) — deliberately NOT a revival of the pigeon_gallery_*
-- tables removed in #52 ("方向錯誤"): only a small set of fixed categories
-- (no custom category table), admin CRUD + a homepage carousel/category
-- list/detail page instead of a standalone gallery. loft_id is a
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
-- source/source_url/original_title/original_content/published_at/
-- locked_by_admin (issue #240) let this same table also hold herbots.be
-- articles synced daily by lib/newsSync.ts, instead of a parallel content
-- table: `title`/`content` always hold the Traditional Chinese version
-- (hand-typed for 'manual' rows, Cloudflare-Workers-AI-translated for
-- 'herbots' rows) so every existing reader of this table keeps working
-- unchanged; original_title/original_content hold the untouched source-
-- language text, rendered underneath the translation on the detail page.
-- source_url is the herbots.be article URL used as the de-dup key (NULL on
-- manual rows — MySQL allows multiple NULLs under a UNIQUE key). published_at
-- is the article's original herbots.be publish date, used instead of
-- created_at (which is this row's *import* time) for the herbots.be
-- newest-first sort so re-running the sync doesn't reorder old articles;
-- NULL on manual rows, which fall back to created_at (see lib/news.ts's
-- ORDER BY COALESCE(published_at, created_at)). locked_by_admin flips to 1
-- the moment an admin saves an edit via app/z04urru6/news/ (any row, manual
-- or imported) — lib/newsSync.ts skips locked herbots rows on every future
-- sync so it never clobbers a manual correction. There is deliberately no
-- "hidden" column: deleting a row via the existing admin delete button
-- already removes it from every public listing, and news_import_log below
-- (not this table) is what stops a deleted/edited-away article from being
-- re-imported.
CREATE TABLE IF NOT EXISTS news_posts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  image_file_name VARCHAR(255) NULL,  -- 主圖 (issue #70); NULL only on pre-#70 rows
  content TEXT NOT NULL,           -- sanitizeDescriptionHtml'd TinyMCE HTML, 2000-char plain-text cap
  broadcast_id VARCHAR(255) NULL,  -- Resend broadcast id (issue #80); NULL until a newsletter is sent/scheduled for this post
  source VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual' | 'herbots' (issue #240)
  source_url VARCHAR(500) NULL,     -- herbots.be article URL; de-dup key; NULL on manual rows
  original_title VARCHAR(255) NULL, -- pre-translation title (herbots rows only)
  original_content TEXT NULL,       -- sanitizeDescriptionHtml'd pre-translation content (herbots rows only)
  published_at DATETIME NULL,       -- original herbots.be publish date; NULL on manual rows
  locked_by_admin TINYINT(1) NOT NULL DEFAULT 0, -- set once an admin edits this row; sync then skips it
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_news_posts_created (created_at),
  KEY idx_news_posts_source_published (source, published_at),
  UNIQUE KEY uq_news_posts_source_url (source_url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- De-dup ledger for the herbots.be news sync (issue #240) — deliberately its
-- own tiny table rather than a parallel content table: it records every
-- source_url this site has ever imported, and unlike news_posts it is never
-- deleted or edited, so it keeps blocking re-import of an article an admin
-- later deleted or hid from news_posts (the requirement a UNIQUE key on
-- news_posts.source_url alone can't satisfy once that row is gone). See
-- lib/newsImportLog.ts.
CREATE TABLE IF NOT EXISTS news_import_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  source VARCHAR(20) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  news_post_id BIGINT NULL,   -- points at news_posts.id while that row still exists; NULL once deleted
  imported_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_news_import_log_source_url (source_url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 名家專區 articles (issue #176) — replaces issue #168's lightweight
-- homepage_sections('featured_loft') cards with an independent, "文章式"
-- table modeled directly on news_posts above: full rich-text content + its
-- own detail page instead of a bare image+blurb card linking straight to
-- /listings?loft=<id>. Brand-new table, whole final schema from day one,
-- same as news_posts/contact_messages below. Deliberately NO broadcast_id
-- or any other newsletter field — unlike news_posts this feature never
-- sends a newsletter.
-- image_file_name — same NULL-only-for-rows-with-no-upload-yet story as
-- news_posts.image_file_name above (every create/edit here requires one at
-- the application layer regardless).
-- loft_id is an OPTIONAL pointer at homepage_sections(id) — same "FK to
-- homepage_sections but only rows where section_type='partner_loft'" shape
-- as pigeon_showcase.loft_id above, so it's NOT a DB-level FK (MySQL can't
-- scope one to matching rows only) and is instead checked at the
-- application layer by lib/featuredLoftPosts.ts's isPartnerLoft(), mirroring
-- lib/pigeonShowcase.ts's identical helper. NULL means the post has no
-- linked loft, in which case its detail page omits the "查看商品" button.
-- Issue #176 explicitly leaves any pre-existing
-- homepage_sections(section_type='featured_loft') rows untouched — they're
-- orphaned data this table doesn't migrate from, not something this table
-- reads.
CREATE TABLE IF NOT EXISTS featured_loft_posts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  image_file_name VARCHAR(255) NULL,
  content TEXT NOT NULL,           -- sanitizeDescriptionHtml'd TinyMCE HTML, 2000-char plain-text cap
  loft_id BIGINT NULL,             -- optional homepage_sections.id (合作鴿舍); NULL = no loft link
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_featured_loft_posts_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Public /contact form submissions (issue #104) — a brand-new table, whole
-- final schema from day one, same as pigeon_showcase/news_posts above. Every
-- verified (Cloudflare Turnstile) submission is stored here for later admin
-- review — no dedicated admin list page yet, this ticket only covers the
-- table + the write path (see lib/contact.ts's insertContactMessage,
-- called from app/api/contact/route.ts after Turnstile verification
-- succeeds). No user_id: this form doesn't require login, so a submission
-- may or may not come from a registered account and isn't linked either way.
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

-- Failed password-login attempts (issue #140 H-1) — the brute-force guard
-- for POST /api/auth/login and POST /api/auth/verify-totp, both of which
-- verify an email+password pair. Deliberately its own table rather than
-- more users.* counter columns like #97's totp_failed_attempts/
-- totp_locked_until: a password guess may target an email that has no users
-- row at all (typo, or an attacker probing a leaked address list), and those
-- attempts must be counted too — otherwise the guard would only ever apply
-- to accounts that already exist, which is also exactly the kind of
-- observable difference that leaks whether an account exists. One row per
-- *failed* attempt; a successful password check deletes that email's rows
-- (see lib/loginRateLimit.ts's clearLoginFailures), so a legitimate visitor
-- who mistypes a few times then gets it right starts from a clean slate.
-- Both limits are derived from created_at directly (same "no separate
-- rate-limit store" approach as password_reset_tokens/email_otp_challenges).
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,     -- normalized (trimmed + lowercased), same form as users.email
  request_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_login_attempts_email_created (email, created_at),
  KEY idx_login_attempts_ip_created (request_ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 官方社群影音動態指定影片 (homepage_videos) — 管理員在後台指定播放之 YouTube 影片（最多 6 則）。
-- 若本表有啟用中的記錄，首頁「官方社群影音動態」優先播放指定影片；若無記錄則自動 fallback 頻道 RSS。
CREATE TABLE IF NOT EXISTS homepage_videos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  youtube_url VARCHAR(500) NOT NULL,
  video_id VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_homepage_videos_video_id (video_id),
  KEY idx_homepage_videos_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 取鴿站地圖目錄 (issue #242 / Epic #239) — 一次性匯入自 nicepigeon.com 的全台
-- 取鴿站名錄（scripts/import-pigeon-stations.mjs，跑過一次後不排入每日
-- cron，後續由後台 CRUD 手動維護增修）。lat/lng 是匯入當下用 OpenStreetMap
-- Nominatim 對 address 做地理編碼的結果；允許 NULL 是因為原始地址偶有過於
-- 模糊（例如僅寫「OO交流道邊」）導致地理編碼失敗，此時前台地圖略過該筆、僅
-- 列表顯示，而不是讓整支匯入腳本中斷。source_url 記錄原始資料來源網址，供
-- 之後回頭核對或重新匯入時參考。
CREATE TABLE IF NOT EXISTS pigeon_stations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address VARCHAR(255) NOT NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  source_url VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_pigeon_stations_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 鴿店地圖目錄 (issue #243, part of Epic #239) — one-time crawl of
-- nicepigeon.com's 鴿店資訊 article listing (news.php?classid=8), imported
-- by scripts/import-pigeon-shops.mjs and NOT wired into the daily cron
-- scheduler (see that script's header comment — same "run once by hand"
-- shape as migrate-description-html.mjs). Content is already Traditional
-- Chinese, so unlike news_posts/featured_loft_posts there is no
-- translation step and therefore no per-locale columns. Deliberately its
-- own table rather than reusing homepage_sections/pigeon_showcase: those
-- both model curated/admin-authored content tied to a 合作鴿舍
-- (homepage_sections row), while this is a flat, address-book-shaped list
-- scraped from a third party with no loft relationship at all. Kept
-- separate from the sibling 取鴿站 directory added by issue #242 per that
-- issue's explicit "不合併成同一個地圖目錄頁" decision, even though both
-- pages share the same Leaflet/OpenStreetMap map component shape.
-- phone/address are nullable — nicepigeon's source articles are hand-typed
-- and some shop entries are genuinely missing one or the other (see the
-- import script's parser, which handles both gracefully); lat/lng are
-- nullable for the same reason (Nominatim geocoding may fail to resolve
-- an address, or a row may have no address to geocode at all) — such rows
-- still appear in the public page's list, just without a map marker.
CREATE TABLE IF NOT EXISTS pigeon_shops (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  category VARCHAR(100) NULL,         -- e.g. "賽鴿飼料-台北地區" (issue #259, cb-pigeon.com import); NULL on nicepigeon-sourced rows, which have no equivalent
  source_url VARCHAR(500) NOT NULL,   -- the nicepigeon.com news_detail.php article, or cb-pigeon.com store/view page (issue #259), this row was scraped from
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_pigeon_shops_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 鴿會查詢 (issue #260, part of Epic #239) — one-time crawl of
-- cb-pigeon.com's（凱克博賽鴿資訊網）三個區域鴿會查詢清單頁
-- (/group/{n,w,s}，各自直接列出鴿會卡片，無分頁) 逐一走訪每個
-- /group/view/{id} 明細頁，由 scripts/import-cb-pigeon-groups.mjs 匯入，
-- 同樣不掛進每日 cron（同 pigeon_shops/pigeon_stations 的「跑一次後由後台
-- CRUD 維護」慣例）。與 pigeon_shops/pigeon_stations 一樣是全新、與任何
-- 合作鴿舍/homepage_sections 無關的第三方位址簿清單，因此獨立成表，並依
-- pigeon_shops/pigeon_stations 既有「不合併成同一個地圖目錄頁」的決定，
-- 維持獨立頁面。
-- 明細頁排版極不一致（有的把會長/秘書/地址放在左欄結構化的
-- <i class="fa fa-user/fa-phone/fa-map-marker/fa-globe"> 列，有的只寫在右
-- 欄一段自由格式文字裡，兩種都要嘗試解析——見該匯入腳本 extractGroupFromHtml
-- 的實作與測試），故 chairman_name/chairman_phone/secretary_name/
-- secretary_phone/website_url/pigeon_tracking_url/address 全部允許 NULL，
-- 解析不到就留空，不中斷整支匯入。lat/lng 優先解析明細頁內嵌 Google Maps
-- embed iframe 的 `!2d<經度>!3d<緯度>!` 座標（多數明細頁其實是舊版
-- maps.google.com.tw 搜尋連結而非新版 embed，此時退回用 address 呼叫
-- OpenStreetMap Nominatim 地理編碼，仍解析不到才留 NULL）。source_url 記錄
-- cb-pigeon.com 該鴿會明細頁網址，供之後回頭核對或重新匯入時參考。
CREATE TABLE IF NOT EXISTS pigeon_groups (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(255) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  chairman_name VARCHAR(100) NULL,
  chairman_phone VARCHAR(100) NULL,
  secretary_name VARCHAR(100) NULL,
  secretary_phone VARCHAR(100) NULL,
  website_url VARCHAR(500) NULL,
  pigeon_tracking_url VARCHAR(500) NULL,
  source_url VARCHAR(500) NOT NULL,   -- the cb-pigeon.com /group/view/{id} detail page this row was scraped from
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_pigeon_groups_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 賽事資訊 (issue #241, part of Epic #239) — daily sync of two independent,
-- never-merged regional race sources into one table (lib/racesSync.ts):
-- loing-ma.com (台灣/亞洲, phpBB forum, already Traditional Chinese) and
-- herbots.be (歐洲, JSON API behind a JS-rendered page, translated via
-- lib/translate.ts same as news_posts). Modeled directly on news_posts
-- above: `title`/`content` always hold the Traditional Chinese version
-- (verbatim for loing_ma rows, Cloudflare-Workers-AI-translated for herbots
-- rows); original_title/original_content hold the pre-translation text and
-- are NULL on loing_ma rows, which were never translated (same NULL
-- convention as news_posts' 'manual' rows having no original_*).
-- source distinguishes the two independent regional feeds ('loing_ma' |
-- 'herbots') — the two are never matched/merged as the same physical race,
-- only sorted together by race_date at render time (see lib/races.ts).
-- status ('current' | 'future' | 'finished') is copied straight from
-- herbots.be's own current/future/finished collection for herbots rows;
-- loing-ma.com's forum has no such classification, so it's derived at sync
-- time by comparing the parsed race_date against "today" (Asia/Taipei).
-- race_date is the race's actual start/release date — herbots.be's
-- release_time for herbots rows, the date parsed out of the forum topic's
-- title (falling back to the topic's own post date when the title has no
-- parseable date) for loing_ma rows; nullable in case neither is available.
-- Unlike news_posts/news_import_log, a race's status/content legitimately
-- changes over time (current -> finished as herbots.be's own bucket moves
-- it, or a same-day forum post ages from "current" to "finished" overnight)
-- so this sync UPSERTs by source_url (UNIQUE below) every run instead of
-- import-once-and-skip — there is deliberately no races_import_log
-- counterpart to news_import_log, and no locked_by_admin/admin-edit concept
-- either, since issue #241 has no admin CRUD surface for this table.
-- image_file_name (封面圖) is only ever populated for herbots rows with a
-- winner photo (loing-ma.com's forum posts have no photos); NULL otherwise.
CREATE TABLE IF NOT EXISTS races (
  id BIGINT NOT NULL AUTO_INCREMENT,
  source VARCHAR(20) NOT NULL,          -- 'loing_ma' | 'herbots'
  status VARCHAR(20) NOT NULL,          -- 'current' | 'future' | 'finished'
  title VARCHAR(255) NOT NULL,          -- Traditional Chinese (translated, or verbatim for loing_ma)
  original_title VARCHAR(255) NULL,     -- pre-translation title; NULL on loing_ma rows
  content TEXT NOT NULL,                -- sanitizeDescriptionHtml'd Traditional Chinese content
  original_content TEXT NULL,           -- sanitizeDescriptionHtml'd pre-translation content; NULL on loing_ma rows
  race_date DATETIME NULL,              -- 開賽日期 (race start / release date)
  image_file_name VARCHAR(255) NULL,    -- 封面圖 (herbots winner photo only)
  source_url VARCHAR(500) NOT NULL,     -- original article/thread URL; de-dup + upsert key
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_races_source_url (source_url),
  KEY idx_races_status_date (status, race_date),
  KEY idx_races_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 新聞/賽事每日同步「最近一次執行時間」追蹤 (issue #261) — 部署/重啟後智能
-- 補跑用。這台主機重啟頻繁 (issue #81，約每 4.4 小時一次)，而新聞
-- (lib/newsSync.ts) 與賽事 (lib/racesSync.ts) 這兩個每日 cron 同步都是相對
-- 重的操作（多次外部請求 + herbots.be 內容的 Cloudflare Workers AI 翻譯
-- 呼叫），所以 lib/scheduler.ts 開機時的補跑邏輯不能像 lib/exchangeRates.ts
-- 的 STARTUP_SYNC_DELAY_MS 那樣無條件每次重啟都跑一次，而是查這張表判斷
-- 「距離上次真的跑完是否已經超過門檻」才補跑一次（見 lib/scheduler.ts 的
-- SYNC_STALENESS_THRESHOLD_HOURS 與其補跑邏輯的完整說明）。job_name 直接當
-- PK 用（'news' | 'races'）；每次 syncHerbotsNews()/syncRaces() 執行到正常
-- 回傳（不論本次是否有新資料匯入、是否夾雜 partial failure，只要不是被未預期
-- 例外中斷）就會呼叫 lib/syncRuns.ts 的 recordRunNow() 覆寫這裡的
-- last_run_at。這張表只保留「最新一次」的時間戳，不是流水帳，所以沒有
-- id/created_at 這種歷史紀錄欄位的必要。
CREATE TABLE IF NOT EXISTS sync_runs (
  job_name VARCHAR(50) NOT NULL,  -- 'news' | 'races'
  last_run_at DATETIME NOT NULL,
  PRIMARY KEY (job_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

