import { NextResponse } from "next/server";
import { verifyEmailVerificationToken } from "@/lib/emailVerification";

// Mirrors app/api/auth/reset-password/route.ts's shape exactly, including
// not auto-logging-in on success (see verifyEmailVerificationToken's header
// comment for why) — the front end sends the visitor to /login afterward.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";

  if (!token) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_VERIFICATION_TOKEN_INVALID" }, { status: 400 });
  }

  const result = await verifyEmailVerificationToken(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
