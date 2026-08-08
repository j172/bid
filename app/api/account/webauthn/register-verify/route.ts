import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getCurrentUser } from "@/lib/auth";
import {
  clearWebauthnChallengeCookie,
  consumeWebauthnChallenge,
  readWebauthnChallengeCookie,
  resolveWebauthnRp,
} from "@/lib/webauthn";
import { saveCredential } from "@/lib/webauthnCredentials";

const DEVICE_NAME_MAX_LENGTH = 100;

// Step 2 of adding a passkey (issue #95) — the counterpart to
// register-options/route.ts, called with whatever
// @simplewebauthn/browser's startRegistration() returned. The challenge
// token travels via an httpOnly cookie (never through request JSON — see
// lib/webauthn.ts's header comment), so it's read/cleared here rather than
// taken from the request body; its stored userId is re-checked against the
// logged-in visitor so a challenge issued to one account can't be redeemed
// while logged in as another.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorCode: "MUST_LOGIN" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const response = body?.response;
  const deviceNameRaw = typeof body?.deviceName === "string" ? body.deviceName.trim() : "";
  const deviceName = deviceNameRaw ? deviceNameRaw.slice(0, DEVICE_NAME_MAX_LENGTH) : null;

  const token = await readWebauthnChallengeCookie("register");
  await clearWebauthnChallengeCookie("register");
  if (!token || !response) {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_CHALLENGE_INVALID" }, { status: 400 });
  }

  const challengeResult = await consumeWebauthnChallenge(token, "register");
  if (!challengeResult.ok || challengeResult.userId !== user.id) {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_CHALLENGE_INVALID" }, { status: 400 });
  }

  const { rpID, origin } = resolveWebauthnRp();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeResult.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_VERIFICATION_FAILED" }, { status: 400 });
  }
  if (!verification.verified) {
    return NextResponse.json({ ok: false, errorCode: "WEBAUTHN_VERIFICATION_FAILED" }, { status: 400 });
  }

  const createdAt = new Date();
  await saveCredential(user.id, verification.registrationInfo.credential, deviceName);

  return NextResponse.json({
    ok: true,
    passkey: {
      credentialId: verification.registrationInfo.credential.id,
      deviceName,
      createdAt: createdAt.toISOString(),
      lastUsedAt: null,
    },
  });
}
