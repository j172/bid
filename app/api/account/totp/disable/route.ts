import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { disableTotp } from "@/lib/totp";

// Turns TOTP back off (issue #97) — mirrors
// app/api/account/two-factor/route.ts's shape exactly (same currentPassword
// re-entry requirement, same errorCode passthrough). disableTotp also clears
// totp_secret/totp_backup_codes on top of the two_factor_method flip; see
// its header comment in lib/totp.ts.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";

  const result = await disableTotp(auth.user.id, currentPassword);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
