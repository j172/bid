import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { createWebauthnChallenge, resolveWebauthnRp, setWebauthnChallengeCookie } from "@/lib/webauthn";

// Step 1 of "使用通行密鑰登入" (issue #95) — deliberately usernameless: no
// email is collected before this call, and allowCredentials is left
// undefined, so the browser lists every discoverable passkey it holds for
// this RP ID itself rather than the site telling it which one to expect.
// userVerification stays "preferred" (not "discouraged", which issue #93's
// email-OTP 2FA context would call for) since this passkey login isn't a
// second factor bolted onto a password — it's the whole login, so it should
// still ask the authenticator to verify the person via biometric/PIN
// wherever that's available.
export async function POST() {
  const { rpID } = resolveWebauthnRp();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  const token = await createWebauthnChallenge("login", null, options.challenge);
  await setWebauthnChallengeCookie("login", token);

  return NextResponse.json({ ok: true, options });
}
