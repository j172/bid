import { getDb } from "@/lib/db";
import { extendEndTimeIfNeeded, resolveProxyBid, type ProxyBidOutcome } from "@/lib/bidding/domain";

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

export async function listOpenListings(): Promise<ListingWithPhotos[]> {
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
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM listings WHERE id = ? LIMIT 1", [id]);
  const list = rows as Listing[];
  const listing = list[0];
  if (!listing) return null;

  return { ...listing, photos: await getPhotoFileNames(listing.id) };
}

// Locks the listing row for the duration of the read-validate-write so two
// concurrent bids can't both read the same state and both succeed. Every
// bid is a private max (proxy bidding, see lib/bidding/domain.ts) — the
// leader's max is deliberately never returned to callers, only the
// resulting visible current_price.
export async function placeBid(listingId: number, userId: number, maxAmount: number): Promise<ProxyBidOutcome> {
  const db = await getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT current_price, status, leader_max_amount, ends_at FROM listings WHERE id = ? FOR UPDATE",
      [listingId],
    );
    const listing = (rows as { current_price: number; status: string; leader_max_amount: number | null; ends_at: Date }[])[0];
    if (!listing) {
      await connection.rollback();
      return { ok: false, error: "找不到這個商品" };
    }

    const result = resolveProxyBid(
      { status: listing.status, currentPrice: listing.current_price, leaderMaxAmount: listing.leader_max_amount },
      maxAmount,
    );
    if (!result.ok) {
      await connection.rollback();
      return result;
    }

    const newEndsAt = extendEndTimeIfNeeded(listing.ends_at, new Date());

    await connection.query(
      "UPDATE listings SET current_price = ?, leader_max_amount = ?, ends_at = ? WHERE id = ?",
      [result.currentPrice, result.leaderMaxAmount, newEndsAt, listingId],
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
