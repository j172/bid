import { NextResponse } from "next/server";
import { createSession, findUserByEmail, verifyPassword } from "@/lib/auth";
import { verifyTotpLogin } from "@/lib/totp";

// Second step of the TOTP login flow (issue #97) — the counterpart to
// app/api/auth/login/route.ts's twoFactorRequired branch. Unlike
// app/api/auth/verify-email-otp/route.ts, there is no challengeToken to
// redeem (see the login route's header comment on that branch): the secret
// lives on the visitor's device, not in any server-side pending-challenge
// row, so this route re-verifies email+password itself (same check as the
// login route, deliberately duplicated rather than trusting an unauthenticated
// claim of "I already passed the password check") before checking the
// TOTP/backup code. createSession is only ever reached after both checks
// pass — the one additional call site issue #97 requires, alongside the
// no-2FA branch of the login route, the Email OTP verify route, and the
// passkey login-verify route.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code : "";

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" }, { status: 401 });
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
