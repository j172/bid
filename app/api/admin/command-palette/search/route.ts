import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { closeExpiredListings } from "@/lib/listings";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return NextResponse.json({ ok: true, listings: [], users: [] });
  }

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