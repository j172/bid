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

-- Generic image+link+sort_order homepage block entries. section_type is an
-- application-level tag (currently only 'partner_loft' / 合作鴿舍) rather
-- than its own lookup table, since new section types are expected to be rare
-- and code-driven (each type gets its own homepage placement), unlike
-- pigeon_gallery_categories below which is genuinely admin-managed taxonomy.
CREATE TABLE IF NOT EXISTS homepage_sections (
  id BIGINT NOT NULL AUTO_INCREMENT,
  section_type VARCHAR(30) NOT NULL,          -- 'partner_loft' (合作鴿舍)
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
CREATE TABLE IF NOT EXISTS pigeon_gallery_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  category_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  image_file_name VARCHAR(255) NOT NULL,
  price_type VARCHAR(20) NOT NULL,            -- 'auction' (競標種鴿) | 'fixed_price' (定價種鴿)
  reference_price BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_gallery_items_category_sort (category_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
