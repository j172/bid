import { NextResponse } from "next/server";
import { createSession, findUserByEmail, verifyPassword } from "@/lib/auth";
import { createEmailOtpChallenge, isEmailOtpRateLimited } from "@/lib/emailOtp";
import { sendEmailOtpEmail } from "@/lib/notifications";
import { getClientIpFromHeaders } from "@/lib/clientIp";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" }, { status: 401 });
  }
  if (user.suspended_at !== null) {
    return NextResponse.json({ ok: false, errorCode: "ACCOUNT_SUSPENDED" }, { status: 403 });
  }

  // Email OTP (issue #93): the password alone isn't enough for this account
  // — issue a pending challenge and email its code instead of calling
  // createSession directly. The response carries a challengeToken, never a
  // session cookie, until POST /api/auth/verify-email-otp confirms the code.
  if (user.two_factor_method === "email_otp") {
    const ip = getClientIpFromHeaders(request.headers);
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
