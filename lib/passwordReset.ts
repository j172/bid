// Self-service "forgot password" reset tokens (issue #89). Mirrors
// lib/auth.ts's createSession in shape (32-byte randomBytes().toString("hex")
// token, DB-backed, TTL-based) but lives in its own module since it also
// carries the forgot-password route's rate-limit bookkeeping, which has
// nothing to do with session management. isResetTokenValid is split out as a
// small pure function (no DB access) — same split this project already uses
// for lib/newsNewsletterSync.ts's resolveOrigin/parseScheduledAt — so the
// expiry/one-time-use decision is directly unit-testable without mocking
// @/lib/db.
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { ErrorCode } from "@/lib/errorCodes";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const EMAIL_COOLDOWN_SECONDS = 60;
const IP_WINDOW_MINUTES = 15;
const IP_MAX_REQUESTS = 5;

export interface PasswordResetTokenRow {
  user_id: number;
  expires_at: Date;
  used_at: Date | null;
}

// Pure: a token is usable exactly when it exists, has never been consumed,
// and hasn't passed its 30-minute expiry yet. `now` defaults to the real
// clock but is an explicit param so tests don't need to fake system time.
export function isResetTokenValid(row: PasswordResetTokenRow | null, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.used_at !== null) return false;
  return row.expires_at.getTime() > now.getTime();
}

// True when this account (60s email cooldown) or this IP (5 requests per 15
// minutes) has already triggered a reset recently. The forgot-password route
// responds with the same neutral message either way — see that route's
// header comment — so the caller never needs to know *which* limit tripped.
// Both limits are derived from password_reset_tokens.created_at directly
// (per issue #89: "用 MySQL 查 password_reset_tokens 表的 created_at 就能
// 算，不用額外服務") rather than a separate rate-limit store.
export async function isPasswordResetRateLimited(userId: number, ip: string | null): Promise<boolean> {
  const db = await getDb();

  const [emailRows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM password_reset_tokens
     WHERE user_id = ? AND created_at > NOW() - INTERVAL ${EMAIL_COOLDOWN_SECONDS} SECOND`,
    [userId],
  );
  if ((emailRows as { cnt: number }[])[0].cnt > 0) return true;

  if (ip) {
    const [ipRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM password_reset_tokens
       WHERE request_ip = ? AND created_at > NOW() - INTERVAL ${IP_WINDOW_MINUTES} MINUTE`,
      [ip],
    );
    if ((ipRows as { cnt: number }[])[0].cnt >= IP_MAX_REQUESTS) return true;
  }

  return false;
}

// Caller (the forgot-password route) is expected to have already checked
// isPasswordResetRateLimited for this userId/ip before calling this — kept
// as two separate steps rather than one combined call so the route can log/
// reason about "rate limited" vs "token issued" distinctly even though both
// paths return the same response to the client.
export async function createPasswordResetToken(userId: number, ip: string | null): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await db.query(
    "INSERT INTO password_reset_tokens (token, user_id, request_ip, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())",
    [token, userId, ip, expiresAt],
  );
  return token;
}

export type ResetPasswordOutcome = { ok: true } | { ok: false; errorCode: ErrorCode };

// Validates the token, updates the password (mirrors changePassword's
// hashPassword/newPassword.length < 8 rule in lib/auth.ts), marks the token
// spent, and — same "kick every other session" treatment changePassword now
// gets — deletes every session belonging to the account. There's no
// "current session" to preserve here (the visitor isn't logged in while
// resetting a forgotten password), so unlike changePassword this clears all
// of them unconditionally.
export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordOutcome> {
  const db = await getDb();
  const [rows] = await db.query("SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ? LIMIT 1", [
    token,
  ]);
  const row = (rows as PasswordResetTokenRow[])[0] ?? null;
  if (!isResetTokenValid(row)) {
    return { ok: false, errorCode: "RESET_TOKEN_INVALID" };
  }
  if (newPassword.length < 8) {
    return { ok: false, errorCode: "NEW_PASSWORD_TOO_SHORT" };
  }

  const userId = (row as PasswordResetTokenRow).user_id;
  const { hash, salt } = await hashPassword(newPassword);
  await db.query("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?", [hash, salt, userId]);
  await db.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?", [token]);
  await db.query("DELETE FROM sessions WHERE user_id = ?", [userId]);
  return { ok: true };
}
