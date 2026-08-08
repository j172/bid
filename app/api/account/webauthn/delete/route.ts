import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteCredential } from "@/lib/webauthnCredentials";

// Removes one of the logged-in visitor's own passkeys (issue #95). No
// password re-entry required — see lib/webauthnCredentials.ts's
// deleteCredential header comment for why this deliberately doesn't mirror
// app/api/account/two-factor/route.ts's currentPassword requirement.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorCode: "MUST_LOGIN" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const credentialId = typeof body?.credentialId === "string" ? body.credentialId : "";

  const result = await deleteCredential(credentialId, user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
