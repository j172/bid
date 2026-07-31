import { getDb } from "@/lib/db";

export const TREND_DAYS = 30;

// The last N calendar days (oldest first) as YYYY-MM-DD strings, in the
// server's own timezone (this deployment runs in UTC — see closeExpiredListings'
// callers) — used to fill in zero-activity days the SQL GROUP BY would
// otherwise just omit, so the trend charts never show a gap as "no data".
function lastNDates(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export interface DailyGmvPoint {
  date: string;
  auctionGmv: number;
  fixedPriceGmv: number;
}

// Auction GMV per day is grouped by ends_at, which for a closed listing is
// fixed at the moment it actually closed (see closeExpiredListings/buyNow/
// placeBid) — a reasonable proxy for "day of sale" without a dedicated
// closed_at column.
export async function getDailyGmvTrend(): Promise<DailyGmvPoint[]> {
  const db = await getDb();
  const dates = lastNDates(TREND_DAYS);

  const [auctionRows] = await db.query(
    `SELECT DATE(ends_at) AS date, COALESCE(SUM(current_price), 0) AS gmv
     FROM listings
     WHERE listing_type = 'auction' AND status = 'closed' AND leader_user_id IS NOT NULL
       AND ends_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(ends_at)`,
    [TREND_DAYS - 1],
  );
  const [purchaseRows] = await db.query(
    `SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount), 0) AS gmv
     FROM purchases
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)`,
    [TREND_DAYS - 1],
  );

  const auctionByDate = new Map<string, number>(
    (auctionRows as { date: string; gmv: number }[]).map((row) => [String(row.date), row.gmv]),
  );
  const purchaseByDate = new Map<string, number>(
    (purchaseRows as { date: string; gmv: number }[]).map((row) => [String(row.date), row.gmv]),
  );

  return dates.map((date) => ({
    date,
    auctionGmv: auctionByDate.get(date) ?? 0,
    fixedPriceGmv: purchaseByDate.get(date) ?? 0,
  }));
}

export interface DailyUserPoint {
  date: string;
  count: number;
}

export async function getDailyNewUserTrend(): Promise<DailyUserPoint[]> {
  const db = await getDb();
  const dates = lastNDates(TREND_DAYS);

  const [rows] = await db.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM users
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)`,
    [TREND_DAYS - 1],
  );
  const byDate = new Map<string, number>((rows as { date: string; count: number }[]).map((row) => [String(row.date), row.count]));

  return dates.map((date) => ({ date, count: byDate.get(date) ?? 0 }));
}

export interface GmvSplit {
  auctionGmv: number;
  fixedPriceGmv: number;
}

// All-time split (not limited to TREND_DAYS) — mirrors getOverviewStats'
// totalGmv, broken down by listing type instead of combined.
export async function getGmvSplitByType(): Promise<GmvSplit> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT
       (SELECT COALESCE(SUM(current_price), 0) FROM listings WHERE listing_type = 'auction' AND status = 'closed' AND leader_user_id IS NOT NULL) AS auctionGmv,
       (SELECT COALESCE(SUM(total_amount), 0) FROM purchases) AS fixedPriceGmv`,
  );
  return (rows as GmvSplit[])[0];
}

export interface PendingActionItems {
  unsettledCount: number;
  endingSoon: { id: number; title: string; endsAt: Date }[];
  lowStock: { id: number; title: string; stockRemaining: number }[];
  noWinner: { id: number; title: string }[];
}

// Powers the dashboard's "待處理事項" section — each list is capped at 10
// rows so a backlog doesn't blow up the overview page; the full picture for
// each category already lives on its own admin page (open listings,
// closed listings, orders).
export async function getPendingActionItems(): Promise<PendingActionItems> {
  const db = await getDb();

  const [unsettledRows] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM listings WHERE status = 'closed' AND leader_user_id IS NOT NULL AND settled_at IS NULL)
       + (SELECT COUNT(*) FROM purchases WHERE settled_at IS NULL) AS cnt`,
  );
  const unsettledCount = (unsettledRows as { cnt: number }[])[0].cnt;

  const [endingSoonRows] = await db.query(
    `SELECT id, title, ends_at AS endsAt
     FROM listings
     WHERE listing_type = 'auction' AND status = 'open' AND ends_at <= NOW() + INTERVAL 24 HOUR
     ORDER BY ends_at ASC
     LIMIT 10`,
  );

  const [lowStockRows] = await db.query(
    `SELECT id, title, stock_remaining AS stockRemaining
     FROM listings
     WHERE listing_type = 'fixed_price' AND status = 'open' AND stock_remaining <= 3
     ORDER BY stock_remaining ASC
     LIMIT 10`,
  );

  const [noWinnerRows] = await db.query(
    `SELECT id, title
     FROM listings
     WHERE listing_type = 'auction' AND status = 'closed' AND leader_user_id IS NULL
     ORDER BY ends_at DESC
     LIMIT 10`,
  );

  return {
    unsettledCount,
    endingSoon: endingSoonRows as { id: number; title: string; endsAt: Date }[],
    lowStock: lowStockRows as { id: number; title: string; stockRemaining: number }[],
    noWinner: noWinnerRows as { id: number; title: string }[],
  };
}

export interface TopListing {
  id: number;
  title: string;
  listingType: "auction" | "fixed_price";
  gmv: number;
}

// Top 5 by GMV, combining auction (single sale) and fixed_price (summed
// across every purchase of that listing) into one ranking.
export async function getTopListingsByGmv(): Promise<TopListing[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT id, title, listingType, gmv FROM (
       SELECT id, title, 'auction' AS listingType, current_price AS gmv
       FROM listings
       WHERE listing_type = 'auction' AND status = 'closed' AND leader_user_id IS NOT NULL
       UNION ALL
       SELECT l.id AS id, l.title AS title, 'fixed_price' AS listingType, SUM(p.total_amount) AS gmv
       FROM purchases p
       JOIN listings l ON l.id = p.listing_id
       GROUP BY l.id, l.title
     ) combined
     ORDER BY gmv DESC
     LIMIT 5`,
  );
  return rows as TopListing[];
}

export interface TopBidder {
  email: string;
  bidCount: number;
}

export async function getTopBiddersByCount(): Promise<TopBidder[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT
       CASE WHEN u.deleted_at IS NOT NULL THEN '（帳號已刪除）' ELSE u.email END AS email,
       COUNT(*) AS bidCount
     FROM bids b
     JOIN users u ON u.id = b.user_id
     GROUP BY u.id, email
     ORDER BY bidCount DESC
     LIMIT 5`,
  );
  return rows as TopBidder[];
}

export interface TopCustomer {
  email: string;
  totalSpend: number;
}

// Combines auction wins and fixed_price purchases per buyer into one
// "total spend" ranking.
export async function getTopCustomersBySpend(): Promise<TopCustomer[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT email, SUM(spend) AS totalSpend FROM (
       SELECT
         CASE WHEN u.deleted_at IS NOT NULL THEN '（帳號已刪除）' ELSE u.email END AS email,
         l.current_price AS spend
       FROM listings l
       JOIN users u ON u.id = l.leader_user_id
       WHERE l.listing_type = 'auction' AND l.status = 'closed'
       UNION ALL
       SELECT
         CASE WHEN u.deleted_at IS NOT NULL THEN '（帳號已刪除）' ELSE u.email END AS email,
         p.total_amount AS spend
       FROM purchases p
       JOIN users u ON u.id = p.buyer_id
     ) combined
     GROUP BY email
     ORDER BY totalSpend DESC
     LIMIT 5`,
  );
  return rows as TopCustomer[];
}

export interface RecentActivity {
  newUsers: { id: number; email: string; displayName: string | null; createdAt: Date }[];
  newListings: { id: number; title: string; listingType: "auction" | "fixed_price"; createdAt: Date }[];
  newBids: { id: number; listingId: number; listingTitle: string; email: string; amount: number; createdAt: Date }[];
}

export async function getRecentActivity(): Promise<RecentActivity> {
  const db = await getDb();

  const [newUserRows] = await db.query(
    `SELECT id, email, display_name AS displayName, created_at AS createdAt
     FROM users
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 10`,
  );

  const [newListingRows] = await db.query(
    `SELECT id, title, listing_type AS listingType, created_at AS createdAt
     FROM listings
     ORDER BY created_at DESC
     LIMIT 10`,
  );

  const [newBidRows] = await db.query(
    `SELECT
       b.id AS id, l.id AS listingId, l.title AS listingTitle,
       CASE WHEN u.deleted_at IS NOT NULL THEN '（帳號已刪除）' ELSE u.email END AS email,
       b.amount AS amount, b.created_at AS createdAt
     FROM bids b
     JOIN listings l ON l.id = b.listing_id
     JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC
     LIMIT 10`,
  );

  return {
    newUsers: newUserRows as RecentActivity["newUsers"],
    newListings: newListingRows as RecentActivity["newListings"],
    newBids: newBidRows as RecentActivity["newBids"],
  };
}
