import { NextResponse } from "next/server";
import { createSession, findUserByEmail, verifyPassword } from "@/lib/auth";
import { clearLoginFailures, isLoginRateLimited, recordLoginFailure } from "@/lib/loginRateLimit";
import { verifyTotpLogin } from "@/lib/totp";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { verifyGoogle2faChallenge } from "@/lib/googleAuth";

// Second step of the TOTP login flow (issue #97, extended for Google login by #237).
// Supports either:
// 1. challengeToken (issued during Google One Tap / Google Sign-in verification)
// 2. email + password verification (traditional login)
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const challengeToken = typeof body?.challengeToken === "string" ? body.challengeToken.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : "";
  const ip = getClientIpFromHeaders(request.headers);

  let targetUserId: number;
  let targetUserEmail: string;

  if (challengeToken) {
    const challenge = verifyGoogle2faChallenge(challengeToken);
    if (!challenge) {
      return NextResponse.json({ ok: false, errorCode: "TOTP_CODE_INVALID" }, { status: 400 });
    }
    targetUserId = challenge.userId;
    targetUserEmail = challenge.email;
  } else {
    // Because this route re-verifies email+password itself (see above), it is a
    // second password-guessing surface and gets the same brute-force guard as
    // the login route (issue #140 H-1) — otherwise an attacker could simply
    // move their password dictionary over here to sidestep it. Separate from
    // verifyTotpLogin's own totp_failed_attempts cap below, which counts wrong
    // *codes* on an account whose password is already known-correct.
    if (await isLoginRateLimited(email, ip)) {
      return NextResponse.json({ ok: false, errorCode: "LOGIN_RATE_LIMITED" }, { status: 429 });
    }

    // Cloudflare Turnstile, same second layer the login route now applies and
    // for the same reason this route already duplicates the brute-force guard:
    // it re-verifies email+password itself, so leaving it without a token
    // requirement would just move the cheap-attempt surface over here. The
    // login page renders a *separate* widget instance for this step — a
    // Turnstile token is single-use, so the one spent on POST /api/auth/login
    // cannot be replayed here.
    if (!(await verifyTurnstileToken(turnstileToken, ip))) {
      return NextResponse.json({ ok: false, errorCode: "TURNSTILE_VERIFICATION_FAILED" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (
      !user ||
      !user.password_hash ||
      !user.password_salt ||
      !(await verifyPassword(password, user.password_hash, user.password_salt))
    ) {
      await recordLoginFailure(email, ip);
      return NextResponse.json({ ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" }, { status: 401 });
    }
    await clearLoginFailures(email);
    targetUserId = user.id;
    targetUserEmail = user.email;
  }

  const user = await findUserByEmail(targetUserEmail);
  if (!user || user.id !== targetUserId) {
    return NextResponse.json({ ok: false, errorCode: "NOT_FOUND" }, { status: 404 });
  }

  if (user.suspended_at !== null) {
    return NextResponse.json({ ok: false, errorCode: "ACCOUNT_SUSPENDED" }, { status: 403 });
  }
  if (user.two_factor_method !== "totp") {
    return NextResponse.json({ ok: false, errorCode: "TOTP_CODE_INVALID" }, { status: 400 });
  }

  const result = await verifyTotpLogin(user.id, code);
  if (!result.ok) {
    // TOTP_LOGIN_LOCKED (verifyTotpLogin's brute-force guard) gets the same
    // 429 status as the login route's EMAIL_OTP_RATE_LIMITED — both mean
    // "come back later", not "your input was wrong".
    const status = result.errorCode === "TOTP_LOGIN_LOCKED" ? 429 : 400;
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status });
  }

  await createSession(user.id);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, role: user.role },
    usedBackupCode: result.usedBackupCode,
    remainingBackupCodes: result.remainingBackupCodes,
  });
}
