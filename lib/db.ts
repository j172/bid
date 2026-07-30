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
  buy_it_now_price BIGINT NOT NULL,
  ends_at DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
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

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? {} : undefined,
    connectionLimit: 5,
    multipleStatements: true,
  });
}

async function ensureSchema(db: mysql.Pool): Promise<void> {
  await db.query(SCHEMA_SQL);
  await ensureBiddingColumns(db);
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
