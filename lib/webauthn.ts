// WebAuthn / passkey support (issue #95) — the fourth part of the account
// security roadmap (#89 forgot password, #91 admin reset, #93 Email OTP).
// Unlike those three, the passkey ceremony itself is already a strong,
// browser-mediated factor (challenge + origin/RP-ID binding + a device
// biometric/PIN) with no email involved — so per issue #95's "防濫用"
// section there's no rate limit to layer on top here.
//
// This module owns two things: (1) the RP (Relying Party) configuration
// generateRegistrationOptions/generateAuthenticationOptions/
// verifyRegistrationResponse/verifyAuthenticationResponse all need, and (2)
// short-lived challenge storage — every WebAuthn ceremony is a two-step
// round trip (options → browser → verify) and the challenge the browser
// signed has to be looked back up on the verify step. The storage mirrors
// lib/emailOtp.ts/lib/passwordReset.ts's token-table shape (a random token
// as its own primary key, TTL via expires_at, one-time-use via used_at) but
// the token itself never reaches client-side JS — it's carried in an
// httpOnly cookie exactly like lib/auth.ts's session cookie, since (unlike
// the email OTP code, which the visitor types back in by hand) there's no
// reason for it to ever be visible to page script.
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

export const RP_NAME = "拍賣競標";

// Resolved from NODE_ENV rather than the request's Host header (contrast
// lib/newsNewsletterSync.ts's resolveOrigin, used for outbound email link
// text) because a WebAuthn ceremony fails outright on any origin/RP-ID
// mismatch — a wrong guess here isn't a cosmetic bug, it's a broken
// feature. WEBAUTHN_RP_ID/WEBAUTHN_ORIGIN env vars are optional overrides
// for anything unusual (e.g. staging on another domain); production
// defaults to this site's real domain, everything else (local dev, CI)
// falls back to localhost:3000. `nodeEnv` is an explicit param (defaulting
// to the real process.env.NODE_ENV) so this stays directly unit-testable —
// same style as lib/passwordReset.ts's isResetTokenValid taking `now`.
export function resolveWebauthnRp(nodeEnv: string | undefined = process.env.NODE_ENV): {
  rpID: string;
  origin: string;
} {
  const isProd = nodeEnv === "production";
  const rpID = process.env.WEBAUTHN_RP_ID ?? (isProd ? "j172.tw" : "localhost");
  const origin = process.env.WEBAUTHN_ORIGIN ?? (isProd ? "https://j172.tw" : "http://localhost:3000");
  return { rpID, origin };
}

export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type WebauthnChallengePurpose = "register" | "login";

interface WebauthnChallengeRow {
  challenge: string;
  purpose: WebauthnChallengePurpose;
  user_id: number | null;
  expires_at: Date;
  used_at: Date | null;
}

// Pure: mirrors lib/passwordReset.ts's isResetTokenValid / lib/emailOtp.ts's
// isEmailOtpChallengeUsable — a challenge is usable exactly when it exists,
// was issued for the purpose it's now being consumed for (a registration
// challenge can't be replayed against the login-verify route, or vice
// versa), has never been spent, and hasn't passed its 5-minute expiry.
export function isWebauthnChallengeUsable(
  row: WebauthnChallengeRow | null,
  purpose: WebauthnChallengePurpose,
  now: Date = new Date(),
): boolean {
  if (!row) return false;
  if (row.purpose !== purpose) return false;
  if (row.used_at !== null) return false;
  return row.expires_at.getTime() > now.getTime();
}

// userId is set for the registration flow (bound to whoever is logged in
// when the challenge is requested — checked again in consumeWebauthnChallenge
// so the verify step can't be replayed against a different account) and null
// for the login flow (issue #95's usernameless/discoverable-credential flow
// — there's no account to bind to until the browser itself picks a passkey).
export async function createWebauthnChallenge(
  purpose: WebauthnChallengePurpose,
  userId: number | null,
  challenge: string,
): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + WEBAUTHN_CHALLENGE_TTL_MS);
  await db.query(
    "INSERT INTO webauthn_challenges (token, challenge, purpose, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
    [token, challenge, purpose, userId, expiresAt],
  );
  return token;
}

export type ConsumeWebauthnChallengeOutcome =
  | { ok: true; challenge: string; userId: number | null }
  | { ok: false };

// One-time use, same as verifyEmailOtpChallenge's used_at handling — a
// challenge is marked spent on this lookup regardless of what the caller
// does with it next, so a verify request can never be retried against the
// same challenge twice.
export async function consumeWebauthnChallenge(
  token: string,
  purpose: WebauthnChallengePurpose,
): Promise<ConsumeWebauthnChallengeOutcome> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT challenge, purpose, user_id, expires_at, used_at FROM webauthn_challenges WHERE token = ? LIMIT 1",
    [token],
  );
  const row = (rows as WebauthnChallengeRow[])[0] ?? null;
  if (!isWebauthnChallengeUsable(row, purpose)) {
    return { ok: false };
  }
  await db.query("UPDATE webauthn_challenges SET used_at = NOW() WHERE token = ?", [token]);
  const usable = row as WebauthnChallengeRow;
  return { ok: true, challenge: usable.challenge, userId: usable.user_id };
}

// The challenge token is carried in an httpOnly cookie, one name per
// purpose so a registration ceremony started on the account page can't
// collide with a login ceremony started in another tab. Short-lived (matches
// WEBAUTHN_CHALLENGE_TTL_MS) and cleared as soon as the verify step consumes
// it — same secure/sameSite/path shape as lib/auth.ts's session cookie,
// minus httpOnly's usual long life.
const CHALLENGE_COOKIE_NAMES: Record<WebauthnChallengePurpose, string> = {
  register: "webauthn_register_challenge",
  login: "webauthn_login_challenge",
};

export async function setWebauthnChallengeCookie(purpose: WebauthnChallengePurpose, token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE_NAMES[purpose], token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: WEBAUTHN_CHALLENGE_TTL_MS / 1000,
  });
}

export async function readWebauthnChallengeCookie(purpose: WebauthnChallengePurpose): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CHALLENGE_COOKIE_NAMES[purpose])?.value ?? null;
}

export async function clearWebauthnChallengeCookie(purpose: WebauthnChallengePurpose): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CHALLENGE_COOKIE_NAMES[purpose]);
}
