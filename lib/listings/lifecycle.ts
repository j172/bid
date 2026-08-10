// The two lazy status sweeps that move listings between 'scheduled',
// 'open' and 'closed'. There's no background worker in this deployment, so
// instead of a schedule these run at the top of every read/write path in
// lib/listings.ts — cheap enough (single indexed UPDATE each) to afford on
// every access.
//
// Split out of lib/listings.ts (issue #139: that module had grown to nine
// separate responsibilities) because this is the one part with no
// dependency on the rest of it — it only touches status columns. lib/
// listings.ts re-exports all three functions, so existing
// `import { syncListingLifecycle } from "@/lib/listings"` call sites are
// unaffected.

import { getDb } from "@/lib/db";
import { notifyWinner } from "@/lib/notifications";

// Closes any listing whose end time has passed without being bought out
// first. Deliberately just a status flip: current_price and leader_user_id
// are already correct at every moment (placeBid/buyNow keep them in sync
// live), so the highest bid at the instant this runs — or the starting
// price and no leader, if the listing never got a single bid — is exactly
// the right final price/winner. Also fires notifyWinner (issue #48) for any
// listing this sweep is about to close that actually has a winner
// (leader_user_id set) — a zero-bid listing has nobody to congratulate, so
// it's excluded from the pre-UPDATE lookup below rather than left to
// notifyWinner's own no-row no-op, keeping the notify loop tight to only
// real winners.
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
// of closeExpiredListings above. Must run before closeExpiredListings in
// syncListingLifecycle so a listing whose starts_at and ends_at have *both*
// already passed (e.g. the admin scheduled a very short auction and nobody
// looked at it in time) still passes through 'open' on its way to 'closed'
// rather than getting stuck in 'scheduled' forever — closeExpiredListings
// only ever matches status = 'open'.
export async function openScheduledListings(): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE listings SET status = 'open' WHERE status = 'scheduled' AND starts_at <= NOW()");
}

// The single entry point every read/write path calls instead of
// closeExpiredListings directly — keeps both sweeps (start, then end) in
// sync at every access without every call site needing to know both exist.
export async function syncListingLifecycle(): Promise<void> {
  await openScheduledListings();
  await closeExpiredListings();
}
