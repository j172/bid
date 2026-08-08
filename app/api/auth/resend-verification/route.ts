import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth";
import { createEmailVerificationToken, isEmailVerificationRateLimited, verifyEmailPath } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/notifications";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { resolveOrigin } from "@/lib/newsNewsletterSync";
import { routing } from "@/i18n/routing";

// Same neutral { ok: true } response regardless of outcome — unknown email,
// already-verified account, or rate-limited — as
// app/api/auth/forgot-password/route.ts's neutralResponse (see that route's
// header comment for the full anti-enumeration rationale). A fresh
// NextResponse per call, not a shared singleton, for the same reason.
function neutralResponse() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const locale = routing.locales.includes(body?.locale) ? body.locale : routing.defaultLocale;

  if (!email) {
    return neutralResponse();
  }

  const user = await findUserByEmail(email);
  if (!user || user.suspended_at !== null || user.email_verified) {
    return neutralResponse();
  }

  const ip = getClientIpFromHeaders(request.headers);
  if (await isEmailVerificationRateLimited(user.id, ip)) {
    return neutralResponse();
  }

  const token = await createEmailVerificationToken(user.id, ip);
  const verifyUrl = `${resolveOrigin(request)}${verifyEmailPath(locale, token)}`;
  await sendVerificationEmail(user.email, user.locale, verifyUrl);

  return neutralResponse();
}
