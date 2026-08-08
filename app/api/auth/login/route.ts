import { NextResponse } from "next/server";
import { createSession, findUserByEmail, verifyPassword } from "@/lib/auth";
import { createEmailOtpChallenge, isEmailOtpRateLimited } from "@/lib/emailOtp";
import { clearLoginFailures, isLoginRateLimited, recordLoginFailure } from "@/lib/loginRateLimit";
import { sendEmailOtpEmail } from "@/lib/notifications";
import { getClientIpFromHeaders } from "@/lib/clientIp";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = getClientIpFromHeaders(request.headers);

  // Password brute-force guard (issue #140 H-1) — checked before the scrypt
  // comparison so a locked-out email/IP costs nothing to reject, and before
  // findUserByEmail so the response is identical whether or not the email is
  // registered. Same 429 status the email_otp branch below already uses for
  // EMAIL_OTP_RATE_LIMITED: "come back later", not "your input was wrong".
  if (await isLoginRateLimited(email, ip)) {
    return NextResponse.json({ ok: false, errorCode: "LOGIN_RATE_LIMITED" }, { status: 429 });
  }

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    await recordLoginFailure(email, ip);
    return NextResponse.json({ ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" }, { status: 401 });
  }
  // The password was right, so this email's strikes are cleared here rather
  // than after any 2FA branch below — the password is what this guard
  // protects, and a visitor who mistyped twice before getting it right must
  // not carry those strikes forward.
  await clearLoginFailures(email);

  if (user.suspended_at !== null) {
    return NextResponse.json({ ok: false, errorCode: "ACCOUNT_SUSPENDED" }, { status: 403 });
  }

  // Registration email-ownership verification (issue #118, strict mode):
  // checked before any 2FA branch below, since an unverified account never
  // gets a session either way — there's nothing for a second factor to
  // gate yet. Deliberately checked here rather than at registration time
  // only, since this is what actually keeps an unverified account out, not
  // the registration route's own choice not to call createSession.
  if (!user.email_verified) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_NOT_VERIFIED" }, { status: 403 });
  }

  // Email OTP (issue #93): the password alone isn't enough for this account
  // — issue a pending challenge and email its code instead of calling
  // createSession directly. The response carries a challengeToken, never a
  // session cookie, until POST /api/auth/verify-email-otp confirms the code.
  if (user.two_factor_method === "email_otp") {
    if (await isEmailOtpRateLimited(user.id, ip)) {
      return NextResponse.json({ ok: false, errorCode: "EMAIL_OTP_RATE_LIMITED" }, { status: 429 });
    }

    const { token, code } = await createEmailOtpChallenge(user.id, ip);
    await sendEmailOtpEmail(user.email, user.locale, code);

    return NextResponse.json({ ok: true, twoFactorRequired: true, twoFactorMethod: "email_otp", challengeToken: token });
  }

  // TOTP (issue #97) — parallel to the email_otp branch above, but with no
  // challenge to issue or email to send: the secret already lives on the
  // visitor's own device, so this response just tells the front end "collect
  // a TOTP/backup code next" (twoFactorMethod, no challengeToken). Unlike
  // Email OTP, there is no pending-challenge row identifying which account
  // is mid-login — POST /api/auth/verify-totp re-verifies the email/password
  // pair itself instead (see that route's header comment), so this branch
  // deliberately does nothing more than report which second factor is
  // required.
  if (user.two_factor_method === "totp") {
    return NextResponse.json({ ok: true, twoFactorRequired: true, twoFactorMethod: "totp" });
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
}
