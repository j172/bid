import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { startTotpSetup } from "@/lib/totp";

// Step 1 of the TOTP setup wizard (issue #97) — mirrors
// app/api/account/webauthn/register-options/route.ts's shape: generate a
// fresh secret, stash it server-side (totp_setup_challenges — never
// users.totp_secret yet), hand the visitor's browser only what it needs to
// render a QR code plus a manual-entry fallback. The QR image itself is
// rendered here (qrcode's toDataURL) rather than in the browser so the
// client only ever needs an <img src>, no extra client-side dependency.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorCode: "MUST_LOGIN" }, { status: 401 });
  }

  const { token, secret, otpauthUri } = await startTotpSetup(user.id, user.email);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  return NextResponse.json({ ok: true, token, secret, qrCodeDataUrl });
}
