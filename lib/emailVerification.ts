// Registration email-ownership verification tokens (issue #118). Mirrors
// lib/passwordReset.ts's shape almost exactly (32-byte randomBytes().toString
// ("hex") token as its own DB primary key, TTL-based expiry, one-time use via
// a used_at column, the same email-cooldown + per-IP rate limit approach) —
// lives in its own module for the same reason passwordReset.ts does: it
// carries its own route-specific rate-limit bookkeeping (this time for the
// resend-verification route) that has nothing to do with session management
// in lib/auth.ts. isEmailVerificationTokenValid is split out as a small pure
// function (no DB access), same split lib/passwordReset.ts uses for
// isResetTokenValid, so the expiry/one-time-use decision is directly
// unit-testable without mocking @/lib/db.
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import type { ErrorCode } from "@/lib/errorCodes";
import { routing } from "@/i18n/routing";

export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Same window/limit constants as lib/passwordReset.ts's forgot-password rate
// limit (issue #89) — reused verbatim rather than invented anew, per issue
// #118's "比照 forgot-password 的 rate-limit 慣例" decision.
const EMAIL_COOLDOWN_SECONDS = 60;
const IP_WINDOW_MINUTES = 15;
const IP_MAX_REQUESTS = 5;

export interface EmailVerificationTokenRow {
  user_id: number;
  expires_at: Date;
  used_at: Date | null;
}

// Pure: a token is usable exactly when it exists, has never been consumed,
// and hasn't passed its 24-hour expiry yet. `now` defaults to the real clock
// but is an explicit param so tests don't need to fake system time. Mirrors
// lib/passwordReset.ts's isResetTokenValid exactly, just against this
// table's 24h TTL instead of that one's 30 minutes.
export function isEmailVerificationTokenValid(row: EmailVerificationTokenRow | null, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.used_at !== null) return false;
  return row.expires_at.getTime() > now.getTime();
}

// True when this account (60s email cooldown) or this IP (5 requests per 15
// minutes) has already triggered a verification email recently — same two
// checks, same constants, and same "derived from the token table's
// created_at directly rather than a separate rate-limit store" approach as
// lib/passwordReset.ts's isPasswordResetRateLimited. Used by both POST
// /api/auth/register (issue #118 §3) and POST /api/auth/resend-verification
// (§6) so a visitor can't hammer either endpoint to spam an inbox.
export async function isEmailVerificationRateLimited(userId: number, ip: string | null): Promise<boolean> {
  const db = await getDb();

  const [emailRows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM email_verification_tokens
     WHERE user_id = ? AND created_at > NOW() - INTERVAL ${EMAIL_COOLDOWN_SECONDS} SECOND`,
    [userId],
  );
  if ((emailRows as { cnt: number }[])[0].cnt > 0) return true;

  if (ip) {
    const [ipRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM email_verification_tokens
       WHERE request_ip = ? AND created_at > NOW() - INTERVAL ${IP_WINDOW_MINUTES} MINUTE`,
      [ip],
    );
    if ((ipRows as { cnt: number }[])[0].cnt >= IP_MAX_REQUESTS) return true;
  }

  return false;
}

// Caller (register/resend-verification routes) is expected to have already
// checked isEmailVerificationRateLimited for this userId/ip before calling
// this — same two-separate-steps shape as lib/passwordReset.ts's
// createPasswordResetToken.
export async function createEmailVerificationToken(userId: number, ip: string | null): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS);
  await db.query(
    "INSERT INTO email_verification_tokens (token, user_id, request_ip, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())",
    [token, userId, ip, expiresAt],
  );
  return token;
}

// Builds the /verify-email path for the outbound email link — same
// default-locale-gets-no-prefix convention as lib/passwordReset.ts's
// resetPasswordPath (see that function's header comment for why). Pure — no
// I/O — so it's unit-tested directly, no DB mocking.
export function verifyEmailPath(locale: string, token: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${prefix}/verify-email?token=${encodeURIComponent(token)}`;
}

export type VerifyEmailOutcome = { ok: true } | { ok: false; errorCode: ErrorCode };

// Validates the token, marks the owning account verified, and marks the
// token spent — mirrors lib/passwordReset.ts's resetPassword shape (validate
// → mutate → mark used), except there is no "kick every session" step here:
// unlike a password reset, proving email ownership doesn't invalidate any
// credential, so any session the account already holds (there normally isn't
// one — registration no longer auto-creates a session, see issue #118 §3) is
// left untouched. Deliberately does NOT call createSession — matches
// resetPassword's own precedent of not auto-logging-in after success; both
// just report ok:true and let the front end send the visitor to /login.
export async function verifyEmailVerificationToken(token: string): Promise<VerifyEmailOutcome> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT user_id, expires_at, used_at FROM email_verification_tokens WHERE token = ? LIMIT 1",
    [token],
  );
  const row = (rows as EmailVerificationTokenRow[])[0] ?? null;
  if (!isEmailVerificationTokenValid(row)) {
    return { ok: false, errorCode: "EMAIL_VERIFICATION_TOKEN_INVALID" };
  }

  const userId = (row as EmailVerificationTokenRow).user_id;
  await db.query("UPDATE users SET email_verified = 1 WHERE id = ?", [userId]);
  await db.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE token = ?", [token]);
  return { ok: true };
}
