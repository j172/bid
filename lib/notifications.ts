import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Fire-and-forget: callers invoke these without awaiting them (see
// lib/listings.ts's placeBid/buyNow) so the bidding/buyout action's HTTP
// response never waits on a DB lookup or an email provider round-trip.
// Errors are only logged — a failed notification must never surface as a
// failed bid.

type Locale = "zh-TW" | "zh-CN" | "en";

// Emails are sent from server-only code with no request/render context, so
// they can't use next-intl's useTranslations/getTranslations (those need a
// NextIntlClientProvider or an active request locale) — this small
// standalone table is the email equivalent of messages/*.json, keyed by the
// recipient's stored users.locale (see lib/auth.ts's createUser, and the
// i18n ticket that introduced that column).
const EMAIL_MESSAGES: Record<
  Locale,
  {
    outbidSubject: string;
    outbidBody: (title: string) => string;
    auctionEndedSubject: string;
    auctionEndedBody: (title: string) => string;
    purchaseConfirmedSubject: string;
    purchaseConfirmedBody: (title: string, quantity: number, totalAmount: number) => string;
  }
> = {
  "zh-TW": {
    outbidSubject: "你被超越了",
    outbidBody: (title) => `<p>你在「${title}」的出價已被其他人超越，快回來看看目前的最高價，決定要不要繼續加價。</p>`,
    auctionEndedSubject: "拍賣已結束",
    auctionEndedBody: (title) => `<p>你曾出價的商品「${title}」已經被買斷，拍賣提前結束了。</p>`,
    purchaseConfirmedSubject: "購買成功",
    purchaseConfirmedBody: (title, quantity, totalAmount) =>
      `<p>你已購買「${title}」x ${quantity}，總金額 ${totalAmount}。管理員會與你聯繫後續付款與交付事宜。</p>`,
  },
  "zh-CN": {
    outbidSubject: "你被超越了",
    outbidBody: (title) => `<p>你在「${title}」的出价已被其他人超越，快回来看看目前的最高价，决定要不要继续加价。</p>`,
    auctionEndedSubject: "拍卖已结束",
    auctionEndedBody: (title) => `<p>你曾出价的商品「${title}」已经被买断，拍卖提前结束了。</p>`,
    purchaseConfirmedSubject: "购买成功",
    purchaseConfirmedBody: (title, quantity, totalAmount) =>
      `<p>你已购买「${title}」x ${quantity}，总金额 ${totalAmount}。管理员会与你联系后续付款与交付事宜。</p>`,
  },
  en: {
    outbidSubject: "You've been outbid",
    outbidBody: (title) =>
      `<p>Your bid on "${title}" has been outbid by someone else — come check the current highest bid and decide whether to raise yours.</p>`,
    auctionEndedSubject: "Auction ended",
    auctionEndedBody: (title) => `<p>The item you bid on, "${title}", was just bought outright — the auction ended early.</p>`,
    purchaseConfirmedSubject: "Purchase confirmed",
    purchaseConfirmedBody: (title, quantity, totalAmount) =>
      `<p>You purchased "${title}" x ${quantity}, total amount ${totalAmount}. The admin will contact you about payment and delivery.</p>`,
  },
};

function resolveLocale(locale: string): Locale {
  return locale === "zh-CN" || locale === "en" ? locale : "zh-TW";
}

export function notifyOutbid(listingId: number, outbidUserId: number): void {
  void (async () => {
    const db = await getDb();
    const [rows] = await db.query(
      `SELECT u.email AS email, u.locale AS locale, l.title AS title
       FROM users u
       JOIN listings l ON l.id = ?
       WHERE u.id = ?`,
      [listingId, outbidUserId],
    );
    const row = (rows as { email: string; locale: string; title: string }[])[0];
    if (!row) return;

    const messages = EMAIL_MESSAGES[resolveLocale(row.locale)];
    await sendEmail(row.email, messages.outbidSubject, messages.outbidBody(row.title));
  })().catch((error) => console.error("notifyOutbid failed:", error));
}

// Only ever call this from a Buy-It-Now closure (manual or auto-triggered)
// — a listing that closes by time expiry (ticket #11) must NOT send this.
export function notifyAuctionEnded(listingId: number): void {
  void (async () => {
    const db = await getDb();
    const [rows] = await db.query(
      `SELECT DISTINCT u.email AS email, u.locale AS locale, l.title AS title
       FROM bids b
       JOIN users u ON u.id = b.user_id
       JOIN listings l ON l.id = b.listing_id
       WHERE b.listing_id = ?`,
      [listingId],
    );
    const recipients = rows as { email: string; locale: string; title: string }[];

    for (const recipient of recipients) {
      const messages = EMAIL_MESSAGES[resolveLocale(recipient.locale)];
      await sendEmail(recipient.email, messages.auctionEndedSubject, messages.auctionEndedBody(recipient.title));
    }
  })().catch((error) => console.error("notifyAuctionEnded failed:", error));
}

// Fixed-price ("一般商品") purchase confirmation — called from
// purchaseListing (lib/listings.ts) with the newly-inserted purchase row's
// id, so it looks up its own details rather than taking them as params.
export function notifyPurchaseConfirmed(purchaseId: number): void {
  void (async () => {
    const db = await getDb();
    const [rows] = await db.query(
      `SELECT u.email AS email, u.locale AS locale, l.title AS title, p.quantity AS quantity, p.total_amount AS totalAmount
       FROM purchases p
       JOIN users u ON u.id = p.buyer_id
       JOIN listings l ON l.id = p.listing_id
       WHERE p.id = ?`,
      [purchaseId],
    );
    const row = (rows as { email: string; locale: string; title: string; quantity: number; totalAmount: number }[])[0];
    if (!row) return;

    const messages = EMAIL_MESSAGES[resolveLocale(row.locale)];
    await sendEmail(
      row.email,
      messages.purchaseConfirmedSubject,
      messages.purchaseConfirmedBody(row.title, row.quantity, row.totalAmount),
    );
  })().catch((error) => console.error("notifyPurchaseConfirmed failed:", error));
}
