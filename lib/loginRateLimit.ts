// Brute-force guard for the two routes that verify an email+password pair —
// POST /api/auth/login and POST /api/auth/verify-totp (issue #140 H-1).
// Until this ticket, every *second* factor in this project was rate limited
// (lib/emailOtp.ts's per-account cooldown + per-IP window, lib/totp.ts's
// 5-strikes-then-15-minutes account lockout, lib/passwordReset.ts's
// per-account + per-IP window) while the password check itself — the one
// step every login goes through — had no cap at all, leaving password
// dictionary attacks and credential stuffing unthrottled.
//
// Same shape as its sibling rate-limit modules: a pure decision function
// (isLoginLocked, no DB access, directly unit-testable — the split
// lib/passwordReset.ts's isResetTokenValid and lib/totp.ts's
// isTotpLoginLocked already use) plus raw-SQL helpers over login_attempts
// (see db/init.sql for that table's header comment).
import { getDb } from "@/lib/db";

// 5 failures then locked out — deliberately the same cap/window as
// lib/totp.ts's TOTP_LOGIN_MAX_ATTEMPTS/TOTP_LOGIN_LOCKOUT_MS and
// lib/emailOtp.ts's EMAIL_OTP_MAX_ATTEMPTS rather than a new number, so a
// visitor sees consistent "5 tries, then wait 15 minutes" behaviour whichever
// credential they're getting wrong.
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MINUTES = 15;

// The per-IP limit is much looser than the per-email one on purpose: a
// shared NAT/office/campus egress IP legitimately produces many failures
// from many different people, so this is sized to stop credential stuffing
// (one guess each against hundreds of *different* emails, which the
// per-email counter alone would never see) without locking out a whole
// office because five colleagues each fumbled their password once.
export const LOGIN_IP_MAX_FAILURES = 50;

// Pure: locked exactly when the number of failures recorded inside the
// window has reached its cap. `failures` is a count already restricted to
// the last LOGIN_WINDOW_MINUTES by the SQL below, which is what makes a
// lockout expire on its own — once the oldest failures age out of the
// window the count drops back under the cap with no unlock step needed.
export function isLoginLocked(failures: number, max: number = LOGIN_MAX_FAILURES): boolean {
  return failures >= max;
}

// True when this email (5 failures / 15 minutes) or this IP (50 failures /
// 15 minutes) has failed the password check too often recently. Callers
// check this *before* verifying the password, so a locked-out account never
// even reaches the scrypt comparison. Deliberately keyed on the submitted
// email rather than a users.id: an attacker probing addresses that aren't
// registered must be counted the same way as one probing a real account
// (see db/init.sql's login_attempts header comment).
export async function isLoginRateLimited(email: string, ip: string | null): Promise<boolean> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail !== "") {
    const [emailRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM login_attempts
       WHERE email = ? AND created_at > NOW() - INTERVAL ${LOGIN_WINDOW_MINUTES} MINUTE`,
      [normalizedEmail],
    );
    if (isLoginLocked((emailRows as { cnt: number }[])[0].cnt)) return true;
  }

  if (ip) {
    const [ipRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM login_attempts
       WHERE request_ip = ? AND created_at > NOW() - INTERVAL ${LOGIN_WINDOW_MINUTES} MINUTE`,
      [ip],
    );
    if (isLoginLocked((ipRows as { cnt: number }[])[0].cnt, LOGIN_IP_MAX_FAILURES)) return true;
  }

  return false;
}

// One row per failed password check. Called by the login/verify-totp routes
// on every EMAIL_OR_PASSWORD_INCORRECT — including the "no such user" branch,
// so an unregistered email is throttled identically to a registered one.
export async function recordLoginFailure(email: string, ip: string | null): Promise<void> {
  const db = await getDb();
  await db.query("INSERT INTO login_attempts (email, request_ip, created_at) VALUES (?, ?, NOW())", [
    email.trim().toLowerCase(),
    ip,
  ]);
}

// Called as soon as the password check passes (before any 2FA branch — the
// password is what this module guards, and it was correct). Mirrors
// verifyTotpLogin resetting totp_failed_attempts/totp_locked_until on
// success: a visitor who mistypes twice then gets it right must not carry
// those two strikes into their next login.
export async function clearLoginFailures(email: string): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM login_attempts WHERE email = ?", [email.trim().toLowerCase()]);
}
