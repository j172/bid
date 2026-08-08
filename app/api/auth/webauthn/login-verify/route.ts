import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createSession, getUserDetail } from "@/lib/auth";
import {
  clearWebauthnChallengeCookie,
  consumeWebauthnChallenge,
  readWebauthnChallengeCookie,
  resolveWebauthnRp,
} from "@/lib/webauthn";
import { findCredentialById, updateCredentialAfterLogin } from "@/lib/webauthnCredentials";

// Step 2 of "使用通行密鑰登入" (issue #95) — the counterpart to
// login-options/route.ts. Unlike app/api/auth/verify-email-otp/route.ts,
// this is the *whole* login (not a second step chained after a password
// check): the response's credential id is the only handle back to an
// account (usernameless flow), so the credential — and with it, the
// account — is looked up here rather than passed in. A verified assertion
// is itself a strong factor, so this calls createSession directly, exactly
// like the no-2FA branch of app/api/auth/login/route.ts — the *other* of
// the two createSession call sites issue #95 requires; never a third,
// separately-implemented session-creation path.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const response = body?.response;

  const token = await readWebauthnChallengeCookie("login");
  await clearWebauthnChallengeCookie("login");
  if (!token || !response || typeof response.id !== "string") {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_CHALLENGE_INVALID" }, { status: 400 });
  }

  const challengeResult = await consumeWebauthnChallenge(token, "login");
  if (!challengeResult.ok) {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_CHALLENGE_INVALID" }, { status: 400 });
  }

  const stored = await findCredentialById(response.id);
  if (!stored) {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_VERIFICATION_FAILED" }, { status: 400 });
  }

  const { rpID, origin } = resolveWebauthnRp();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeResult.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: stored.credential,
    });
  } catch {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_VERIFICATION_FAILED" }, { status: 400 });
  }
  if (!verification.verified) {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_VERIFICATION_FAILED" }, { status: 400 });
  }

  const user = await getUserDetail(stored.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ ok: false, errorCode: "ACCOUNT_SUSPENDED" }, { status: 403 });
  }

  await updateCredentialAfterLogin(response.id, verification.authenticationInfo.newCounter);
  await createSession(user.id);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
}
