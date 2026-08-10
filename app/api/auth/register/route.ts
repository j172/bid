import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/auth";
import { isValidEmail } from "@/lib/emailValidation";
import { validateProfile } from "@/lib/profile";
import { createEmailVerificationToken, isEmailVerificationRateLimited, verifyEmailPath } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/notifications";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { resolveOrigin } from "@/lib/newsNewsletterSync";
import { routing } from "@/i18n/routing";

// Display name is optional at registration (issue #101): a blank/whitespace
// value gets a generated placeholder before validation/insert, so the shared
// validateProfile() rule (display name required) stays satisfied without
// weakening it for other callers (e.g. account profile edits).
function generateDefaultDisplayName(): string {
  const digits = Math.floor(Math.random() * 90000 + 10000);
  return `user${digits}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const rawDisplayName = typeof body?.displayName === "string" ? body.displayName : "";
  const displayName = rawDisplayName.trim() ? rawDisplayName : generateDefaultDisplayName();
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const address = typeof body?.address === "string" ? body.address : "";
  const locale = routing.locales.includes(body?.locale) ? body.locale : routing.defaultLocale;

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_INVALID" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, errorCode: "PASSWORD_TOO_SHORT" }, { status: 400 });
  }

  const profileResult = validateProfile({ displayName, phone, address });
  if (!profileResult.ok) {
    return NextResponse.json({ ok: false, errorCode: profileResult.errorCode }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_ALREADY_REGISTERED" }, { status: 409 });
  }

  const user = await createUser(email, password, { displayName, phone, address }, locale);

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
