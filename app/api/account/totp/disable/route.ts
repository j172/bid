import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { disableTotp } from "@/lib/totp";

// Turns TOTP back off (issue #97) — mirrors
// app/api/account/two-factor/route.ts's shape exactly (same currentPassword
// re-entry requirement, same errorCode passthrough). disableTotp also clears
// totp_secret/totp_backup_codes on top of the two_factor_method flip; see
// its header comment in lib/totp.ts.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorCode: "MUST_LOGIN" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";

  const result = await disableTotp(user.id, currentPassword);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
