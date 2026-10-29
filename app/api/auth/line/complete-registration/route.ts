import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LINE_ONBOARD_COOKIE, verifyLineOnboardToken } from "@/lib/lineAuth";
import { createLineUser, createSession, findUserByEmail } from "@/lib/auth";
import { isValidEmail } from "@/lib/emailValidation";
import { resolveRequestLocale } from "@/lib/requestLocale";
import type { ErrorCode } from "@/lib/errorCodes";

function validatePhone(phone: string): { ok: true } | { ok: false; errorCode: ErrorCode } {
  const trimmed = phone.trim();
  if (trimmed.length === 0) return { ok: false, errorCode: "PHONE_REQUIRED" };
  if (!/^[0-9\- +]+$/.test(trimmed)) return { ok: false, errorCode: "PHONE_INVALID_FORMAT" };
  const digitCount = trimmed.replace(/[^0-9]/g, "").length;
  if (digitCount < 7 || digitCount > 15) return { ok: false, errorCode: "PHONE_INVALID_LENGTH" };
  return { ok: true };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(LINE_ONBOARD_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, errorCode: "LINE_ONBOARD_EXPIRED" }, { status: 401 });
  }

  const onboardData = verifyLineOnboardToken(token);
  if (!onboardData) {
    cookieStore.delete(LINE_ONBOARD_COOKIE);
    return NextResponse.json({ ok: false, errorCode: "LINE_ONBOARD_EXPIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const termsAccepted = body?.termsAccepted === true;
  const locale = resolveRequestLocale(body);

  if (!displayName) {
    return NextResponse.json({ ok: false, errorCode: "DISPLAY_NAME_REQUIRED" }, { status: 400 });
  }

  if (displayName.length > 50) {
    return NextResponse.json({ ok: false, errorCode: "DISPLAY_NAME_TOO_LONG" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_INVALID" }, { status: 400 });
  }

  const phoneResult = validatePhone(phone);
  if (!phoneResult.ok) {
    return NextResponse.json({ ok: false, errorCode: phoneResult.errorCode }, { status: 400 });
  }

  if (!termsAccepted) {
    return NextResponse.json({ ok: false, errorCode: "TERMS_NOT_ACCEPTED" }, { status: 400 });
  }

  // Check if email is already registered in the system
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return NextResponse.json(
      { ok: false, errorCode: "EMAIL_ALREADY_REGISTERED", requireLink: true },
      { status: 409 },
    );
  }

  const newUser = await createLineUser({
    email,
    lineUserId: onboardData.lineUserId,
    displayName: displayName || onboardData.displayName,
    phone,
    termsAccepted: true,
    locale,
  });

  await createSession(newUser.id);
  cookieStore.delete(LINE_ONBOARD_COOKIE);

  return NextResponse.json({ ok: true, user: newUser }, { status: 200 });
}
