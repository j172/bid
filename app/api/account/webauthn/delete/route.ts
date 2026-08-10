import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { deleteCredential } from "@/lib/webauthnCredentials";

// Removes one of the logged-in visitor's own passkeys (issue #95). No
// password re-entry required — see lib/webauthnCredentials.ts's
// deleteCredential header comment for why this deliberately doesn't mirror
// app/api/account/two-factor/route.ts's currentPassword requirement.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const credentialId = typeof body?.credentialId === "string" ? body.credentialId : "";

  const result = await deleteCredential(credentialId, auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
