import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/auth";
import { isValidEmail } from "@/lib/emailValidation";
import { validateProfile } from "@/lib/profile";
import { createEmailVerificationToken, isEmailVerificationRateLimited, verifyEmailPath } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/notifications";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { resolveOrigin } from "@/lib/newsNewsletterSync";
import { resolveRequestLocale } from "@/lib/requestLocale";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  // Issue #304: display name is now required (the auto-generated
  // `user12345`-style placeholder previously produced here for a blank value
  // — generateDefaultDisplayName() — is gone; validateProfile() below rejects
  // a blank display name the same way it already rejects a blank phone or
  // address).
  const displayName = typeof body?.displayName === "string" ? body.displayName : "";
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const address = typeof body?.address === "string" ? body.address : "";
  const lineId = typeof body?.lineId === "string" ? body.lineId : "";
  const termsAccepted = body?.termsAccepted === true;
  const locale = resolveRequestLocale(body);

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_INVALID" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, errorCode: "PASSWORD_TOO_SHORT" }, { status: 400 });
  }

  const profileResult = validateProfile({ displayName, phone, address, lineId });
  if (!profileResult.ok) {
    return NextResponse.json({ ok: false, errorCode: profileResult.errorCode }, { status: 400 });
  }

  // Issue #304: a single "我已閱讀並同意『拍賣規則』與『隱私權政策』" checkbox
  // must be checked before an account can be created — the browser-side
  // `required` checkbox (RegisterForm.tsx) is a UX nicety only, this is the
  // actual enforcement. createUser() below stamps terms_accepted_at with the
  // current time as the legal-proof record once this check passes.
  if (!termsAccepted) {
    return NextResponse.json({ ok: false, errorCode: "TERMS_NOT_ACCEPTED" }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_ALREADY_REGISTERED" }, { status: 409 });
  }

  const user = await createUser(email, password, { displayName, phone, address, lineId }, locale);

  // Issue #118 (strict mode): registration no longer auto-logs-in. The new
  // account starts out email_verified = FALSE (see db/init.sql) and must
  // click the link below before POST /api/auth/login will create a session
  // for it. The IP rate-limit check here (same mechanism as
  // forgot-password's) only ever matters if this IP has been mass-registering
  // accounts to spam an inbox — a brand-new user_id can never itself already
  // be in per-account cooldown — and a hit is deliberately non-fatal to the
  // signup: the account is created either way, the visitor just needs to use
  // the resend-verification flow (subject to the same limit) to get the
  // email once the window clears.
  const ip = getClientIpFromHeaders(request.headers);
  if (!(await isEmailVerificationRateLimited(user.id, ip))) {
    const token = await createEmailVerificationToken(user.id, ip);
    const verifyUrl = `${resolveOrigin(request)}${verifyEmailPath(locale, token)}`;
    await sendVerificationEmail(user.email, locale, verifyUrl);
  }

  return NextResponse.json({ ok: true, requiresVerification: true, user });
}
