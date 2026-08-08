import { NextResponse } from "next/server";
import { getCurrentUser, setTwoFactorMethod } from "@/lib/auth";

// Toggles the logged-in user's Email OTP second factor on/off (issue #93).
// Mirrors app/api/account/change-password/route.ts's shape — same
// currentPassword re-entry requirement, same errorCode passthrough — since
// this is just as sensitive: a session hijacker must not be able to
// silently flip 2FA on or off without knowing the account's password.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorCode: "MUST_LOGIN" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const enabled = body?.enabled === true;

  const result = await setTwoFactorMethod(user.id, currentPassword, enabled ? "email_otp" : "none");
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
