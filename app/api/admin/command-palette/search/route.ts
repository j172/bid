import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { closeExpiredListings } from "@/lib/listings";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return NextResponse.json({ ok: true, listings: [], users: [] });
  }

  // Yes, a write from a read-only search endpoint (issue #139 L4). This
  // deployment has no background worker: every path that reads listings
  // sweeps the expired ones closed first (see lib/listings.ts'
  // syncListingLifecycle header comment), so without this the palette would
  // report a long-past auction as still 開放中 and let an admin act on a
  // stale status. Kept as-is, and kept as the narrower closeExpiredListings
  // rather than syncListingLifecycle, since the palette only ever needs the
  // status text to be honest about what has already ended.
  await closeExpiredListings();
  const db = await getDb();
  const like = `%${query}%`;

  const [listingRows, userRows] = await Promise.all([
    db.query(
      `SELECT id, title, listing_type AS listingType, status
       FROM listings
       WHERE title LIKE ?
       ORDER BY created_at DESC
       LIMIT 8`,
      [like],
    ),
    db.query(
      `SELECT id, email, display_name AS displayName, role
       FROM users
       WHERE deleted_at IS NULL AND (email LIKE ? OR display_name LIKE ?)
       ORDER BY created_at DESC
       LIMIT 8`,
      [like, like],
    ),
  ]);

  return NextResponse.json({
    ok: true,
    listings: listingRows[0],
    users: userRows[0],
  });
}