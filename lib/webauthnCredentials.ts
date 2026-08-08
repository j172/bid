// CRUD for registered passkeys (issue #95) — see db/init.sql's
// webauthn_credentials header comment for the table shape. Mixes pure
// encode/decode helpers (encodeTransports/decodeTransports, no DB access,
// directly unit-testable — same split lib/emailOtp.ts/lib/passwordReset.ts
// use for their own pure decision functions) with raw-SQL CRUD.
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticatorTransportFuture, WebAuthnCredential } from "@simplewebauthn/server";
import { getDb } from "@/lib/db";

interface WebauthnCredentialRow {
  credential_id: string;
  user_id: number;
  public_key: string;
  counter: number;
  device_name: string | null;
  transports: string | null;
  created_at: Date;
  last_used_at: Date | null;
}

export interface PasskeySummary {
  credentialId: string;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

// Pure: transports (["internal","hybrid"], etc) are stored as their JSON
// serialization in a single VARCHAR column rather than a join table — a
// handful of short enum strings per credential that are never queried on,
// so a second table would be pure overhead. decodeTransports tolerates
// NULL/malformed input by falling back to undefined — generateRegistrationOptions'
// excludeCredentials and verifyAuthenticationResponse's credential param both
// treat "unknown transports" the same as "not provided".
export function encodeTransports(transports: AuthenticatorTransportFuture[] | undefined): string | null {
  if (!transports || transports.length === 0) return null;
  return JSON.stringify(transports);
}

export function decodeTransports(stored: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!stored) return undefined;
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as AuthenticatorTransportFuture[]) : undefined;
  } catch {
    return undefined;
  }
}

function toCredential(row: WebauthnCredentialRow): WebAuthnCredential {
  return {
    id: row.credential_id,
    publicKey: isoBase64URL.toBuffer(row.public_key),
    counter: row.counter,
    transports: decodeTransports(row.transports),
  };
}

// Feeds generateRegistrationOptions' excludeCredentials (issue #95's
// register-options route) so a visitor can't register the exact same
// authenticator twice.
export async function listCredentialDescriptorsForUser(
  userId: number,
): Promise<{ id: string; transports?: AuthenticatorTransportFuture[] }[]> {
  const db = await getDb();
  const [rows] = await db.query("SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?", [
    userId,
  ]);
  return (rows as Pick<WebauthnCredentialRow, "credential_id" | "transports">[]).map((row) => ({
    id: row.credential_id,
    transports: decodeTransports(row.transports),
  }));
}

// Feeds USER ACCOUNT's passkey list section (device_name/created_at/
// last_used_at — see app/[locale]/account/PasskeySection.tsx).
export async function listPasskeysForUser(userId: number): Promise<PasskeySummary[]> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT credential_id, device_name, created_at, last_used_at FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return (
    rows as Pick<WebauthnCredentialRow, "credential_id" | "device_name" | "created_at" | "last_used_at">[]
  ).map((row) => ({
    credentialId: row.credential_id,
    deviceName: row.device_name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

// Looked up by the login-verify route (usernameless flow: the browser
// response's credential id is the only handle back to an account) and
// returned already in the WebAuthnCredential shape verifyAuthenticationResponse
// expects directly.
export async function findCredentialById(
  credentialId: string,
): Promise<{ credential: WebAuthnCredential; userId: number } | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM webauthn_credentials WHERE credential_id = ? LIMIT 1", [
    credentialId,
  ]);
  const row = (rows as WebauthnCredentialRow[])[0];
  if (!row) return null;
  return { credential: toCredential(row), userId: row.user_id };
}

// Persists a freshly verified registration (issue #95's register-verify
// route). deviceName is whatever the visitor typed to name this passkey, or
// null if they left it blank — the account page falls back to a translated
// "未命名裝置" label for display, kept out of this lib layer since (unlike
// the admin backend) USER ACCOUNT is in next-intl's scope.
export async function saveCredential(
  userId: number,
  credential: WebAuthnCredential,
  deviceName: string | null,
): Promise<void> {
  const db = await getDb();
  await db.query(
    "INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, device_name, transports, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [
      credential.id,
      userId,
      isoBase64URL.fromBuffer(credential.publicKey),
      credential.counter,
      deviceName,
      encodeTransports(credential.transports),
    ],
  );
}

// Called after a successful login-verify — advances the stored counter
// (WebAuthn's own clone-detection signal: a counter that goes backwards or
// repeats means a cloned authenticator; acting on that beyond storing it is
// out of scope for issue #95) and stamps last_used_at for the USER ACCOUNT
// passkey list.
export async function updateCredentialAfterLogin(credentialId: string, newCounter: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE webauthn_credentials SET counter = ?, last_used_at = NOW() WHERE credential_id = ?", [
    newCounter,
    credentialId,
  ]);
}

export type DeleteCredentialOutcome = { ok: true } | { ok: false; errorCode: "NOT_FOUND" };

// Scoped to (credentialId, userId) together so one account can never delete
// another's passkey by guessing/tampering with a credentialId. No password
// re-entry required (issue #95: unlike #93's 2FA toggle, adding or removing
// a passkey doesn't need it — a passkey is already a strong factor on its
// own, and deleting one can never grant new access to anyone).
export async function deleteCredential(credentialId: string, userId: number): Promise<DeleteCredentialOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM webauthn_credentials WHERE credential_id = ? AND user_id = ?", [
    credentialId,
    userId,
  ]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, errorCode: "NOT_FOUND" };
  }
  return { ok: true };
}
