import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth";
import { createPasswordResetToken, isPasswordResetRateLimited, resetPasswordPath } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/notifications";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { resolveOrigin } from "@/lib/newsNewsletterSync";
import { routing } from "@/i18n/routing";

// Always responds with the same { ok: true } neutral outcome — whether the
// email doesn't belong to any account, belongs to a suspended account, or
// was just rate-limited, none of that is ever surfaced to the caller. This
// is the anti-enumeration requirement from issue #89: a visitor probing
// random addresses must not be able to tell registered emails apart from
// unregistered ones by the response alone. A fresh NextResponse per call —
// not a shared module-level singleton — since a Response's body stream can
// only be consumed once.
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
  if (!user || user.suspended_at !== null) {
    return neutralResponse();
  }

  const ip = getClientIpFromHeaders(request.headers);
  if (await isPasswordResetRateLimited(user.id, ip)) {
    return neutralResponse();
  }

  const token = await createPasswordResetToken(user.id, ip);
  const resetUrl = `${resolveOrigin(request)}${resetPasswordPath(locale, token)}`;
  await sendPasswordResetEmail(user.email, user.locale, resetUrl);

  return neutralResponse();
}
