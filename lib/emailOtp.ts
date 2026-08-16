// Email OTP login challenges (issue #93) — the second-factor counterpart to
// lib/passwordReset.ts's forgot-password tokens, and deliberately mirrors
// that module's shape: a pure decision function (isEmailOtpChallengeUsable,
// no DB access, directly unit-testable — same split lib/passwordReset.ts
// uses for isResetTokenValid) plus raw-SQL CRUD/rate-limit helpers that hit
// email_otp_challenges (see db/init.sql for the table's header comment).
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { isCooldownRateLimited } from "@/lib/rateLimiting";
import type { ErrorCode } from "@/lib/errorCodes";

export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
const EMAIL_COOLDOWN_SECONDS = 60;
const IP_WINDOW_MINUTES = 15;
const IP_MAX_REQUESTS = 5;

export interface EmailOtpChallengeRow {
  user_id: number;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  used_at: Date | null;
}

// A fresh 6-digit code every call, zero-padded (so "000123" stays 6 digits).
// randomInt is cryptographically strong (unlike Math.random), same rigor as
// lib/auth.ts's randomBytes-based session/reset tokens.
export function generateEmailOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// sha256(`${token}:${code}`) rather than a bare sha256(code) — the
// challenge's own token (a 32-byte random value, unguessable and unique per
// row) doubles as this hash's salt, so a leaked email_otp_challenges table
// can't be rainbow-tabled against the 6-digit code space in bulk without
// also knowing each row's token. No separate salt column needed as a
// result. Not scrypt/bcrypt: unlike a user's real password, this is a
// random, single-use, 10-minute-lived value already behind a 5-attempt
// cap — a fast hash is enough, and doing this on every check keeps
// verifyEmailOtpChallenge cheap under a login-page attempt cap.
export function hashEmailOtpCode(token: string, code: string): string {
  return createHash("sha256").update(`${token}:${code}`).digest("hex");
}

// Pure: a challenge is usable exactly when it exists, has never been spent
// (a successful verify or hitting the attempt cap both set used_at — see
// verifyEmailOtpChallenge), hasn't passed its 10-minute expiry, and hasn't
// already exhausted its attempt budget. `now` defaults to the real clock but
// is an explicit param so tests don't need to fake system time — same
// pattern as lib/passwordReset.ts's isResetTokenValid.
export function isEmailOtpChallengeUsable(row: EmailOtpChallengeRow | null, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.used_at !== null) return false;
  if (row.attempts >= EMAIL_OTP_MAX_ATTEMPTS) return false;
  return row.expires_at.getTime() > now.getTime();
}

// True when this account (60s cooldown) or this IP (5 requests per 15
// minutes) has already triggered an OTP challenge recently — same two
// thresholds issue #89 established for password-reset requests, reused
// here per issue #93's "比照 #89 的門檻" instruction. Both limits are
// derived from email_otp_challenges.created_at directly, no separate
// rate-limit store, mirroring lib/passwordReset.ts's
// isPasswordResetRateLimited — both go through the shared
// lib/rateLimiting.ts's isCooldownRateLimited (issue #139 M6).
export async function isEmailOtpRateLimited(userId: number, ip: string | null): Promise<boolean> {
  return isCooldownRateLimited("email_otp_challenges", userId, ip, {
    cooldownSeconds: EMAIL_COOLDOWN_SECONDS,
    windowMinutes: IP_WINDOW_MINUTES,
    maxRequests: IP_MAX_REQUESTS,
  });
}

// Caller (the login route) is expected to have already checked
// isEmailOtpRateLimited for this userId/ip before calling this — same
// two-step split as lib/passwordReset.ts's createPasswordResetToken.
// Returns the plaintext code alongside the challenge token so the caller can
// email it out immediately; only the hash is ever persisted.
export async function createEmailOtpChallenge(userId: number, ip: string | null): Promise<{ token: string; code: string }> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const code = generateEmailOtpCode();
  const codeHash = hashEmailOtpCode(token, code);
  const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);
  await db.query(
    "INSERT INTO email_otp_challenges (token, user_id, code_hash, request_ip, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())",
    [token, userId, codeHash, ip, expiresAt],
  );
  return { token, code };
}

export type VerifyEmailOtpOutcome = { ok: true; userId: number } | { ok: false; errorCode: ErrorCode };

// Validates the challenge (exists/unused/not-expired/under attempt cap),
// then compares the submitted code's hash against the stored one with a
// timing-safe comparison (both are fixed-length sha256 hex digests, so
// lengths always match). A wrong code increments attempts; reaching
// EMAIL_OTP_MAX_ATTEMPTS on that increment spends the whole challenge
// (used_at set) so a 6th guess can't be tried even against the same
// challenge — issue #93's explicit anti-bruteforce requirement, since the
// 6-digit space is only 1,000,000 wide. A correct code spends the challenge
// too (one-time use) and hands the userId back to the caller (the
// verify-email-otp route) to call createSession with.
export async function verifyEmailOtpChallenge(token: string, code: string): Promise<VerifyEmailOtpOutcome> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT user_id, code_hash, expires_at, attempts, used_at FROM email_otp_challenges WHERE token = ? LIMIT 1",
    [token],
  );
  const row = (rows as EmailOtpChallengeRow[])[0] ?? null;
  if (!isEmailOtpChallengeUsable(row)) {
    return { ok: false, errorCode: "EMAIL_OTP_INVALID" };
  }
  const usable = row as EmailOtpChallengeRow;

  const expected = Buffer.from(hashEmailOtpCode(token, code), "hex");
  const actual = Buffer.from(usable.code_hash, "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    const attempts = usable.attempts + 1;
    if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      await db.query("UPDATE email_otp_challenges SET attempts = ?, used_at = NOW() WHERE token = ?", [attempts, token]);
      return { ok: false, errorCode: "EMAIL_OTP_TOO_MANY_ATTEMPTS" };
    }
    await db.query("UPDATE email_otp_challenges SET attempts = ? WHERE token = ?", [attempts, token]);
    return { ok: false, errorCode: "EMAIL_OTP_INVALID" };
  }

  await db.query("UPDATE email_otp_challenges SET used_at = NOW() WHERE token = ?", [token]);
  return { ok: true, userId: usable.user_id };
}
