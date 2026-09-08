import { NextResponse } from "next/server";
import { authenticateWithGooglePayload, verifyGoogleIdToken } from "@/lib/googleAuth";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { resolveRequestLocale } from "@/lib/requestLocale";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential.trim() : "";

  if (!credential) {
    return NextResponse.json({ ok: false, errorCode: "GOOGLE_AUTH_FAILED" }, { status: 400 });
  }

  const payload = await verifyGoogleIdToken(credential);
  if (!payload) {
    return NextResponse.json({ ok: false, errorCode: "GOOGLE_AUTH_FAILED" }, { status: 401 });
  }

  const ip = getClientIpFromHeaders(request.headers);
  const locale = resolveRequestLocale(body);

  const result = await authenticateWithGooglePayload(payload, locale, ip);
  if (!result.ok) {
    let status = 400;
    if (result.errorCode === "ACCOUNT_SUSPENDED") {
      status = 403;
    } else if (result.errorCode === "EMAIL_OTP_RATE_LIMITED") {
      status = 429;
    }
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status });
  }

  if (result.twoFactorRequired) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json({ ok: true, user: result.user }, { status: 200 });
}
