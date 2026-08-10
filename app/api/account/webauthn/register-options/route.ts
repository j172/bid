import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireUser } from "@/lib/apiAuth";
import { RP_NAME, createWebauthnChallenge, resolveWebauthnRp, setWebauthnChallengeCookie } from "@/lib/webauthn";
import { listCredentialDescriptorsForUser } from "@/lib/webauthnCredentials";

// Step 1 of adding a passkey from USER ACCOUNT (issue #95) — mirrors
// app/api/auth/login/route.ts's issuing side of a challenge in shape:
// generate it, stash it server-side, hand only the public options back to
// the browser for @simplewebauthn/browser's startRegistration(). excludeCredentials
// lists this account's existing passkeys so an authenticator that already
// registered one can't register the same one again. residentKey: "required"
// forces a discoverable credential — issue #95's login flow is
// usernameless and needs the browser to be able to list this passkey
// without the site providing an allowCredentials hint first.
export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { rpID } = resolveWebauthnRp();
  const excludeCredentials = await listCredentialDescriptorsForUser(auth.user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: auth.user.email,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });

  const token = await createWebauthnChallenge("register", auth.user.id, options.challenge);
  await setWebauthnChallengeCookie("register", token);

  return NextResponse.json({ ok: true, options });
}
