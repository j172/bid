// Shared "account cooldown + per-IP window" rate-limit check reused by
// lib/passwordReset.ts's isPasswordResetRateLimited, lib/emailVerification.ts's
// isEmailVerificationRateLimited, and lib/emailOtp.ts's isEmailOtpRateLimited
// (issue #139 M6) — all three ran the identical two-query shape (a short
// per-account cooldown, then a looser per-IP window) against their own
// token/challenge table, down to the same constant values, differing only in
// the table name.
//
// Deliberately NOT extended to cover lib/loginRateLimit.ts's
// isLoginRateLimited: that one counts *failures* against a flat cap on both
// sides (no cooldown half), a genuinely different shape rather than the same
// logic with different numbers — forcing it into this signature would either
// change its behavior or need an escape hatch that defeats the point of
// sharing.
import { getDb } from "@/lib/db";

export interface CooldownRateLimitOptions {
  /** How long after the account's most recent row (created_at) it must wait before trying again. */
  cooldownSeconds: number;
  /** Window over which per-IP requests are counted. */
  windowMinutes: number;
  /** Requests within windowMinutes for the same IP that trip the limit (reached, not just crossed). */
  maxRequests: number;
}

/**
 * True when this account (any row within `cooldownSeconds`) or this IP
 * (`maxRequests` rows within `windowMinutes`) has already triggered a
 * request recently — derived from `table`'s own `created_at`/`request_ip`
 * columns directly, no separate rate-limit store.
 *
 * `table` is a module-level constant supplied by the caller, never user
 * input — same convention as lib/search.ts's buildKeywordSearch `columns`.
 */
export async function isCooldownRateLimited(
  table: string,
  userId: number,
  ip: string | null,
  options: CooldownRateLimitOptions,
): Promise<boolean> {
  const db = await getDb();

  const [accountRows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM ${table}
     WHERE user_id = ? AND created_at > NOW() - INTERVAL ${options.cooldownSeconds} SECOND`,
    [userId],
  );
  if ((accountRows as { cnt: number }[])[0].cnt > 0) return true;

  if (ip) {
    const [ipRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM ${table}
       WHERE request_ip = ? AND created_at > NOW() - INTERVAL ${options.windowMinutes} MINUTE`,
      [ip],
    );
    if ((ipRows as { cnt: number }[])[0].cnt >= options.maxRequests) return true;
  }

  return false;
}
