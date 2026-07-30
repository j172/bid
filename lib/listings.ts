import { getDb } from "@/lib/db";
import {
  extendEndTimeIfNeeded,
  resolveBuyNow,
  resolveProxyBid,
  type BuyNowOutcome,
  type ProxyBidOutcome,
} from "@/lib/bidding/domain";
import { notifyAuctionEnded, notifyOutbid } from "@/lib/notifications";

export interface Listing {
  id: number;
  title: string;
  description: string;
  starting_price: number;
  current_price: number;
  buy_it_now_price: number;
  ends_at: Date;
  status: string;
  created_by: number;
  created_at: Date;
}

export interface ListingWithPhotos extends Listing {
  photos: string[];
}

export interface NewListingInput {
  title: string;
  description: string;
  startingPrice: number;
  buyItNowPrice: number;
  endsAt: Date;
  createdBy: number;
}

// Split from photo storage: the listing's id (used as its photo directory
// name) only exists after this insert, so callers must insert the listing,
// then save photos to disk under that id, then call addListingPhotos.
export async function insertListing(input: NewListingInput): Promise<number> {
  const db = await getDb();
  const [result] = await db.query(
    `INSERT INTO listings
       (title, description, starting_price, current_price, buy_it_now_price, ends_at, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NOW())`,
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

export async function deleteListing(id: number): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM listing_photos WHERE listing_id = ?", [id]);
  await db.query("DELETE FROM listings WHERE id = ?", [id]);
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
  await db.query("UPDATE listings SET status = 'closed' WHERE status = 'open' AND ends_at <= NOW()");
}

export async function listOpenListings(): Promise<ListingWithPhotos[]> {
  await closeExpiredListings();
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM listings WHERE status = 'open' ORDER BY ends_at ASC");
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
  winnerEmail: string | null;
}

export async function getClosedListings(): Promise<ClosedListingSummary[]> {
  await closeExpiredListings();
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT l.id AS id, l.title AS title, l.current_price AS finalPrice, u.email AS winnerEmail
     FROM listings l
     LEFT JOIN users u ON u.id = l.leader_user_id
     WHERE l.status = 'closed'
     ORDER BY l.ends_at DESC`,
  );
  return rows as ClosedListingSummary[];
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
        buy_it_now_price: number;
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

    await connection.query(
      "UPDATE listings SET current_price = ?, leader_max_amount = ?, ends_at = ?, status = ? WHERE id = ?",
      [result.currentPrice, result.leaderMaxAmount, newEndsAt, newStatus, listingId],
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
    const listing = (rows as { status: string; buy_it_now_price: number; created_by: number }[])[0];
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
       SET status = 'closed', current_price = ?, leader_user_id = ?, leader_max_amount = ?
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

async function getPhotoFileNames(listingId: number): Promise<string[]> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT file_name FROM listing_photos WHERE listing_id = ? ORDER BY sort_order ASC",
    [listingId],
  );
  return (rows as { file_name: string }[]).map((row) => row.file_name);
}
