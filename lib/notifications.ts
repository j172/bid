import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Fire-and-forget: callers invoke these without awaiting them (see
// lib/listings.ts's placeBid/buyNow) so the bidding/buyout action's HTTP
// response never waits on a DB lookup or an email provider round-trip.
// Errors are only logged — a failed notification must never surface as a
// failed bid.

export function notifyOutbid(listingId: number, outbidUserId: number): void {
  void (async () => {
    const db = await getDb();
    const [rows] = await db.query(
      `SELECT u.email AS email, l.title AS title
       FROM users u
       JOIN listings l ON l.id = ?
       WHERE u.id = ?`,
      [listingId, outbidUserId],
    );
    const row = (rows as { email: string; title: string }[])[0];
    if (!row) return;

    await sendEmail(
      row.email,
      "你被超越了",
      `<p>你在「${row.title}」的出價已被其他人超越，快回來看看目前的最高價，決定要不要繼續加價。</p>`,
    );
  })().catch((error) => console.error("notifyOutbid failed:", error));
}

// Only ever call this from a Buy-It-Now closure (manual or auto-triggered)
// — a listing that closes by time expiry (ticket #11) must NOT send this.
export function notifyAuctionEnded(listingId: number): void {
  void (async () => {
    const db = await getDb();
    const [rows] = await db.query(
      `SELECT DISTINCT u.email AS email, l.title AS title
       FROM bids b
       JOIN users u ON u.id = b.user_id
       JOIN listings l ON l.id = b.listing_id
       WHERE b.listing_id = ?`,
      [listingId],
    );
    const recipients = rows as { email: string; title: string }[];

    for (const recipient of recipients) {
      await sendEmail(
        recipient.email,
        "拍賣已結束",
        `<p>你曾出價的商品「${recipient.title}」已經被買斷，拍賣提前結束了。</p>`,
      );
    }
  })().catch((error) => console.error("notifyAuctionEnded failed:", error));
}
