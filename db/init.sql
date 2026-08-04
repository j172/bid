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
-- blocks and the pigeon showcase gallery. Both are fully decoupled from
-- `listings`: these are display-only marketing content, never real
-- transactable products.

-- Generic image+sort_order homepage block entries. section_type is an
-- application-level tag (currently only 'partner_loft' / 合作鴿舍) rather
-- than its own lookup table, since new section types are expected to be rare
-- and code-driven (each type gets its own homepage placement), unlike
-- pigeon_gallery_categories below which is genuinely admin-managed taxonomy.
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

-- Fully dynamic taxonomy for the pigeon showcase (入賞鴿展示 / 進口鴿展示):
-- admins can add/rename/remove categories freely, unlike the code-driven
-- section_type above. Category pages are auto-routed from gallery_type +
-- id (see /[locale]/pigeons/{gallery_type}/{categoryId} — a T2/T3 concern),
-- so there's no separate link_url column here.
CREATE TABLE IF NOT EXISTS pigeon_gallery_categories (
  id BIGINT NOT NULL AUTO_INCREMENT,
  gallery_type VARCHAR(20) NOT NULL,          -- 'award' (入賞鴿) | 'import' (進口鴿)
  name VARCHAR(100) NOT NULL,                 -- e.g. 石君鴿舍 / 比利時
  cover_image_file_name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_gallery_categories_type_sort (gallery_type, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual showcase pigeons within a category — display-only Gallery
-- entries (no bidding/purchase flow), deliberately with no FK to `listings`.
-- No ON DELETE CASCADE from pigeon_gallery_categories (this project doesn't
-- use FK constraints anywhere — see `listings`/`listing_photos` above), so
-- deletePigeonGalleryCategory (lib/pigeonGallery.ts) removes a category's
-- items itself before removing the category row.
-- price_type/reference_price were removed in issue #45's GRILL ME follow-up
-- along with the category page's type/price-range filter UI (a deliberate
-- simplification — the page is now pure display: photos + titles only).
-- loft_id is the same optional 合作鴿舍 single-select as listings.loft_id.
-- image_file_name is kept as a denormalized "cover photo" (issue #49) —
-- always kept in sync with the first row (by sort_order) of
-- gallery_item_photos below, so existing consumers (admin list thumbnail,
-- public category grid card) don't need to change. description is the new
-- rich-text field (issue #49), same TinyMCE + sanitize-html pattern as
-- listings.description — nullable since older rows never had one authored.
CREATE TABLE IF NOT EXISTS pigeon_gallery_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  category_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  image_file_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  loft_id BIGINT NULL,                        -- optional homepage_sections.id (合作鴿舍) this pigeon belongs to; plain-text label only, not a link
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_gallery_items_category_sort (category_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Multi-photo gallery for pigeon_gallery_items (issue #49) — mirrors
-- listing_photos' shape exactly (see above). pigeon_gallery_items.
-- image_file_name is kept as a denormalized copy of this set's first photo
-- (by sort_order) for backward-compat display; the full ordered set here is
-- what the admin ItemManager photo editor and the public item detail page
-- (/[locale]/pigeons/[galleryType]/[categoryId]/[itemId]) actually render.
-- No FK/cascade (same rationale as pigeon_gallery_items above) —
-- deletePigeonGalleryItem (lib/pigeonGallery.ts) removes a deleted item's
-- rows here explicitly, same pattern as deleteListing/listing_photos.
CREATE TABLE IF NOT EXISTS gallery_item_photos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  gallery_item_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_gallery_item_photos_item (gallery_item_id)
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
