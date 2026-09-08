import { createHmac, timingSafeEqual } from "crypto";
import { OAuth2Client } from "google-auth-library";
import {
  createGoogleUser,
  createSession,
  findUserByEmail,
  findUserByGoogleId,
  linkGoogleId,
  type CurrentUser,
} from "@/lib/auth";
import { createEmailOtpChallenge, isEmailOtpRateLimited } from "@/lib/emailOtp";
import { sendEmailOtpEmail } from "@/lib/notifications";
import type { ErrorCode } from "@/lib/errorCodes";

const oauthClient = new OAuth2Client();

export interface GooglePayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export type GoogleAuthOutcome =
  | { ok: true; twoFactorRequired: false; user: CurrentUser }
  | { ok: true; twoFactorRequired: true; twoFactorMethod: "email_otp"; challengeToken: string }
  | { ok: true; twoFactorRequired: true; twoFactorMethod: "totp"; challengeToken: string; email: string }
  | { ok: false; errorCode: ErrorCode };

function getGoogleClientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}

function getHmacSecret(): string {
  return process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "bid-google-challenge-secret";
}

export async function verifyGoogleIdToken(idToken: string): Promise<GooglePayload | null> {
  const audience = getGoogleClientId();
  if (!audience) {
    return null;
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: Boolean(payload.email_verified),
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function createGoogle2faChallenge(userId: number, email: string): string {
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const payload = `${userId}:${email}:${expiresAt}`;
  const hmac = createHmac("sha256", getHmacSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function verifyGoogle2faChallenge(challengeToken: string): { userId: number; email: string } | null {
  try {
    const decoded = Buffer.from(challengeToken, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [userIdStr, email, expiresAtStr, signature] = parts;
    const userId = Number(userIdStr);
    const expiresAt = Number(expiresAtStr);

    if (!userId || !email || !expiresAt || isNaN(userId) || isNaN(expiresAt)) {
      return null;
    }

    if (Date.now() > expiresAt) {
      return null;
    }

    const payload = `${userId}:${email}:${expiresAt}`;
    const expected = createHmac("sha256", getHmacSecret()).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    return { userId, email };
  } catch {
    return null;
  }
}

export async function authenticateWithGooglePayload(
  payload: GooglePayload,
  locale: string,
  ip: string | null,
): Promise<GoogleAuthOutcome> {
  if (!payload.email_verified) {
    return { ok: false, errorCode: "EMAIL_NOT_VERIFIED" };
  }

  // 1. Look up by google_id
  let user = await findUserByGoogleId(payload.sub);

  // 2. If not found by google_id, check by email and link
  if (!user) {
    user = await findUserByEmail(payload.email);
    if (user) {
      await linkGoogleId(user.id, payload.sub);
    }
  }

  // 3. If still not found, auto-register
  if (!user) {
    const newUser = await createGoogleUser({
      email: payload.email,
      googleId: payload.sub,
      displayName: payload.name,
      locale,
    });
    await createSession(newUser.id);
    return {
      ok: true,
      twoFactorRequired: false,
      user: newUser,
    };
  }

  // Check suspension
  if (user.suspended_at !== null) {
    return { ok: false, errorCode: "ACCOUNT_SUSPENDED" };
  }

  // Enforce 2FA if active on account
  if (user.two_factor_method === "email_otp") {
    if (await isEmailOtpRateLimited(user.id, ip)) {
      return { ok: false, errorCode: "EMAIL_OTP_RATE_LIMITED" };
    }
    const { token, code } = await createEmailOtpChallenge(user.id, ip);
    await sendEmailOtpEmail(user.email, user.locale || locale, code);
    return {
      ok: true,
      twoFactorRequired: true,
      twoFactorMethod: "email_otp",
      challengeToken: token,
    };
  }

  if (user.two_factor_method === "totp") {
    const challengeToken = createGoogle2faChallenge(user.id, user.email);
    return {
      ok: true,
      twoFactorRequired: true,
      twoFactorMethod: "totp",
      challengeToken,
      email: user.email,
    };
  }

  // No 2FA required: create session directly
  await createSession(user.id);
  return {
    ok: true,
    twoFactorRequired: false,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}
