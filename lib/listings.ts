import { getDb } from "@/lib/db";
import {
  extendEndTimeIfNeeded,
  resolveBuyNow,
  resolveProxyBid,
  type BuyNowOutcome,
  type ProxyBidOutcome,
} from "@/lib/bidding/domain";
import { resolvePurchase, type PurchaseOutcome } from "@/lib/purchase";
import { notifyAuctionEnded, notifyOutbid, notifyPurchaseConfirmed, notifyWinner } from "@/lib/notifications";
import type { ErrorCode } from "@/lib/errorCodes";
import { tokenizeSearchQuery } from "@/lib/search";
import { AUCTION_GMV_SUBQUERY, FIXED_PRICE_GMV_SUBQUERY, deletedAccountEmail } from "@/lib/sqlFragments";

// Note on listings.starts_at: this module used to probe information_schema
// for that column on first use and degrade to a no-scheduling code path when
// it was missing (legacy already-deployed databases). That fallback was
// unreachable — getDb() awaits ensureSchema() before ever handing back a
// pool, and ensureSchema -> ensureAccountColumns unconditionally runs
// ensureColumn(listings, starts_at) — so the column is guaranteed to exist
// for every query in this file, and the probe/cache/fallback branches were
// removed as dead code (issue #139).

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
  /** Auction listings only — null means "opens immediately" (status starts as 'open', never 'scheduled'). */
  starts_at: Date | null;
  status: string;
  created_by: number;
  created_at: Date;
  /** Optional 合作鴿舍 (homepage_sections.id) this listing belongs to (issue #45) — null when not set. No DB-level FK (see db/init.sql). */
  loft_id: number | null;
}

export interface ListingWithPhotos extends Listing {
  photos: string[];
}

export type NewListingInput = (
  | {
      listingType: "auction";
      title: string;
      description: string;
      startingPrice: number;
      buyItNowPrice: number | null;
      /** Optional — null means the listing opens immediately (status 'open'), matching pre-existing behavior. */
      startsAt: Date | null;
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
    }
) & {
  /** Optional 合作鴿舍 selection (issue #45) — null/omit for none. */
  loftId?: number | null;
};

// Split from photo storage: the listing's id (used as its photo directory
// name) only exists after this insert, so callers must insert the listing,
// then save photos to disk under that id, then call addListingPhotos.
export async function insertListing(input: NewListingInput): Promise<number> {
  const db = await getDb();
  const loftId = input.loftId ?? null;

  if (input.listingType === "fixed_price") {
    const [result] = await db.query(
      `INSERT INTO listings
         (title, description, listing_type, starting_price, current_price, price, stock_quantity, stock_remaining,
          ends_at, status, created_by, created_at, loft_id)
       VALUES (?, ?, 'fixed_price', ?, ?, ?, ?, ?, NULL, 'open', ?, NOW(), ?)`,
      [
        input.title,
        input.description,
        input.price,
        input.price,
        input.price,
        input.stockQuantity,
        input.stockQuantity,
        input.createdBy,
        loftId,
      ],
    );
    return (result as { insertId: number }).insertId;
  }

  // A start time in the future means the listing waits in 'scheduled' until
  // openScheduledListings() flips it; no start time means it opens now.
  const status = input.startsAt !== null ? "scheduled" : "open";
  const [result] = await db.query(
    `INSERT INTO listings
       (title, description, listing_type, starting_price, current_price, buy_it_now_price, starts_at, ends_at, status, created_by, created_at, loft_id)
     VALUES (?, ?, 'auction', ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [
      input.title,
      input.description,
      input.startingPrice,
      input.startingPrice,
      input.buyItNowPrice,
      input.startsAt,
      input.endsAt,
      status,
      input.createdBy,
      loftId,
    ],
  );

  return (result as { insertId: number }).insertId;
}

// Used by the create-listing route to backfill the final description HTML
// once inline description images have been saved to disk and their `cid:N`
// placeholders resolved to real URLs — insertListing itself has to run
// first (its own id names the photo/description-image directory), so the
// row briefly holds the placeholder-only description in between.
export async function updateListingDescription(listingId: number, description: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE listings SET description = ? WHERE id = ?", [description, listingId]);
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
// win — this is automatically true for every still-'scheduled' listing,
// since bidding is blocked until it opens (see resolveProxyBid/resolveBuyNow),
// so a scheduled listing can always be pulled before it goes live. Fixed-price
// listings work differently: any number of independent buyers can have
// already purchased units (there's no single "winner" to invalidate), so
// admins can delist them at any time — past purchases stay fully valid and
// trackable on the orders page regardless. Uses a distinct 'cancelled' status
// (not 'closed') so it never shows up alongside real settled auction sales on
// the admin closed-listings page.
export async function cancelListing(listingId: number): Promise<CancelListingOutcome> {
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE listings
     SET status = 'cancelled'
     WHERE id = ? AND status IN ('open', 'scheduled') AND (listing_type = 'fixed_price' OR leader_max_amount IS NULL)`,
    [listingId],
  );
  const affectedRows = (result as { affectedRows: number }).affectedRows;
  if (affectedRows === 0) {
    return { ok: false, error: "無法下架：商品不存在、已結標，或已經有人出價" };
  }
  return { ok: true };
}

export type RelistOutcome =
  | { ok: true; newListingId: number; photoFileNames: string[] }
  | { ok: false; error: string };

// Admin-only "sell it again" action for a closed auction listing that got
// zero bids — a listing with a real winner must never be touched by this
// (see getClosedListings' winnerEmail). Creates a brand-new, independent
// listing (same title/description/photos, fresh price/end-time from the
// admin's input) rather than reopening the old one, so the original stays
// exactly as-is in the closed-listings history. Returns the old listing's
// photo file names rather than copying them itself — actual file I/O stays
// at the API route layer (see app/api/admin/listings/[id]/relist), matching
// how listing creation already splits DB insert from saveListingPhotos.
export async function relistClosedListing(
  listingId: number,
  input: { startingPrice: number; buyItNowPrice: number | null; startsAt: Date | null; endsAt: Date },
): Promise<RelistOutcome> {
  const db = await getDb();

  const [rows] = await db.query(
    "SELECT title, description, listing_type, status, leader_user_id, created_by FROM listings WHERE id = ? LIMIT 1",
    [listingId],
  );
  const listing = (
    rows as {
      title: string;
      description: string;
      listing_type: ListingType;
      status: string;
      leader_user_id: number | null;
      created_by: number;
    }[]
  )[0];
  if (!listing) {
    return { ok: false, error: "找不到這個商品" };
  }
  if (listing.listing_type !== "auction") {
    return { ok: false, error: "這個商品不支援重新上架" };
  }
  if (listing.status !== "closed") {
    return { ok: false, error: "只有已結標的商品可以重新上架" };
  }
  if (listing.leader_user_id !== null) {
    return { ok: false, error: "已有得標者的商品無法重新上架" };
  }

  const newListingId = await insertListing({
    listingType: "auction",
    title: listing.title,
    description: listing.description,
    startingPrice: input.startingPrice,
    buyItNowPrice: input.buyItNowPrice,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    createdBy: listing.created_by,
  });

  const photoFileNames = await getPhotoFileNames(listingId);
  return { ok: true, newListingId, photoFileNames };
}

export interface OpenListingForAdmin {
  id: number;
  title: string;
  listingType: ListingType;
  /** 'open' or 'scheduled' — this view includes not-yet-started auctions too. */
  status: string;
  currentPrice: number;
  /** Null for fixed_price listings (no time limit). */
  endsAt: Date | null;
  /** Auction listings only — set while status is 'scheduled'. */
  startsAt: Date | null;
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
  await syncListingLifecycle();
  const db = await getDb();

  // Scheduled (not-yet-started) auctions belong in this view too — admins
  // still need to see/edit/cancel them before they go live.
  const conditions = ["status IN ('open', 'scheduled')"];
  const params: string[] = [];
  const search = options.search?.trim();
  if (search) {
    // Segment into keywords so a multi-word query like "石君 回血" matches
    // listings containing both words rather than failing on the literal
    // space (see issue #105). Each keyword must match title OR description;
    // keywords are AND'd together. Falls back to the previous whole-string
    // match if segmentation yields no usable tokens (e.g. all punctuation),
    // so search never silently drops the filter and returns everything.
    const tokens = tokenizeSearchQuery(search);
    const searchTerms = tokens.length > 0 ? tokens : [search];
    for (const term of searchTerms) {
      conditions.push("(title LIKE ? OR description LIKE ?)");
      params.push(`%${term}%`, `%${term}%`);
    }
  }
  if (options.type) {
    conditions.push("listing_type = ?");
    params.push(options.type);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM listings ${where}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const orderBy = OPEN_LISTINGS_SORT_CLAUSES[options.sort ?? "ends_asc"];
  // Rank title/description hits on the full original query above everything
  // else that only matched via individual keyword segments.
  const orderByExpr = search ? `CASE WHEN title LIKE ? THEN 0 ELSE 1 END, ${orderBy}` : orderBy;
  const selectParams = search ? [...params, `%${search}%`] : params;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * OPEN_LISTINGS_PAGE_SIZE;

  const [rows] = await db.query(
    `SELECT
       id, title, listing_type AS listingType, status, current_price AS currentPrice, ends_at AS endsAt, starts_at AS startsAt,
       (leader_max_amount IS NOT NULL) AS hasBids,
       stock_quantity AS stockQuantity, stock_remaining AS stockRemaining
     FROM listings
     ${where}
     ORDER BY ${orderByExpr}
     LIMIT ${OPEN_LISTINGS_PAGE_SIZE} OFFSET ${offset}`,
    selectParams,
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

// totalGmv combines sold auctions (listings.current_price) with fixed_price
// purchase revenue (purchases.total_amount) — fixed_price listings never
// transition to 'closed' themselves (see cancelListing's comment), so their
// sales would otherwise be invisible to this stat. Both halves come from
// lib/sqlFragments.ts so this stays byte-for-byte the same definition
// lib/dashboard.ts' getGmvSplitByType breaks down by type: this query used
// to filter on status = 'closed' alone, which counted every zero-bid expired
// auction's starting_price as revenue and made the overview card disagree
// with every chart on the dashboard (issue #139).
export async function getOverviewStats(): Promise<OverviewStats> {
  await syncListingLifecycle();
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM listings WHERE status = 'open') AS openCount,
       (SELECT COUNT(*) FROM listings WHERE status = 'closed') AS closedCount,
       (SELECT COUNT(*) FROM users) AS userCount,
       ${AUCTION_GMV_SUBQUERY} + ${FIXED_PRICE_GMV_SUBQUERY} AS totalGmv`,
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
// access. Also fires notifyWinner (issue #48) for any listing this sweep is
// about to close that actually has a winner (leader_user_id set) — a
// zero-bid listing has nobody to congratulate, so it's excluded from the
// pre-UPDATE lookup below rather than left to notifyWinner's own no-row
// no-op, keeping the notify loop tight to only real winners.
export async function closeExpiredListings(): Promise<void> {
  const db = await getDb();
  const [winnerRows] = await db.query(
    "SELECT id FROM listings WHERE status = 'open' AND ends_at <= NOW() AND leader_user_id IS NOT NULL",
  );
  const winningListingIds = (winnerRows as { id: number }[]).map((row) => row.id);

  await db.query(
    "UPDATE listings SET status = 'closed', close_reason = 'expired' WHERE status = 'open' AND ends_at <= NOW()",
  );

  // Fired without awaiting — see the equivalent note in placeBid().
  for (const listingId of winningListingIds) {
    notifyWinner(listingId);
  }
}

// Opens any listing whose scheduled start time has passed — the mirror image
// of closeExpiredListings above (same lazy-sweep-on-every-access pattern, no
// background worker in this deployment). Must run before closeExpiredListings
// in syncListingLifecycle so a listing whose starts_at and ends_at have *both*
// already passed (e.g. the admin scheduled a very short auction and nobody
// looked at it in time) still passes through 'open' on its way to 'closed'
// rather than getting stuck in 'scheduled' forever — closeExpiredListings only
// ever matches status = 'open'.
export async function openScheduledListings(): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE listings SET status = 'open' WHERE status = 'scheduled' AND starts_at <= NOW()");
}

// The single entry point every read/write path below calls instead of
// closeExpiredListings directly — keeps both lazy sweeps (start, then end) in
// sync at every access without every call site needing to know both exist.
export async function syncListingLifecycle(): Promise<void> {
  await openScheduledListings();
  await closeExpiredListings();
}

export interface ListingCardExtras {
  /** Auction only — the current leader's raw (unmasked) display name; null if no bids yet or the leader never set one. */
  leaderDisplayName: string | null;
  /** Auction only. */
  bidCount: number;
  /** Fixed-price only. */
  purchaseCount: number;
  /** Partner loft (homepage_sections.title) this listing belongs to, if any (issue #45) — shown as a plain-text label, never a link, on the public card. */
  loftName: string | null;
}

export interface ListOpenListingsOptions {
  /** Filters to listings belonging to this homepage_sections.id (合作鴿舍) — powers /listings?loft=<id> (issue #45). */
  loftId?: number;
}

// Powers the public listings grid's cards (see app/listings/page.tsx) —
// beyond the base listing row, each card also shows who's currently
// leading (masked — see lib/mask.ts) and how much activity the listing has
// had, via a LEFT JOIN + correlated subqueries rather than a per-row loop.
export async function listOpenListings(
  type?: ListingType,
  options: ListOpenListingsOptions = {},
): Promise<(ListingWithPhotos & ListingCardExtras)[]> {
  await syncListingLifecycle();
  const db = await getDb();

  // Scheduled (not-yet-started) auctions are included too — they're shown
  // publicly with a "starts at" badge instead of a bid button (bidding
  // itself stays blocked server-side, see resolveProxyBid/resolveBuyNow).
  const conditions = ["l.status IN ('open', 'scheduled')"];
  const params: (string | number)[] = [];
  if (type) {
    conditions.push("l.listing_type = ?");
    params.push(type);
  }
  if (options.loftId !== undefined) {
    conditions.push("l.loft_id = ?");
    params.push(options.loftId);
  }

  const [rows] = await db.query(
    `SELECT
       l.*, u.display_name AS leaderDisplayName, loft.title AS loftName,
       (SELECT COUNT(*) FROM bids WHERE listing_id = l.id) AS bidCount,
       (SELECT COUNT(*) FROM purchases WHERE listing_id = l.id) AS purchaseCount
     FROM listings l
     LEFT JOIN users u ON u.id = l.leader_user_id
     LEFT JOIN homepage_sections loft ON loft.id = l.loft_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY l.ends_at IS NULL, l.ends_at ASC`,
    params,
  );
  const listings = rows as (Listing & ListingCardExtras)[];

  const results: (ListingWithPhotos & ListingCardExtras)[] = [];
  for (const listing of listings) {
    results.push({ ...listing, photos: await getPhotoFileNames(listing.id) });
  }
  return results;
}

export async function getListingById(id: number): Promise<ListingWithPhotos | null> {
  await syncListingLifecycle();
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
  /** Set on a successful notifyWinner/sendWinnerEmail send (issue #48); null if never sent or the last attempt failed — WinnerExpand offers a resend in that case. Always null when there's no winner. */
  winnerNotifiedAt: Date | null;
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
    // See getOpenListingsForAdmin's comment for why this segments the query
    // and matches title/description per keyword (issue #105).
    const tokens = tokenizeSearchQuery(search);
    const searchTerms = tokens.length > 0 ? tokens : [search];
    for (const term of searchTerms) {
      conditions.push("(l.title LIKE ? OR l.description LIKE ?)");
      params.push(`%${term}%`, `%${term}%`);
    }
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
  await syncListingLifecycle();
  const db = await getDb();
  const { where, params } = closedListingsWhereClause(options);

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM listings l LEFT JOIN users u ON u.id = l.leader_user_id ${where}`,
    params,
  );
  const total = (countRows as { cnt: number }[])[0].cnt;

  const search = options.search?.trim();
  const orderBy = CLOSED_LISTINGS_SORT_CLAUSES[options.sort ?? "ends_desc"];
  // Rank title/description hits on the full original query above everything
  // else that only matched via individual keyword segments.
  const orderByExpr = search ? `CASE WHEN l.title LIKE ? THEN 0 ELSE 1 END, ${orderBy}` : orderBy;
  const selectParams = search ? [...params, `%${search}%`] : params;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * CLOSED_LISTINGS_PAGE_SIZE;
  const limitClause = options.all ? "" : `LIMIT ${CLOSED_LISTINGS_PAGE_SIZE} OFFSET ${offset}`;

  const [rows] = await db.query(
    `SELECT
       l.id AS id, l.title AS title, l.current_price AS finalPrice, l.ends_at AS endsAt, l.close_reason AS closeReason,
       ${deletedAccountEmail("u", { nullWhen: "l.leader_user_id IS NULL" })} AS winnerEmail,
       (l.settled_at IS NOT NULL) AS settled,
       l.settlement_account AS settlementAccount, l.settlement_amount AS settlementAmount,
       l.winner_notified_at AS winnerNotifiedAt,
       (SELECT COUNT(*) FROM bids WHERE listing_id = l.id) AS bidCount
     FROM listings l
     LEFT JOIN users u ON u.id = l.leader_user_id
     ${where}
     ORDER BY ${orderByExpr}
     ${limitClause}`,
    selectParams,
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
       ${deletedAccountEmail("u")} AS email,
       b.amount AS amount, b.created_at AS bidAt
     FROM bids b
     JOIN users u ON u.id = b.user_id
     WHERE b.listing_id = ?
     ORDER BY b.created_at ASC`,
    [listingId],
  );
  return rows as BidderEntry[];
}

export interface ListingActivityEntry {
  /** Raw (unmasked) display name — callers mask via lib/mask.ts before rendering, same convention as leaderDisplayName in ListingCardExtras. */
  displayName: string | null;
  amount: number;
  createdAt: Date;
}

export interface ListingActivityFeed {
  /** Total number of bids/purchases ever recorded for this listing — not just the entries returned below. */
  totalCount: number;
  /** Newest first, capped at ACTIVITY_FEED_LIMIT. */
  entries: ListingActivityEntry[];
}

const ACTIVITY_FEED_LIMIT = 20;

// Powers the public listing detail page's "出價與交易動態" tab (issue #45,
// replacing the old static-copy reviews tab) — auction listings source from
// `bids`, fixed_price listings from `purchases`. Public/no-login-required,
// so unlike getBiddersForListing (admin-only, joins users.email) this joins
// users.display_name for the page to mask via maskDisplayName instead of
// exposing email addresses. Deliberately returns only a total count rather
// than per-bidder sequence numbers (see issue #45's acceptance criteria).
export async function getListingActivityFeed(
  listingId: number,
  listingType: ListingType,
): Promise<ListingActivityFeed> {
  const db = await getDb();

  if (listingType === "fixed_price") {
    const [countRows] = await db.query("SELECT COUNT(*) AS cnt FROM purchases WHERE listing_id = ?", [listingId]);
    const totalCount = (countRows as { cnt: number }[])[0].cnt;
    const [rows] = await db.query(
      `SELECT u.display_name AS displayName, p.total_amount AS amount, p.created_at AS createdAt
       FROM purchases p
       JOIN users u ON u.id = p.buyer_id
       WHERE p.listing_id = ?
       ORDER BY p.created_at DESC
       LIMIT ${ACTIVITY_FEED_LIMIT}`,
      [listingId],
    );
    return { totalCount, entries: rows as ListingActivityEntry[] };
  }

  const [countRows] = await db.query("SELECT COUNT(*) AS cnt FROM bids WHERE listing_id = ?", [listingId]);
  const totalCount = (countRows as { cnt: number }[])[0].cnt;
  const [rows] = await db.query(
    `SELECT u.display_name AS displayName, b.amount AS amount, b.created_at AS createdAt
     FROM bids b
     JOIN users u ON u.id = b.user_id
     WHERE b.listing_id = ?
     ORDER BY b.created_at DESC
     LIMIT ${ACTIVITY_FEED_LIMIT}`,
    [listingId],
  );
  return { totalCount, entries: rows as ListingActivityEntry[] };
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

// Used by the admin "重新寄送得標信" resend route (issue #48,
// app/api/admin/listings/[id]/notify-winner) to read back the freshly-set
// winner_notified_at after sendWinnerEmail succeeds, so the response can
// hand the client the exact DB value instead of approximating with new Date().
export async function getWinnerNotifiedAt(listingId: number): Promise<Date | null> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT winner_notified_at AS winnerNotifiedAt FROM listings WHERE id = ? LIMIT 1",
    [listingId],
  );
  const row = (rows as { winnerNotifiedAt: Date | null }[])[0];
  return row?.winnerNotifiedAt ?? null;
}

// Used by deleteAccount (lib/auth.ts) to decide whether an account can be
// removed: never while leading an open auction (their withdrawal would
// hand a stranger's win to nobody), never while holding an unsettled
// closed win, and never while holding an unsettled fixed_price purchase
// (the admin still needs their contact details to complete the offline
// transaction in all three cases).
export async function findBlockingObligation(userId: number): Promise<ErrorCode | null> {
  const db = await getDb();

  const [openRows] = await db.query(
    "SELECT 1 FROM listings WHERE status = 'open' AND leader_user_id = ? LIMIT 1",
    [userId],
  );
  if ((openRows as unknown[]).length > 0) {
    return "LEADING_OPEN_LISTING";
  }

  const [unsettledRows] = await db.query(
    "SELECT 1 FROM listings WHERE status = 'closed' AND leader_user_id = ? AND settled_at IS NULL LIMIT 1",
    [userId],
  );
  if ((unsettledRows as unknown[]).length > 0) {
    return "UNSETTLED_WIN";
  }

  const [unsettledOrderRows] = await db.query(
    "SELECT 1 FROM purchases WHERE buyer_id = ? AND settled_at IS NULL LIMIT 1",
    [userId],
  );
  if ((unsettledOrderRows as unknown[]).length > 0) {
    return "UNSETTLED_PURCHASE";
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
  await syncListingLifecycle();
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
  await syncListingLifecycle();
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
  /** Auction listings only — set while status is 'scheduled'. */
  startsAt: Date | null;
  status: string;
}

// Lightweight read for the live-status poll (see
// app/api/listings/[id]/status/route.ts): just the columns that can change
// after page load (current_price via bids, ends_at via anti-snipe, status
// once the auction opens/closes) — no photo lookups needed on every poll.
export async function getListingStatus(id: number): Promise<ListingStatusSnapshot | null> {
  await syncListingLifecycle();
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT current_price, ends_at, starts_at, status FROM listings WHERE id = ? LIMIT 1",
    [id],
  );
  const list = rows as { current_price: number; ends_at: Date; starts_at: Date | null; status: string }[];
  const listing = list[0];
  if (!listing) return null;

  return {
    currentPrice: listing.current_price,
    endsAt: listing.ends_at,
    startsAt: listing.starts_at ?? null,
    status: listing.status,
  };
}

// Locks the listing row for the duration of the read-validate-write so two
// concurrent bids can't both read the same state and both succeed. Every
// bid is a private max (proxy bidding, see lib/bidding/domain.ts) — the
// leader's max is deliberately never returned to callers, only the
// resulting visible current_price.
export async function placeBid(listingId: number, userId: number, maxAmount: number): Promise<ProxyBidOutcome> {
  await syncListingLifecycle();
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
      return { ok: false, errorCode: "NOT_FOUND" };
    }
    if (listing.created_by === userId) {
      await connection.rollback();
      return { ok: false, errorCode: "CANNOT_ACT_ON_OWN_LISTING" };
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
      notifyWinner(listingId);
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
  await syncListingLifecycle();
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
      return { ok: false, errorCode: "NOT_FOUND" };
    }
    if (listing.created_by === userId) {
      await connection.rollback();
      return { ok: false, errorCode: "CANNOT_ACT_ON_OWN_LISTING" };
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
    notifyWinner(listingId);

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
  input: {
    title: string;
    description: string;
    price: number;
    stockRemaining: number;
    /** Optional loft selection (issue #45) — like every other field here, this is a full replace: omit/null clears loft_id. */
    loftId?: number | null;
  },
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
           stock_quantity = ?, stock_remaining = ?, loft_id = ?
       WHERE id = ?`,
      [
        input.title,
        input.description,
        input.price,
        input.price,
        input.price,
        sold + input.stockRemaining,
        input.stockRemaining,
        input.loftId ?? null,
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

export type UpdateListingStartsAtOutcome = { ok: true } | { ok: false; error: string };

// Admin edit — lets a mistyped/changed-of-mind start time be corrected on a
// still-'scheduled' auction, without cancelling and recreating the whole
// listing. Deliberately much narrower than a full auction edit (which stays
// unsupported — see updateFixedPriceListing's comment on why live bidding
// state makes that dangerous): this only ever touches starts_at, and only
// while status is still 'scheduled', i.e. before any bidding could possibly
// have happened, so none of that risk applies here. Passing startsAt: null
// clears the schedule and opens the listing immediately, same as if it had
// never had a start time at all.
export async function updateListingStartsAt(listingId: number, startsAt: Date | null): Promise<UpdateListingStartsAtOutcome> {
  await syncListingLifecycle();
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE listings
     SET starts_at = ?, status = ?
     WHERE id = ? AND status = 'scheduled' AND listing_type = 'auction'`,
    [startsAt, startsAt !== null ? "scheduled" : "open", listingId],
  );
  const affectedRows = (result as { affectedRows: number }).affectedRows;
  if (affectedRows === 0) {
    return { ok: false, error: "無法更新起標時間：商品不存在或已經開標" };
  }
  return { ok: true };
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
      return { ok: false, errorCode: "NOT_FOUND" };
    }
    if (listing.listing_type !== "fixed_price") {
      await connection.rollback();
      return { ok: false, errorCode: "LISTING_NOT_FIXED_PRICE" };
    }
    if (listing.created_by === buyerId) {
      await connection.rollback();
      return { ok: false, errorCode: "CANNOT_ACT_ON_OWN_LISTING" };
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
    // See getOpenListingsForAdmin's comment for why this segments the query
    // and matches title/description per keyword (issue #105).
    const tokens = tokenizeSearchQuery(search);
    const searchTerms = tokens.length > 0 ? tokens : [search];
    for (const term of searchTerms) {
      conditions.push("(l.title LIKE ? OR l.description LIKE ?)");
      params.push(`%${term}%`, `%${term}%`);
    }
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
  // Rank title/description hits on the full original query above everything
  // else that only matched via individual keyword segments.
  const orderByExpr = search ? `CASE WHEN l.title LIKE ? THEN 0 ELSE 1 END, ${orderBy}` : orderBy;
  const selectParams = search ? [...params, `%${search}%`] : params;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * ORDERS_PAGE_SIZE;

  const [rows] = await db.query(
    `SELECT
       p.id AS id, p.listing_id AS listingId, l.title AS listingTitle,
       p.quantity AS quantity, p.unit_price AS unitPrice, p.total_amount AS totalAmount, p.created_at AS createdAt,
       ${deletedAccountEmail("u")} AS buyerEmail,
       (p.settled_at IS NOT NULL) AS settled,
       p.settlement_account AS settlementAccount, p.settlement_amount AS settlementAmount
     FROM purchases p
     JOIN listings l ON l.id = p.listing_id
     LEFT JOIN users u ON u.id = p.buyer_id
     ${where}
     ORDER BY ${orderByExpr}
     LIMIT ${ORDERS_PAGE_SIZE} OFFSET ${offset}`,
    selectParams,
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
