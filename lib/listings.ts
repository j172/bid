import { getDb } from "@/lib/db";
import {
  extendEndTimeIfNeeded,
  resolveBuyNow,
  resolveProxyBid,
  type BuyNowOutcome,
  type ProxyBidOutcome,
} from "@/lib/bidding/domain";
import { resolvePurchase, type PurchaseOutcome } from "@/lib/purchase";
import { notifyAuctionEnded, notifyOutbid, notifyPurchaseConfirmed } from "@/lib/notifications";

export type ListingType = "auction" | "fixed_price";

export interface Listing {
  id: number;
  title: string;
  description: string;
  listing_type: ListingType;
  starting_price: number;
  current_price: number;
  /** Null when the listing has no buy-it-now price (BIN is optional). Only meaningful for 'auction' listings. */
  buy_it_now_price: number | null;
  /** Unit price for 'fixed_price' listings; null for 'auction' listings. */
  price: number | null;
  /** Total stock at creation; null for 'auction' listings. */
  stock_quantity: number | null;
  /** Stock left to purchase; null for 'auction' listings. */
  stock_remaining: number | null;
  /** Null for 'fixed_price' listings (no time limit) — required for 'auction' listings. */
  ends_at: Date | null;
  status: string;
  created_by: number;
  created_at: Date;
}

export interface ListingWithPhotos extends Listing {
  photos: string[];
}

export type NewListingInput =
  | {
      listingType: "auction";
      title: string;
      description: string;
      startingPrice: number;
      buyItNowPrice: number | null;
      endsAt: Date;
      createdBy: number;
    }
  | {
      listingType: "fixed_price";
      title: string;
      description: string;
      price: number;
      stockQuantity: number;
      createdBy: number;
    };

// Split from photo storage: the listing's id (used as its photo directory
// name) only exists after this insert, so callers must insert the listing,
// then save photos to disk under that id, then call addListingPhotos.
export async function insertListing(input: NewListingInput): Promise<number> {
  const db = await getDb();

  if (input.listingType === "fixed_price") {
    const [result] = await db.query(
      `INSERT INTO listings
         (title, description, listing_type, starting_price, current_price, price, stock_quantity, stock_remaining,
          ends_at, status, created_by, created_at)
       VALUES (?, ?, 'fixed_price', ?, ?, ?, ?, ?, NULL, 'open', ?, NOW())`,
      [input.title, input.description, input.price, input.price, input.price, input.stockQuantity, input.stockQuantity, input.createdBy],
    );
    return (result as { insertId: number }).insertId;
  }

  const [result] = await db.query(
    `INSERT INTO listings
       (title, description, listing_type, starting_price, current_price, buy_it_now_price, ends_at, status, created_by, created_at)
     VALUES (?, ?, 'auction', ?, ?, ?, ?, 'open', ?, NOW())`,
    [
      input.title,
      input.description,
      input.startingPrice,
      input.startingPrice,
      input.buyItNowPrice,
      input.endsAt,
      input.createdBy,
    ],
  );
  return (result as { insertId: number }).insertId;
}

export async function addListingPhotos(listingId: number, fileNames: string[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < fileNames.length; i++) {
    await db.query(
      "INSERT INTO listing_photos (listing_id, file_name, sort_order, created_at) VALUES (?, ?, ?, NOW())",
      [listingId, fileNames[i], i],
    );
  }
}

// Used when editing a listing's photos: the caller sends the complete
// desired final order (a mix of kept-existing and newly-uploaded file
// names) rather than an incremental diff, so this just replaces the whole
// set — simpler and avoids sort_order drift from partial updates.
export async function replaceListingPhotos(listingId: number, orderedFileNames: string[]): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM listing_photos WHERE listing_id = ?", [listingId]);
  await addListingPhotos(listingId, orderedFileNames);
}

export async function deleteListing(id: number): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM listing_photos WHERE listing_id = ?", [id]);
  await db.query("DELETE FROM listings WHERE id = ?", [id]);
}

export type CancelListingOutcome = { ok: true } | { ok: false; error: string };

// Admin-only "take this down" action — distinct from closeExpiredListings'
// natural close and from a BIN sale. For auction listings, only allowed
// while the listing has never received a single bid (leader_max_amount is
// still null), so it can never retroactively invalidate a real bidder's
// win. Fixed-price listings work differently: any number of independent
// buyers can have already purchased units (there's no single "winner" to
// invalidate), so admins can delist them at any time — past purchases stay
// fully valid and trackable on the orders page regardless. Uses a distinct
// 'cancelled' status (not 'closed') so it never shows up alongside real
// settled auction sales on the admin closed-listings page.
export async function cancelListing(listingId: number): Promise<CancelListingOutcome> {
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE listings
     SET status = 'cancelled'
     WHERE id = ? AND status = 'open' AND (listing_type = 'fixed_price' OR leader_max_amount IS NULL)`,
    [listingId],
  );
  const affectedRows = (result as { affectedRows: number }).affectedRows;
  if (affectedRows === 0) {
    return { ok: false, error: "無法下架：商品不存在、已結標，或已經有人出價" };
  }
  return { ok: true };
}

export interface OpenListingForAdmin {
  id: number;
  title: string;
  listingType: ListingType;
  currentPrice: number;
  /** Null for fixed_price listings (no time limit). */
  endsAt: Date | null;
  hasBids: boolean;
  /** Null for auction listings. */
  stockQuantity: number | null;
  stockRemaining: number | null;
  /** Whether cancelListing would currently succeed — see its comment for the per-type rules. */
  canCancel: boolean;
}

export type OpenListingsSort =
  | "ends_asc"
  | "price_desc"
  | "price_asc"
  | "stock_asc"
  | "stock_desc"
  | "created_desc"
  | "created_asc";

export interface ListOpenListingsForAdminOptions {
  search?: string;
  /** The closest thing this system has to a "category" — see ListingType. */
  type?: ListingType;
  sort?: OpenListingsSort;
  page?: number;
}

export const OPEN_LISTINGS_PAGE_SIZE = 50;

const OPEN_LISTINGS_SORT_CLAUSES: Record<OpenListingsSort, string> = {
  ends_asc: "ends_at IS NULL, ends_at ASC",
  price_desc: "current_price DESC",
  price_asc: "current_price ASC",
  // stock_remaining is NULL for auction listings — pushed to the end
  // regardless of direction, since a stock sort isn't meaningful for them.
  stock_asc: "stock_remaining IS NULL, stock_remaining ASC",
  stock_desc: "stock_remaining IS NULL, stock_remaining DESC",
  created_desc: "created_at DESC",
  created_asc: "created_at ASC",
};

// Admin's open-listings management view: enough to decide whether each one
// can still be cancelled (see cancelListing's per-type rules) without
// pulling photos it doesn't need to show. Search by title, filter by
// listing type, sort, and paginate.
export async function getOpenListingsForAdmin(
  options: ListOpenListingsForAdminOptions = {},
): Promise<{ listings: OpenListingForAdmin[]; total: number }> {
  await closeExpiredListings();
  const db = await getDb();

  const conditions = ["status = 'open'"];
  const params: string[] = [];
  const search = options.search?.trim();
  if (search) {
    conditions.push("title LIKE ?");
    params.push(`%${search}%`);
  }
  if (options.type) {
    conditions.push("listing_type = ?");
    params.push(options.type);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM listings ${where}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const orderBy = OPEN_LISTINGS_SORT_CLAUSES[options.sort ?? "ends_asc"];
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * OPEN_LISTINGS_PAGE_SIZE;

  const [rows] = await db.query(
    `SELECT
       id, title, listing_type AS listingType, current_price AS currentPrice, ends_at AS endsAt,
       (leader_max_amount IS NOT NULL) AS hasBids,
       stock_quantity AS stockQuantity, stock_remaining AS stockRemaining
     FROM listings
     ${where}
     ORDER BY ${orderBy}
     LIMIT ${OPEN_LISTINGS_PAGE_SIZE} OFFSET ${offset}`,
    params,
  );
  const listings = (rows as (Omit<OpenListingForAdmin, "hasBids" | "canCancel"> & { hasBids: number })[]).map((row) => ({
    ...row,
    hasBids: Boolean(row.hasBids),
    canCancel: row.listingType === "fixed_price" || !row.hasBids,
  }));
  return { listings, total };
}

export interface OverviewStats {
  openCount: number;
  closedCount: number;
  userCount: number;
  totalGmv: number;
}

// totalGmv combines settled auction sales (listings.current_price where
// status = 'closed') with fixed_price purchase revenue (purchases.
// total_amount) — fixed_price listings never transition to 'closed'
// themselves (see cancelListing's comment), so their sales would otherwise
// be invisible to this stat.
export async function getOverviewStats(): Promise<OverviewStats> {
  await closeExpiredListings();
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM listings WHERE status = 'open') AS openCount,
       (SELECT COUNT(*) FROM listings WHERE status = 'closed') AS closedCount,
       (SELECT COUNT(*) FROM users) AS userCount,
       (SELECT COALESCE(SUM(current_price), 0) FROM listings WHERE status = 'closed')
         + (SELECT COALESCE(SUM(total_amount), 0) FROM purchases) AS totalGmv`,
  );
  return (rows as OverviewStats[])[0];
}

// Closes any listing whose end time has passed without being bought out
// first. Deliberately just a status flip: current_price and leader_user_id
// are already correct at every moment (placeBid/buyNow keep them in sync
// live), so the highest bid at the instant this runs — or the starting
// price and no leader, if the listing never got a single bid — is exactly
// the right final price/winner. Called at the top of every read/write path
// below rather than run on a schedule, since there's no background worker
// in this deployment; cheap enough (single indexed UPDATE) to run on every
// access.
export async function closeExpiredListings(): Promise<void> {
  const db = await getDb();
  await db.query(
    "UPDATE listings SET status = 'closed', close_reason = 'expired' WHERE status = 'open' AND ends_at <= NOW()",
  );
}

export async function listOpenListings(type?: ListingType): Promise<ListingWithPhotos[]> {
  await closeExpiredListings();
  const db = await getDb();
  const [rows] = type
    ? await db.query("SELECT * FROM listings WHERE status = 'open' AND listing_type = ? ORDER BY ends_at IS NULL, ends_at ASC", [
        type,
      ])
    : await db.query("SELECT * FROM listings WHERE status = 'open' ORDER BY ends_at IS NULL, ends_at ASC");
  const listings = rows as Listing[];

  const results: ListingWithPhotos[] = [];
  for (const listing of listings) {
    results.push({ ...listing, photos: await getPhotoFileNames(listing.id) });
  }
  return results;
}

export async function getListingById(id: number): Promise<ListingWithPhotos | null> {
  await closeExpiredListings();
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM listings WHERE id = ? LIMIT 1", [id]);
  const list = rows as Listing[];
  const listing = list[0];
  if (!listing) return null;

  return { ...listing, photos: await getPhotoFileNames(listing.id) };
}

export interface ClosedListingSummary {
  id: number;
  title: string;
  finalPrice: number;
  endsAt: Date;
  /** null: closed before this was tracked, shown as "未知" rather than guessed at. */
  closeReason: "expired" | "buy_now" | "auto_bin" | null;
  bidCount: number;
  /** null: no winner (zero bids). "（帳號已刪除）": winner existed but deleted their account. */
  winnerEmail: string | null;
  settled: boolean;
  /** Set when markListingSettled is called; preserved across unsettleListing so the settle form can pre-fill it. */
  settlementAccount: string | null;
  settlementAmount: number | null;
}

export const CLOSE_REASON_LABELS: Record<"expired" | "buy_now" | "auto_bin", string> = {
  expired: "競標到期",
  buy_now: "一鍵買斷",
  auto_bin: "出價自動觸發買斷",
};

export type ClosedListingStatusFilter = "all" | "settled" | "unsettled" | "no_winner";
export type ClosedListingSort = "ends_desc" | "price_desc";

export interface ListClosedListingsOptions {
  search?: string;
  winnerEmail?: string;
  status?: ClosedListingStatusFilter;
  sort?: ClosedListingSort;
  page?: number;
  /** CSV export needs every matching row, not just one page. */
  all?: boolean;
}

export const CLOSED_LISTINGS_PAGE_SIZE = 50;

const CLOSED_LISTINGS_SORT_CLAUSES: Record<ClosedListingSort, string> = {
  ends_desc: "l.ends_at DESC",
  price_desc: "l.current_price DESC",
};

function closedListingsWhereClause(options: ListClosedListingsOptions): { where: string; params: string[] } {
  const conditions = ["l.status = 'closed'"];
  const params: string[] = [];

  const search = options.search?.trim();
  if (search) {
    conditions.push("l.title LIKE ?");
    params.push(`%${search}%`);
  }
  const winnerEmail = options.winnerEmail?.trim();
  if (winnerEmail) {
    conditions.push("u.email LIKE ?");
    params.push(`%${winnerEmail}%`);
  }
  switch (options.status) {
    case "settled":
      conditions.push("l.settled_at IS NOT NULL");
      break;
    case "unsettled":
      conditions.push("l.leader_user_id IS NOT NULL AND l.settled_at IS NULL");
      break;
    case "no_winner":
      conditions.push("l.leader_user_id IS NULL");
      break;
    case "all":
    default:
      break;
  }

  return { where: `WHERE ${conditions.join(" AND ")}`, params };
}

// Admin's closed-listings/settlement view: search by title/winner email,
// filter by settlement status, sort, and paginate (or return every matching
// row via `all` for CSV export — see app/api/admin/listings/closed/export).
export async function listClosedListings(
  options: ListClosedListingsOptions = {},
): Promise<{ listings: ClosedListingSummary[]; total: number }> {
  await closeExpiredListings();
  const db = await getDb();
  const { where, params } = closedListingsWhereClause(options);

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM listings l LEFT JOIN users u ON u.id = l.leader_user_id ${where}`,
    params,
  );
  const total = (countRows as { cnt: number }[])[0].cnt;

  const orderBy = CLOSED_LISTINGS_SORT_CLAUSES[options.sort ?? "ends_desc"];
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * CLOSED_LISTINGS_PAGE_SIZE;
  const limitClause = options.all ? "" : `LIMIT ${CLOSED_LISTINGS_PAGE_SIZE} OFFSET ${offset}`;

  const [rows] = await db.query(
    `SELECT
       l.id AS id, l.title AS title, l.current_price AS finalPrice, l.ends_at AS endsAt, l.close_reason AS closeReason,
       CASE WHEN l.leader_user_id IS NULL THEN NULL
            WHEN u.deleted_at IS NOT NULL THEN '（帳號已刪除）'
            ELSE u.email END AS winnerEmail,
       (l.settled_at IS NOT NULL) AS settled,
       l.settlement_account AS settlementAccount, l.settlement_amount AS settlementAmount,
       (SELECT COUNT(*) FROM bids WHERE listing_id = l.id) AS bidCount
     FROM listings l
     LEFT JOIN users u ON u.id = l.leader_user_id
     ${where}
     ORDER BY ${orderBy}
     ${limitClause}`,
    params,
  );
  const listings = (rows as (Omit<ClosedListingSummary, "settled"> & { settled: number })[]).map((row) => ({
    ...row,
    settled: Boolean(row.settled),
  }));
  return { listings, total };
}

export interface BidderEntry {
  email: string;
  amount: number;
  bidAt: Date;
}

// Powers the closed-listings page's expandable "查看出價者" section — every
// bid on this listing (not just the winner's), oldest first.
export async function getBiddersForListing(listingId: number): Promise<BidderEntry[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT
       CASE WHEN u.deleted_at IS NOT NULL THEN '（帳號已刪除）' ELSE u.email END AS email,
       b.amount AS amount, b.created_at AS bidAt
     FROM bids b
     JOIN users u ON u.id = b.user_id
     WHERE b.listing_id = ?
     ORDER BY b.created_at ASC`,
    [listingId],
  );
  return rows as BidderEntry[];
}

// Admin confirms the offline payment/delivery is done — releases the
// winner from deleteAccount's "unsettled win" block (see
// findBlockingObligation). Records the remittance account/amount the admin
// entered (validated by lib/settlement.ts before this is called). Idempotent:
// settling twice just overwrites the previously recorded values.
export async function markListingSettled(listingId: number, account: string, amount: number): Promise<void> {
  const db = await getDb();
  await db.query(
    "UPDATE listings SET settled_at = NOW(), settlement_account = ?, settlement_amount = ? WHERE id = ? AND status = 'closed'",
    [account, amount, listingId],
  );
}

// Reverses markListingSettled — lets an admin correct an accidental
// "settled" click, putting the winner back under deleteAccount's
// unsettled-win block until it's confirmed again. Deliberately leaves
// settlement_account/settlement_amount in place (not cleared) so the settle
// form can pre-fill the last-entered values on re-settle.
export async function unsettleListing(listingId: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE listings SET settled_at = NULL WHERE id = ? AND status = 'closed'", [listingId]);
}

export interface WinnerProfile {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

// Powers the closed-listings page's expandable "得標者資料" section.
export async function getWinnerProfileForListing(listingId: number): Promise<WinnerProfile | null> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT u.display_name AS displayName, u.phone AS phone, u.address AS address
     FROM listings l
     JOIN users u ON u.id = l.leader_user_id
     WHERE l.id = ?
     LIMIT 1`,
    [listingId],
  );
  return (rows as WinnerProfile[])[0] ?? null;
}

// Used by deleteAccount (lib/auth.ts) to decide whether an account can be
// removed: never while leading an open auction (their withdrawal would
// hand a stranger's win to nobody), never while holding an unsettled
// closed win, and never while holding an unsettled fixed_price purchase
// (the admin still needs their contact details to complete the offline
// transaction in all three cases).
export async function findBlockingObligation(userId: number): Promise<string | null> {
  const db = await getDb();

  const [openRows] = await db.query(
    "SELECT 1 FROM listings WHERE status = 'open' AND leader_user_id = ? LIMIT 1",
    [userId],
  );
  if ((openRows as unknown[]).length > 0) {
    return "你目前正在領先某個開放中的商品，請等到不再領先才能刪除帳號";
  }

  const [unsettledRows] = await db.query(
    "SELECT 1 FROM listings WHERE status = 'closed' AND leader_user_id = ? AND settled_at IS NULL LIMIT 1",
    [userId],
  );
  if ((unsettledRows as unknown[]).length > 0) {
    return "你有已得標但尚未完成交易的商品，請等待管理員確認交易完成後再刪除帳號";
  }

  const [unsettledOrderRows] = await db.query(
    "SELECT 1 FROM purchases WHERE buyer_id = ? AND settled_at IS NULL LIMIT 1",
    [userId],
  );
  if ((unsettledOrderRows as unknown[]).length > 0) {
    return "你有已購買但尚未完成交易的商品，請等待管理員確認交易完成後再刪除帳號";
  }

  return null;
}

export interface ListingCreatedByUser {
  id: number;
  title: string;
  status: string;
  currentPrice: number;
  endsAt: Date | null;
}

// Only admins can create listings (see app/api/admin/listings/route.ts), so
// this is normally empty for a plain user — it's here for the admin user
// detail page in case the viewed account currently is, or previously was,
// an admin.
export async function getListingsCreatedByUser(userId: number): Promise<ListingCreatedByUser[]> {
  await closeExpiredListings();
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT id, title, status, current_price AS currentPrice, ends_at AS endsAt
     FROM listings WHERE created_by = ? ORDER BY created_at DESC`,
    [userId],
  );
  return rows as ListingCreatedByUser[];
}

export interface BidHistoryEntry {
  listingId: number;
  listingTitle: string;
  /** This bid's own amount at the time it was placed — not necessarily the listing's current price. */
  bidAmount: number;
  bidAt: Date;
  listingStatus: string;
  listingCurrentPrice: number;
  isLeading: boolean;
}

// One row per bid this user has ever placed (most recent first) — a
// listing they've bid on multiple times appears multiple times, each
// showing what the listing looks like *now*, so the user can tell active
// bids (still open, isLeading tells them if they're winning) from settled
// ones (closed, isLeading tells them if they won) at a glance.
export async function getBidHistoryForUser(userId: number): Promise<BidHistoryEntry[]> {
  await closeExpiredListings();
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT
       l.id AS listingId,
       l.title AS listingTitle,
       b.amount AS bidAmount,
       b.created_at AS bidAt,
       l.status AS listingStatus,
       l.current_price AS listingCurrentPrice,
       (l.leader_user_id = ?) AS isLeading
     FROM bids b
     JOIN listings l ON l.id = b.listing_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    [userId, userId],
  );
  return (rows as (Omit<BidHistoryEntry, "isLeading"> & { isLeading: number })[]).map((row) => ({
    ...row,
    isLeading: Boolean(row.isLeading),
  }));
}

export interface ListingStatusSnapshot {
  currentPrice: number;
  endsAt: Date;
  status: string;
}

// Lightweight read for the live-status poll (see
// app/api/listings/[id]/status/route.ts): just the three columns that can
// change after page load (current_price via bids, ends_at via anti-snipe,
// status once the auction closes) — no photo lookups needed on every poll.
export async function getListingStatus(id: number): Promise<ListingStatusSnapshot | null> {
  await closeExpiredListings();
  const db = await getDb();
  const [rows] = await db.query("SELECT current_price, ends_at, status FROM listings WHERE id = ? LIMIT 1", [id]);
  const list = rows as { current_price: number; ends_at: Date; status: string }[];
  const listing = list[0];
  if (!listing) return null;

  return { currentPrice: listing.current_price, endsAt: listing.ends_at, status: listing.status };
}

// Locks the listing row for the duration of the read-validate-write so two
// concurrent bids can't both read the same state and both succeed. Every
// bid is a private max (proxy bidding, see lib/bidding/domain.ts) — the
// leader's max is deliberately never returned to callers, only the
// resulting visible current_price.
export async function placeBid(listingId: number, userId: number, maxAmount: number): Promise<ProxyBidOutcome> {
  await closeExpiredListings();
  const db = await getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT current_price, status, leader_max_amount, leader_user_id, ends_at, buy_it_now_price, created_by FROM listings WHERE id = ? FOR UPDATE",
      [listingId],
    );
    const listing = (
      rows as {
        current_price: number;
        status: string;
        leader_max_amount: number | null;
        leader_user_id: number | null;
        ends_at: Date;
        buy_it_now_price: number | null;
        created_by: number;
      }[]
    )[0];
    if (!listing) {
      await connection.rollback();
      return { ok: false, error: "找不到這個商品" };
    }
    if (listing.created_by === userId) {
      await connection.rollback();
      return { ok: false, error: "不能對自己上架的商品出價" };
    }

    const result = resolveProxyBid(
      {
        status: listing.status,
        currentPrice: listing.current_price,
        leaderMaxAmount: listing.leader_max_amount,
        buyItNowPrice: listing.buy_it_now_price,
      },
      maxAmount,
    );
    if (!result.ok) {
      await connection.rollback();
      return result;
    }

    // A buyout closing this transaction makes extending the deadline moot.
    const newEndsAt = result.closedViaBuyItNow ? listing.ends_at : extendEndTimeIfNeeded(listing.ends_at, new Date());
    const newStatus = result.closedViaBuyItNow ? "closed" : listing.status;
    const newCloseReason = result.closedViaBuyItNow ? "auto_bin" : null;

    await connection.query(
      "UPDATE listings SET current_price = ?, leader_max_amount = ?, ends_at = ?, status = ?, close_reason = COALESCE(?, close_reason) WHERE id = ?",
      [result.currentPrice, result.leaderMaxAmount, newEndsAt, newStatus, newCloseReason, listingId],
    );
    // leader_user_id only changes when the leader actually changes — this
    // bidder's own row still gets recorded in bid history either way.
    if (result.youAreLeading) {
      await connection.query("UPDATE listings SET leader_user_id = ? WHERE id = ?", [userId, listingId]);
    }
    await connection.query(
      "INSERT INTO bids (listing_id, user_id, amount, max_amount, created_at) VALUES (?, ?, ?, ?, NOW())",
      [listingId, userId, result.currentPrice, maxAmount],
    );

    await connection.commit();

    // Fired without awaiting — a DB lookup + email round-trip must never
    // delay this function's return (see lib/notifications.ts).
    if (result.closedViaBuyItNow) {
      notifyAuctionEnded(listingId);
    } else if (result.youAreLeading && listing.leader_user_id !== null && listing.leader_user_id !== userId) {
      notifyOutbid(listingId, listing.leader_user_id);
    }

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// The explicit "Buy It Now" trigger: works identically whether or not bids
// already exist, always sells at the listing's buy_it_now_price, and
// atomically closes the listing so no further bids/buyouts can land.
export async function buyNow(listingId: number, userId: number): Promise<BuyNowOutcome> {
  await closeExpiredListings();
  const db = await getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT status, buy_it_now_price, created_by FROM listings WHERE id = ? FOR UPDATE",
      [listingId],
    );
    const listing = (rows as { status: string; buy_it_now_price: number | null; created_by: number }[])[0];
    if (!listing) {
      await connection.rollback();
      return { ok: false, error: "找不到這個商品" };
    }
    if (listing.created_by === userId) {
      await connection.rollback();
      return { ok: false, error: "不能買斷自己上架的商品" };
    }

    const result = resolveBuyNow({ status: listing.status, buyItNowPrice: listing.buy_it_now_price });
    if (!result.ok) {
      await connection.rollback();
      return result;
    }

    await connection.query(
      `UPDATE listings
       SET status = 'closed', close_reason = 'buy_now', current_price = ?, leader_user_id = ?, leader_max_amount = ?
       WHERE id = ?`,
      [result.finalPrice, userId, result.finalPrice, listingId],
    );
    await connection.query(
      "INSERT INTO bids (listing_id, user_id, amount, max_amount, created_at) VALUES (?, ?, ?, ?, NOW())",
      [listingId, userId, result.finalPrice, result.finalPrice],
    );

    await connection.commit();

    // Fired without awaiting — see the equivalent note in placeBid().
    notifyAuctionEnded(listingId);

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export type UpdateFixedPriceListingOutcome = { ok: true } | { ok: false; error: string };

// Admin edit — fixed_price listings only (auction listings have live
// bidding state that makes editing starting_price/ends_at dangerous, so
// they stay uneditable), and only while still 'open' (matches
// cancelListing's and purchaseListing's own guards). stock_quantity is
// recomputed from actual purchase history + the new stock_remaining
// (rather than taken as separate input) so the "剩餘 X / Y" display never
// goes inconsistent regardless of how many times a listing gets restocked.
export async function updateFixedPriceListing(
  listingId: number,
  input: { title: string; description: string; price: number; stockRemaining: number },
): Promise<UpdateFixedPriceListingOutcome> {
  const db = await getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT listing_type, status FROM listings WHERE id = ? FOR UPDATE", [
      listingId,
    ]);
    const listing = (rows as { listing_type: ListingType; status: string }[])[0];
    if (!listing) {
      await connection.rollback();
      return { ok: false, error: "找不到這個商品" };
    }
    if (listing.listing_type !== "fixed_price") {
      await connection.rollback();
      return { ok: false, error: "這個商品不支援編輯" };
    }
    if (listing.status !== "open") {
      await connection.rollback();
      return { ok: false, error: "已下架的商品無法編輯" };
    }

    const [soldRows] = await connection.query(
      "SELECT COALESCE(SUM(quantity), 0) AS sold FROM purchases WHERE listing_id = ?",
      [listingId],
    );
    const sold = (soldRows as { sold: number }[])[0].sold;

    await connection.query(
      `UPDATE listings
       SET title = ?, description = ?, price = ?, current_price = ?, starting_price = ?,
           stock_quantity = ?, stock_remaining = ?
       WHERE id = ?`,
      [
        input.title,
        input.description,
        input.price,
        input.price,
        input.price,
        sold + input.stockRemaining,
        input.stockRemaining,
        listingId,
      ],
    );

    await connection.commit();
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Fixed-price ("一般商品") purchase: unlike placeBid/buyNow, this never
// closes the listing itself — any number of independent buyers can keep
// purchasing from the remaining stock (see resolvePurchase's comment). The
// listing only leaves "open" via cancelListing (admin action).
export async function purchaseListing(listingId: number, buyerId: number, quantity: number): Promise<PurchaseOutcome> {
  const db = await getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT status, listing_type, price, stock_remaining, created_by FROM listings WHERE id = ? FOR UPDATE",
      [listingId],
    );
    const listing = (
      rows as {
        status: string;
        listing_type: ListingType;
        price: number | null;
        stock_remaining: number | null;
        created_by: number;
      }[]
    )[0];
    if (!listing) {
      await connection.rollback();
      return { ok: false, error: "找不到這個商品" };
    }
    if (listing.listing_type !== "fixed_price") {
      await connection.rollback();
      return { ok: false, error: "這個商品不支援直接購買" };
    }
    if (listing.created_by === buyerId) {
      await connection.rollback();
      return { ok: false, error: "不能購買自己上架的商品" };
    }

    const result = resolvePurchase(
      { status: listing.status, stockRemaining: listing.stock_remaining ?? 0 },
      quantity,
    );
    if (!result.ok) {
      await connection.rollback();
      return result;
    }

    const unitPrice = listing.price as number;
    const totalAmount = unitPrice * quantity;

    await connection.query("UPDATE listings SET stock_remaining = stock_remaining - ? WHERE id = ?", [
      quantity,
      listingId,
    ]);
    const [insertResult] = await connection.query(
      "INSERT INTO purchases (listing_id, buyer_id, quantity, unit_price, total_amount, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [listingId, buyerId, quantity, unitPrice, totalAmount],
    );

    await connection.commit();

    // Fired without awaiting — see the equivalent note in placeBid().
    notifyPurchaseConfirmed((insertResult as { insertId: number }).insertId);

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export interface OrderSummary {
  id: number;
  listingId: number;
  listingTitle: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  createdAt: Date;
  /** Every purchase has a real buyer (unlike a listing, which can have no winner) — "（帳號已刪除）" replaces the email if they later deleted their account. */
  buyerEmail: string;
  settled: boolean;
  settlementAccount: string | null;
  settlementAmount: number | null;
}

export type OrderStatusFilter = "all" | "settled" | "unsettled";
export type OrderSort = "created_desc" | "amount_desc";

export interface ListOrdersOptions {
  search?: string;
  buyerEmail?: string;
  status?: OrderStatusFilter;
  sort?: OrderSort;
  page?: number;
}

export const ORDERS_PAGE_SIZE = 50;

const ORDER_SORT_CLAUSES: Record<OrderSort, string> = {
  created_desc: "p.created_at DESC",
  amount_desc: "p.total_amount DESC",
};

// Admin's order-management view for fixed_price purchases — the equivalent
// of listClosedListings, but per-purchase rather than per-listing since a
// single fixed_price listing can be bought by many different buyers.
export async function getOrdersForAdmin(
  options: ListOrdersOptions = {},
): Promise<{ orders: OrderSummary[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  const search = options.search?.trim();
  if (search) {
    conditions.push("l.title LIKE ?");
    params.push(`%${search}%`);
  }
  const buyerEmail = options.buyerEmail?.trim();
  if (buyerEmail) {
    conditions.push("u.email LIKE ?");
    params.push(`%${buyerEmail}%`);
  }
  switch (options.status) {
    case "settled":
      conditions.push("p.settled_at IS NOT NULL");
      break;
    case "unsettled":
      conditions.push("p.settled_at IS NULL");
      break;
    case "all":
    default:
      break;
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM purchases p
     JOIN listings l ON l.id = p.listing_id
     LEFT JOIN users u ON u.id = p.buyer_id
     ${where}`,
    params,
  );
  const total = (countRows as { cnt: number }[])[0].cnt;

  const orderBy = ORDER_SORT_CLAUSES[options.sort ?? "created_desc"];
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * ORDERS_PAGE_SIZE;

  const [rows] = await db.query(
    `SELECT
       p.id AS id, p.listing_id AS listingId, l.title AS listingTitle,
       p.quantity AS quantity, p.unit_price AS unitPrice, p.total_amount AS totalAmount, p.created_at AS createdAt,
       CASE WHEN u.deleted_at IS NOT NULL THEN '（帳號已刪除）' ELSE u.email END AS buyerEmail,
       (p.settled_at IS NOT NULL) AS settled,
       p.settlement_account AS settlementAccount, p.settlement_amount AS settlementAmount
     FROM purchases p
     JOIN listings l ON l.id = p.listing_id
     LEFT JOIN users u ON u.id = p.buyer_id
     ${where}
     ORDER BY ${orderBy}
     LIMIT ${ORDERS_PAGE_SIZE} OFFSET ${offset}`,
    params,
  );
  const orders = (rows as (Omit<OrderSummary, "settled"> & { settled: number })[]).map((row) => ({
    ...row,
    settled: Boolean(row.settled),
  }));
  return { orders, total };
}

// Mirrors markListingSettled/unsettleListing (see their comments) but for
// individual purchases rather than whole listings.
export async function markOrderSettled(orderId: number, account: string, amount: number): Promise<void> {
  const db = await getDb();
  await db.query(
    "UPDATE purchases SET settled_at = NOW(), settlement_account = ?, settlement_amount = ? WHERE id = ?",
    [account, amount, orderId],
  );
}

export async function unsettleOrder(orderId: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE purchases SET settled_at = NULL WHERE id = ?", [orderId]);
}

// Powers the orders page's expandable "買家資料" section — the fixed_price
// equivalent of getWinnerProfileForListing.
export async function getBuyerProfileForOrder(orderId: number): Promise<WinnerProfile | null> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT u.display_name AS displayName, u.phone AS phone, u.address AS address
     FROM purchases p
     JOIN users u ON u.id = p.buyer_id
     WHERE p.id = ?
     LIMIT 1`,
    [orderId],
  );
  return (rows as WinnerProfile[])[0] ?? null;
}

export async function getPhotoFileNames(listingId: number): Promise<string[]> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT file_name FROM listing_photos WHERE listing_id = ? ORDER BY sort_order ASC",
    [listingId],
  );
  return (rows as { file_name: string }[]).map((row) => row.file_name);
}
