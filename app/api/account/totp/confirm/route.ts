import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { confirmTotpSetup } from "@/lib/totp";

// Step 2 of the TOTP setup wizard (issue #97) — the counterpart to
// app/api/account/totp/setup/route.ts, called once the visitor has scanned
// the QR code and typed back the 6-digit code their Authenticator app now
// shows. currentPassword is required for the same reason as
// app/api/account/two-factor/route.ts's toggle (issue #93): a session
// hijacker must not be able to enroll a second factor of their own choosing.
// confirmTotpSetup does all the real work — validating both the password and
// the code, only then promoting the secret out of the temporary challenge
// table and minting backup codes; see its own header comment in lib/totp.ts.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";

  const result = await confirmTotpSetup(auth.user.id, currentPassword, token, code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  return NextResponse.json({ ok: true, backupCodes: result.backupCodes });
}
