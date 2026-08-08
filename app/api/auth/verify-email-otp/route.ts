import { NextResponse } from "next/server";
import { createSession, getUserDetail } from "@/lib/auth";
import { verifyEmailOtpChallenge } from "@/lib/emailOtp";

// Second step of the Email OTP login flow (issue #93) — the counterpart to
// app/api/auth/login/route.ts's twoFactorRequired branch. Only ever called
// with a challengeToken that route handed back; verifyEmailOtpChallenge
// itself enforces existence/expiry/one-time-use/attempt-cap (see
// lib/emailOtp.ts), so this route's own job is just: on a valid code, look
// the account up fresh (it could have been suspended in the few minutes
// between password entry and code entry) and call createSession — the one
// place in the whole flow that actually logs the visitor in.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const code = typeof body?.code === "string" ? body.code : "";

  const result = await verifyEmailOtpChallenge(token, code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  const user = await getUserDetail(result.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ ok: false, errorCode: "ACCOUNT_SUSPENDED" }, { status: 403 });
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
}
