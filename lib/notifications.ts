import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/htmlText";

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
    winnerSubject: string;
    winnerBody: (title: string, finalPrice: number) => string;
    resetPasswordSubject: string;
    resetPasswordBody: (resetUrl: string) => string;
    verifyEmailSubject: string;
    verifyEmailBody: (verifyUrl: string) => string;
    emailOtpSubject: string;
    emailOtpBody: (code: string) => string;
    // Confirmation email sent to whoever submits the public /contact form
    // (issue #104) — keyed by the locale of the contact page they submitted
    // from (see resolveLocale's call site in sendContactMessageEmails),
    // *not* users.locale like every other entry above, since a contact-form
    // submitter isn't necessarily a registered account.
    contactConfirmationSubject: string;
    contactConfirmationBody: (subject: string) => string;
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
    winnerSubject: "恭喜得標",
    winnerBody: (title, finalPrice) =>
      `<p>恭喜你得標「${title}」，得標金額 ${finalPrice}。管理員會與你聯繫後續付款與交付事宜。</p>`,
    resetPasswordSubject: "重設密碼",
    resetPasswordBody: (resetUrl) =>
      `<p>我們收到重設你密碼的請求。請點擊以下連結設定新密碼，此連結將於 30 分鐘後失效，且僅能使用一次：</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>若這不是你本人的操作，請忽略這封信，你的密碼不會被更動。</p>`,
    verifyEmailSubject: "請驗證你的信箱",
    verifyEmailBody: (verifyUrl) =>
      `<p>感謝你註冊。請點擊以下連結驗證你的信箱，才能完成註冊並登入，此連結將於 24 小時後失效，且僅能使用一次：</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>若這不是你本人的操作，請忽略這封信。</p>`,
    emailOtpSubject: "登入驗證碼",
    emailOtpBody: (code) =>
      `<p>你的登入驗證碼是：</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>此驗證碼將於 10 分鐘後失效，且僅能使用一次。若這不是你本人的登入嘗試，請忽略這封信。</p>`,
    contactConfirmationSubject: "已收到你的訊息",
    contactConfirmationBody: (subject) =>
      `<p>我們已收到您的訊息，會盡快回覆。</p><p>您提交的主旨：${escapeHtml(subject)}</p>`,
  },
  "zh-CN": {
    outbidSubject: "你被超越了",
    outbidBody: (title) => `<p>你在「${title}」的出价已被其他人超越，快回来看看目前的最高价，决定要不要继续加价。</p>`,
    auctionEndedSubject: "拍卖已结束",
    auctionEndedBody: (title) => `<p>你曾出价的商品「${title}」已经被买断，拍卖提前结束了。</p>`,
    purchaseConfirmedSubject: "购买成功",
    purchaseConfirmedBody: (title, quantity, totalAmount) =>
      `<p>你已购买「${title}」x ${quantity}，总金额 ${totalAmount}。管理员会与你联系后续付款与交付事宜。</p>`,
    winnerSubject: "恭喜得标",
    winnerBody: (title, finalPrice) =>
      `<p>恭喜你得标「${title}」，得标金额 ${finalPrice}。管理员会与你联系后续付款与交付事宜。</p>`,
    resetPasswordSubject: "重设密码",
    resetPasswordBody: (resetUrl) =>
      `<p>我们收到重设你密码的请求。请点击以下链接设定新密码，此链接将于 30 分钟后失效，且仅能使用一次：</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>若这不是你本人的操作，请忽略这封信，你的密码不会被更动。</p>`,
    verifyEmailSubject: "请验证你的邮箱",
    verifyEmailBody: (verifyUrl) =>
      `<p>感谢你注册。请点击以下链接验证你的邮箱，才能完成注册并登录，此链接将于 24 小时后失效，且仅能使用一次：</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>若这不是你本人的操作，请忽略这封信。</p>`,
    emailOtpSubject: "登录验证码",
    emailOtpBody: (code) =>
      `<p>你的登录验证码是：</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>此验证码将于 10 分钟后失效，且仅能使用一次。若这不是你本人的登录尝试，请忽略这封信。</p>`,
    contactConfirmationSubject: "已收到你的留言",
    contactConfirmationBody: (subject) =>
      `<p>我们已收到您的留言，会尽快回复。</p><p>您提交的主题：${escapeHtml(subject)}</p>`,
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
    winnerSubject: "Congratulations, you won!",
    winnerBody: (title, finalPrice) =>
      `<p>Congratulations — you won "${title}" for ${finalPrice}. The admin will contact you about payment and delivery.</p>`,
    resetPasswordSubject: "Reset your password",
    resetPasswordBody: (resetUrl) =>
      `<p>We received a request to reset your password. Click the link below to set a new one — it expires in 30 minutes and can only be used once:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email — your password won't be changed.</p>`,
    verifyEmailSubject: "Verify your email address",
    verifyEmailBody: (verifyUrl) =>
      `<p>Thanks for signing up. Click the link below to verify your email address and finish creating your account — it expires in 24 hours and can only be used once:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    emailOtpSubject: "Your login verification code",
    emailOtpBody: (code) =>
      `<p>Your login verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>This code expires in 10 minutes and can only be used once. If this wasn't you, you can safely ignore this email.</p>`,
    contactConfirmationSubject: "We've received your message",
    contactConfirmationBody: (subject) =>
      `<p>We've received your message and will get back to you as soon as we can.</p><p>Subject you submitted: ${escapeHtml(subject)}</p>`,
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

// Winner-specific "congratulations, you won" notification (issue #48) —
// distinct from notifyAuctionEnded above, which tells every *other* bidder
// the auction ended early and must NOT be touched by this. Called from every
// closing path that can actually produce a winner: closeExpiredListings,
// buyNow, and the auto-triggered buyout branch of placeBid/resolveProxyBid
// (see lib/listings.ts) — always alongside the existing notifyAuctionEnded
// call where one already exists, never replacing it. Recipient is only
// listings.leader_user_id (the winner), never the other bidders. On a
// successful send, records winner_notified_at so the admin closed-listings
// page can show it and the "重新寄送得標信" button (see sendWinnerEmail
// below and app/api/admin/listings/[id]/notify-winner) knows whether a
// resend is needed.
export function notifyWinner(listingId: number): void {
  void sendWinnerEmail(listingId).catch((error) => console.error("notifyWinner failed:", error));
}

// Awaitable core shared by notifyWinner (fire-and-forget, for the lazy
// closing-path triggers above) and the admin "重新寄送得標信" resend button
// (app/api/admin/listings/[id]/notify-winner/route.ts), which needs to know
// the send outcome synchronously so it can reflect the refreshed
// winner_notified_at in the UI immediately rather than firing and forgetting.
// Never throws (mirrors sendEmail) — returns false on any failure, including
// "no winner" (leader_user_id is null, so the JOIN below yields no row).
export async function sendWinnerEmail(listingId: number): Promise<boolean> {
  try {
    const db = await getDb();
    const [rows] = await db.query(
      `SELECT u.email AS email, u.locale AS locale, l.title AS title, l.current_price AS finalPrice
       FROM listings l
       JOIN users u ON u.id = l.leader_user_id
       WHERE l.id = ?`,
      [listingId],
    );
    const row = (rows as { email: string; locale: string; title: string; finalPrice: number }[])[0];
    if (!row) return false;

    const messages = EMAIL_MESSAGES[resolveLocale(row.locale)];
    const sent = await sendEmail(row.email, messages.winnerSubject, messages.winnerBody(row.title, row.finalPrice));
    if (sent) {
      await db.query("UPDATE listings SET winner_notified_at = NOW() WHERE id = ?", [listingId]);
    }
    return sent;
  } catch (error) {
    console.error("sendWinnerEmail failed:", error);
    return false;
  }
}

// Forgot-password reset email (issue #89), called by
// app/api/auth/forgot-password/route.ts. Unlike the fire-and-forget
// notifiers above, the caller there awaits this directly — the route has no
// other work to do once the token is issued, and (unlike a bid/purchase
// side-effect) a slow email provider here doesn't block anything else.
// Never throws (mirrors sendEmail/sendWinnerEmail); the route ignores the
// returned outcome anyway, since it always responds with the same neutral
// message regardless of whether the send actually succeeded.
export async function sendPasswordResetEmail(email: string, locale: string, resetUrl: string): Promise<boolean> {
  try {
    const messages = EMAIL_MESSAGES[resolveLocale(locale)];
    return await sendEmail(email, messages.resetPasswordSubject, messages.resetPasswordBody(resetUrl));
  } catch (error) {
    console.error("sendPasswordResetEmail failed:", error);
    return false;
  }
}

// Registration email-ownership verification link (issue #118), called by
// app/api/auth/register/route.ts and app/api/auth/resend-verification/
// route.ts. Same "caller awaits it directly" shape as
// sendPasswordResetEmail above — the route has no other work to do once the
// token is issued. Never throws (mirrors sendEmail/sendPasswordResetEmail).
export async function sendVerificationEmail(email: string, locale: string, verifyUrl: string): Promise<boolean> {
  try {
    const messages = EMAIL_MESSAGES[resolveLocale(locale)];
    return await sendEmail(email, messages.verifyEmailSubject, messages.verifyEmailBody(verifyUrl));
  } catch (error) {
    console.error("sendVerificationEmail failed:", error);
    return false;
  }
}

// Email-OTP login challenge code (issue #93), called by
// app/api/auth/login/route.ts right after createEmailOtpChallenge issues a
// fresh code — same "caller awaits it directly" shape as
// sendPasswordResetEmail above (the route has nothing else to do once the
// challenge is issued). Never throws (mirrors sendEmail/sendPasswordResetEmail).
export async function sendEmailOtpEmail(email: string, locale: string, code: string): Promise<boolean> {
  try {
    const messages = EMAIL_MESSAGES[resolveLocale(locale)];
    return await sendEmail(email, messages.emailOtpSubject, messages.emailOtpBody(code));
  } catch (error) {
    console.error("sendEmailOtpEmail failed:", error);
    return false;
  }
}

// Public /contact form (issue #104) email pair — a fixed admin notification
// to CONTACT_ADMIN_EMAIL plus a locale-appropriate confirmation to whoever
// submitted the form. Unlike the rest of this file's tables, the admin
// notification is deliberately NOT looked up via EMAIL_MESSAGES/
// resolveLocale: it always goes to the site admin in hardcoded Traditional
// Chinese, same "admin surfaces stay hardcoded zh-TW" convention as
// lib/errorCodes.ts's header comment (this recipient isn't the visitor who
// submitted the form, so there's no per-recipient locale to honor).

export interface ContactMessageDetails {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const CONTACT_ADMIN_EMAIL = "j172@j172.tw";

// Pure/no I/O so it's directly unit-testable, same split as
// lib/newsletter.ts's buildNewsBroadcastHtml. escapeHtml is required here
// (unlike every other EMAIL_MESSAGES body in this file) because name/
// subject/message are raw, unauthenticated visitor input, not
// admin-authored content.
export function buildContactAdminNotificationHtml(details: ContactMessageDetails): string {
  return [
    "<p>網站聯絡表單收到一則新訊息：</p>",
    `<p>姓名：${escapeHtml(details.name)}</p>`,
    `<p>Email：${escapeHtml(details.email)}</p>`,
    `<p>主旨：${escapeHtml(details.subject)}</p>`,
    `<p>訊息內容：</p><p>${escapeHtml(details.message).replace(/\n/g, "<br>")}</p>`,
  ].join("");
}

// Sends both the admin notification and the submitter confirmation. Awaited
// directly by app/api/contact/route.ts (same "caller awaits it directly"
// shape as sendPasswordResetEmail/sendEmailOtpEmail above) — but never
// throws and its return value carries no ok/failure signal for the caller
// to act on, since both sends are best-effort per the issue: once the
// contact_messages row is inserted, a failed email must not turn the
// visitor's submission into an error response.
export async function sendContactMessageEmails(details: ContactMessageDetails, locale: string): Promise<void> {
  try {
    await sendEmail(CONTACT_ADMIN_EMAIL, "網站聯絡表單：新訊息", buildContactAdminNotificationHtml(details));
  } catch (error) {
    console.error("sendContactMessageEmails: admin notification failed:", error);
  }

  try {
    const messages = EMAIL_MESSAGES[resolveLocale(locale)];
    await sendEmail(details.email, messages.contactConfirmationSubject, messages.contactConfirmationBody(details.subject));
  } catch (error) {
    console.error("sendContactMessageEmails: submitter confirmation failed:", error);
  }
}
