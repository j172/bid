// TOTP ("App 驗證碼") 2FA — issue #97, the fifth and final ticket of the
// account-security roadmap (#89 forgot password, #91 admin reset, #93 Email
// OTP, #95 passkeys). Mixes pure decision/crypto functions (isTotpCodeFormat/
// isBackupCodeFormat/hashBackupCode/isTotpSetupChallengeUsable — no DB
// access, directly unit-testable, same split lib/emailOtp.ts/lib/webauthn.ts
// use for their own pure functions) with raw-SQL CRUD against
// totp_setup_challenges/totp_backup_codes (see db/init.sql for both tables'
// header comments) and the users.totp_secret/two_factor_method columns.
//
// The setup wizard follows the exact two-stage pattern lib/webauthn.ts
// established for passkey registration: a freshly generated secret is
// stashed in totp_setup_challenges first (startTotpSetup), and only
// promoted to users.totp_secret once the visitor proves — by typing back a
// correct 6-digit code from their Authenticator app — that they actually
// captured it (confirmTotpSetup). Abandoning the wizard partway leaves
// users.totp_secret/two_factor_method untouched; the challenge row just
// expires unused.
import { createHash, randomBytes } from "crypto";
import * as OTPAuth from "otpauth";
import { getDb } from "@/lib/db";
import { RP_NAME } from "@/lib/webauthn";
import { setTwoFactorMethod, verifyPassword, type SetTwoFactorMethodOutcome } from "@/lib/auth";
import type { ErrorCode } from "@/lib/errorCodes";

export const TOTP_SETUP_TTL_MS = 10 * 60 * 1000; // 10 minutes — enough time to switch to an Authenticator app and back
export const BACKUP_CODE_COUNT = 10;
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
const TOTP_ALGORITHM = "SHA1"; // widest Authenticator-app compatibility (Google Authenticator etc only support SHA1)
const LOGIN_WINDOW = 1; // ±1 period (±30s) of clock drift tolerated at verify time

// Brute-force guard for the login-time check (code review follow-up to issue
// #97's initial PR): a TOTP code is still just a 6-digit space (1,000,000
// possibilities), same as #93's Email OTP, but unlike Email OTP there's no
// per-attempt challenge row to cap — see verifyTotpLogin's own header
// comment for why the cap lives on the account instead. 5 wrong tries (TOTP
// code or backup code, counted together) locks the account out of TOTP
// verification for 15 minutes — same attempt cap as EMAIL_OTP_MAX_ATTEMPTS
// in lib/emailOtp.ts, and the same 15-minute window
// lib/passwordReset.ts's/lib/emailOtp.ts's own IP rate limits use elsewhere
// in this project, reused here for consistency rather than picking a new
// number.
export const TOTP_LOGIN_MAX_ATTEMPTS = 5;
export const TOTP_LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function buildTotp(secret: string, label?: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: RP_NAME,
    label,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

// Pure: a fresh random base32 secret, one per setup attempt.
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

// Pure: the otpauth:// URI an Authenticator app's QR scanner understands —
// label is the account identifier shown inside the app (this project uses
// the visitor's email, same identifier @simplewebauthn's registration
// options use as userName — see app/api/account/webauthn/register-options/
// route.ts).
export function buildTotpUri(secret: string, label: string): string {
  return buildTotp(secret, label).toString();
}

// Pure (aside from reading the clock): true when `code` is a valid current
// TOTP code for `secret`, within LOGIN_WINDOW periods of drift either way.
// `timestamp` is an explicit param (defaulting to the real clock) so tests
// don't need to fake system time — same pattern lib/passwordReset.ts's
// isResetTokenValid and lib/webauthn.ts's isWebauthnChallengeUsable use for
// their own `now` params.
export function verifyTotpCode(secret: string, code: string, timestamp: number = Date.now()): boolean {
  const totp = buildTotp(secret);
  return totp.validate({ token: code.trim(), window: LOGIN_WINDOW, timestamp }) !== null;
}

// Pure: distinguishes a 6-digit TOTP code from a backup code at the login
// verify step, so the caller knows which check to run — see verifyTotpLogin.
export function isTotpCodeFormat(input: string): boolean {
  return /^[0-9]{6}$/.test(input.trim());
}

// Pure: backup codes are 10 lowercase hex characters split into two groups
// of 5 (see generateBackupCode) — never all-digits-only by construction
// isn't guaranteed, but the fixed "5 hex chars-dash-5 hex chars" shape never
// collides with a bare 6-digit TOTP code, which is all this needs to do.
export function isBackupCodeFormat(input: string): boolean {
  return /^[0-9a-f]{5}-[0-9a-f]{5}$/i.test(input.trim());
}

// Pure: one fresh one-time backup code, cryptographically random (same
// randomBytes rigor as lib/auth.ts's session tokens) — never derived from
// anything guessable.
export function generateBackupCode(): string {
  const raw = randomBytes(5).toString("hex"); // 10 hex chars
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

// sha256 of the normalized (trimmed, lowercased) code — no per-row salt
// needed, unlike lib/emailOtp.ts's hashEmailOtpCode: a backup code is itself
// a 40-bit-random value (2^40 possibilities), not a low-entropy 6-digit
// space, so a fast unsalted hash can't usefully be rainbow-tabled in bulk.
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

interface TotpSetupChallengeRow {
  user_id: number;
  secret: string;
  expires_at: Date;
  used_at: Date | null;
}

// Pure: mirrors lib/webauthn.ts's isWebauthnChallengeUsable / lib/emailOtp.ts's
// isEmailOtpChallengeUsable — a setup challenge is usable exactly when it
// exists, has never been spent, and hasn't passed its 10-minute expiry.
export function isTotpSetupChallengeUsable(row: TotpSetupChallengeRow | null, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.used_at !== null) return false;
  return row.expires_at.getTime() > now.getTime();
}

// Pure: mirrors isTotpSetupChallengeUsable/isResetTokenValid's `now` param
// pattern — true exactly when a lockout is currently in effect (a
// totp_locked_until in the past, or never set, means "not locked").
export function isTotpLoginLocked(lockedUntil: Date | null, now: Date = new Date()): boolean {
  if (!lockedUntil) return false;
  return lockedUntil.getTime() > now.getTime();
}

export interface TotpSetupStart {
  token: string;
  secret: string;
  otpauthUri: string;
}

// Step 1 of the setup wizard (issue #97) — generates a brand-new secret and
// stashes it in totp_setup_challenges, never touching users.totp_secret.
// Called by POST /api/account/totp/setup; email is the visitor's own
// address, used purely as the QR code's display label.
export async function startTotpSetup(userId: number, email: string): Promise<TotpSetupStart> {
  const db = await getDb();
  const secret = generateTotpSecret();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOTP_SETUP_TTL_MS);
  await db.query(
    "INSERT INTO totp_setup_challenges (token, user_id, secret, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())",
    [token, userId, secret, expiresAt],
  );
  return { token, secret, otpauthUri: buildTotpUri(secret, email) };
}

export type ConfirmTotpSetupOutcome =
  | { ok: true; backupCodes: string[] }
  | { ok: false; errorCode: ErrorCode };

// Step 2 (issue #97) — the counterpart to startTotpSetup, called by POST
// /api/account/totp/confirm. Requires the current password (same
// WRONG_OLD_PASSWORD errorCode and rationale as lib/auth.ts's
// setTwoFactorMethod: a session hijacker who doesn't know the password must
// not be able to enroll a second factor of their own choosing) *and* a
// correct 6-digit code from the app the visitor just scanned the QR into.
// A wrong code leaves the challenge alone (not spent) so the visitor can
// retry without re-scanning, up until the challenge's own 10-minute expiry —
// only a *correct* code spends it, moves the secret into users.totp_secret,
// flips two_factor_method to 'totp' (overwriting whatever it was before,
// e.g. 'email_otp' — issue #97's mutex requirement, already satisfied by
// this being the same single column #93 introduced), and mints a fresh set
// of BACKUP_CODE_COUNT one-time recovery codes. The plaintext codes are
// returned to the caller to show the visitor exactly once; only their
// hashes are persisted.
export async function confirmTotpSetup(
  userId: number,
  currentPassword: string,
  token: string,
  code: string,
): Promise<ConfirmTotpSetupOutcome> {
  const db = await getDb();

  const [userRows] = await db.query("SELECT password_hash, password_salt FROM users WHERE id = ? LIMIT 1", [userId]);
  const userRow = (userRows as { password_hash: string; password_salt: string }[])[0];
  if (!userRow || !(await verifyPassword(currentPassword, userRow.password_hash, userRow.password_salt))) {
    return { ok: false, errorCode: "WRONG_OLD_PASSWORD" };
  }

  const [challengeRows] = await db.query(
    "SELECT user_id, secret, expires_at, used_at FROM totp_setup_challenges WHERE token = ? LIMIT 1",
    [token],
  );
  const challengeRow = (challengeRows as TotpSetupChallengeRow[])[0] ?? null;
  if (!isTotpSetupChallengeUsable(challengeRow) || challengeRow!.user_id !== userId) {
    return { ok: false, errorCode: "TOTP_SETUP_CHALLENGE_INVALID" };
  }
  const secret = challengeRow!.secret;

  if (!verifyTotpCode(secret, code)) {
    return { ok: false, errorCode: "TOTP_CODE_INVALID" };
  }

  await db.query("UPDATE totp_setup_challenges SET used_at = NOW() WHERE token = ?", [token]);
  // Also clears any stale totp_failed_attempts/totp_locked_until from a
  // previous enable/disable cycle — a fresh setup should never inherit an
  // old lockout.
  await db.query(
    "UPDATE users SET totp_secret = ?, two_factor_method = 'totp', totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = ?",
    [secret, userId],
  );

  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateBackupCode());
  const rows = backupCodes.map((backupCode) => [userId, hashBackupCode(backupCode), new Date()]);
  await db.query("INSERT INTO totp_backup_codes (user_id, code_hash, created_at) VALUES ?", [rows]);

  return { ok: true, backupCodes };
}

// Admin/self disable path (issue #97) — reuses lib/auth.ts's
// setTwoFactorMethod for the password check + two_factor_method flip back to
// 'none' (same errorCode, same rationale as its own header comment), then
// additionally clears totp_secret and every backup code row so a later
// re-enable always starts from a clean slate rather than resurrecting old
// codes. Symmetric with adminDisableTwoFactor in lib/auth.ts, which already
// covers the *admin* rescue path for a locked-out account (it just forces
// two_factor_method to 'none' — this function's own DB cleanup below is
// deliberately not duplicated there; an admin-disabled account simply leaves
// totp_secret/totp_backup_codes behind as inert rows, same tolerance
// db/init.sql's users.totp_secret comment documents).
export async function disableTotp(userId: number, currentPassword: string): Promise<SetTwoFactorMethodOutcome> {
  const result = await setTwoFactorMethod(userId, currentPassword, "none");
  if (!result.ok) return result;

  const db = await getDb();
  await db.query("UPDATE users SET totp_secret = NULL, totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = ?", [
    userId,
  ]);
  await db.query("DELETE FROM totp_backup_codes WHERE user_id = ?", [userId]);
  return { ok: true };
}

export type VerifyAndConsumeBackupCodeOutcome = { ok: true; remaining: number } | { ok: false };

// Atomically redeems one unused backup code: the UPDATE's own
// `used_at IS NULL` guard is the check-and-set, so two concurrent requests
// racing the same code can never both succeed (unlike a SELECT-then-UPDATE
// pair, which would have a TOCTOU gap here).
export async function verifyAndConsumeBackupCode(userId: number, code: string): Promise<VerifyAndConsumeBackupCodeOutcome> {
  const db = await getDb();
  const codeHash = hashBackupCode(code);
  const [result] = await db.query(
    "UPDATE totp_backup_codes SET used_at = NOW() WHERE user_id = ? AND code_hash = ? AND used_at IS NULL",
    [userId, codeHash],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false };
  }

  const [rows] = await db.query("SELECT COUNT(*) AS cnt FROM totp_backup_codes WHERE user_id = ? AND used_at IS NULL", [
    userId,
  ]);
  const remaining = (rows as { cnt: number }[])[0].cnt;
  return { ok: true, remaining };
}

export type VerifyTotpLoginOutcome =
  | { ok: true; usedBackupCode: boolean; remainingBackupCodes?: number }
  | { ok: false; errorCode: ErrorCode };

// Second step of the TOTP login flow (issue #97) — the counterpart to
// app/api/auth/login/route.ts's twoFactorRequired branch, called by POST
// /api/auth/verify-totp. Accepts either a 6-digit app code or a backup code,
// deciding which check to run by format alone (see isTotpCodeFormat/
// isBackupCodeFormat) rather than trying both blindly. A single
// TOTP_CODE_INVALID errorCode covers every failure shape (unknown format,
// wrong app code, unknown/already-used backup code, or the account somehow
// not actually having a totp_secret) — same "don't leak which check failed"
// principle as lib/emailOtp.ts's EMAIL_OTP_INVALID.
//
// Brute-force guard (code review follow-up): an attacker who already knows
// an account's email+password would otherwise be able to hammer this route
// with unlimited code guesses — unlike Email OTP, there's no challenge
// row/rate-limited email send to throttle them. So this reads (and, on a
// wrong guess, writes back) the account's own totp_failed_attempts/
// totp_locked_until columns instead: a locked-out account short-circuits
// before even looking at the submitted code (isTotpLoginLocked), and every
// non-success — wrong TOTP code, wrong/reused backup code, or garbage in an
// unrecognized format — counts toward the same TOTP_LOGIN_MAX_ATTEMPTS cap,
// which locks the account out for TOTP_LOGIN_LOCKOUT_MS once reached. A
// success resets both columns back to 0/NULL.
export async function verifyTotpLogin(userId: number, code: string): Promise<VerifyTotpLoginOutcome> {
  const trimmed = code.trim();
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT totp_secret, totp_failed_attempts, totp_locked_until FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  const row = (rows as { totp_secret: string | null; totp_failed_attempts: number; totp_locked_until: Date | null }[])[0];
  if (!row || !row.totp_secret) {
    return { ok: false, errorCode: "TOTP_CODE_INVALID" };
  }
  if (isTotpLoginLocked(row.totp_locked_until)) {
    return { ok: false, errorCode: "TOTP_LOGIN_LOCKED" };
  }

  let usedBackupCode = false;
  let remainingBackupCodes: number | undefined;
  let succeeded: boolean;

  if (isTotpCodeFormat(trimmed)) {
    succeeded = verifyTotpCode(row.totp_secret, trimmed);
  } else if (isBackupCodeFormat(trimmed)) {
    const result = await verifyAndConsumeBackupCode(userId, trimmed);
    succeeded = result.ok;
    if (result.ok) {
      usedBackupCode = true;
      remainingBackupCodes = result.remaining;
    }
  } else {
    succeeded = false;
  }

  if (!succeeded) {
    const nextAttempts = row.totp_failed_attempts + 1;
    if (nextAttempts >= TOTP_LOGIN_MAX_ATTEMPTS) {
      await db.query("UPDATE users SET totp_failed_attempts = ?, totp_locked_until = ? WHERE id = ?", [
        nextAttempts,
        new Date(Date.now() + TOTP_LOGIN_LOCKOUT_MS),
        userId,
      ]);
    } else {
      await db.query("UPDATE users SET totp_failed_attempts = ? WHERE id = ?", [nextAttempts, userId]);
    }
    return { ok: false, errorCode: "TOTP_CODE_INVALID" };
  }

  if (row.totp_failed_attempts > 0 || row.totp_locked_until !== null) {
    await db.query("UPDATE users SET totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = ?", [userId]);
  }

  return { ok: true, usedBackupCode, remainingBackupCodes };
}
