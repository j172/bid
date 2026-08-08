"use client";

import { startRegistration } from "@simplewebauthn/browser";
import type { RegistrationResponseJSON } from "@simplewebauthn/browser";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/app/components/Button";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

export interface PasskeyListItem {
  credentialId: string;
  deviceName: string | null;
  // ISO strings, not Date instances — this is a client component and
  // account/page.tsx (the server component rendering it) can only hand
  // across serializable props. Formatted with the visitor's own locale
  // below, same Intl.DateTimeFormat(locale, ...) pattern
  // app/[locale]/listings/(no-loading)/[id]/page.tsx uses for its activity
  // feed.
  createdAt: string;
  lastUsedAt: string | null;
}

// USER ACCOUNT's passkey management block (issue #95) — the fourth
// account-security ticket, alongside ChangePasswordForm/TwoFactorSection/
// DeleteAccountButton on this same page. Adding a passkey is a three-step
// round trip: fetch a challenge (register-options) → trigger the browser's
// native WebAuthn UI (@simplewebauthn/browser's startRegistration, which
// itself demands the device's biometric/PIN — already a strong factor on
// its own) → name it and send the signed response back for verification
// (register-verify). Deleting one is a single confirm() round trip like
// DeleteAccountButton's — no password re-entry, since neither adding nor
// removing a passkey can grant an attacker anything a stolen password
// couldn't already (see lib/webauthnCredentials.ts's deleteCredential).
export default function PasskeySection({ initialPasskeys }: { initialPasskeys: PasskeyListItem[] }) {
  const locale = useLocale();
  const t = useTranslations("passkeySection");
  const tErrors = useTranslations("errors");
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [registering, setRegistering] = useState(false);
  const [pendingResponse, setPendingResponse] = useState<RegistrationResponseJSON | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const formatDate = (iso: string) => dateFormatter.format(new Date(iso));

  async function handleStartRegistration() {
    setError(null);
    setRegistering(true);
    try {
      const optionsResponse = await fetch("/api/account/webauthn/register-options", { method: "POST" });
      const optionsData = await optionsResponse.json();
      if (!optionsData.ok) {
        setError(optionsData.errorCode ? tErrors(optionsData.errorCode) : t("defaultError"));
        return;
      }
      const response = await startRegistration({ optionsJSON: optionsData.options });
      setPendingResponse(response);
      setDeviceName("");
    } catch {
      setError(t("browserError"));
    } finally {
      setRegistering(false);
    }
  }

  function cancelNaming() {
    setPendingResponse(null);
    setDeviceName("");
    setError(null);
  }

  async function handleNameSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!pendingResponse) return;
    setRegistering(true);
    setError(null);

    const response = await fetch("/api/account/webauthn/register-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: pendingResponse, deviceName }),
    });
    const data = await response.json();

    setRegistering(false);
    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    setPendingResponse(null);
    setDeviceName("");
    setPasskeys((current) => [data.passkey as PasskeyListItem, ...current]);
  }

  async function handleDelete(credentialId: string) {
    if (!confirm(t("deleteConfirm"))) {
      return;
    }
    setDeletingId(credentialId);
    setError(null);

    const response = await fetch("/api/account/webauthn/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentialId }),
    });
    const data = await response.json();

    setDeletingId(null);
    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    setPasskeys((current) => current.filter((passkey) => passkey.credentialId !== credentialId));
  }

  return (
    <div className="flex flex-col gap-4">
      {passkeys.length === 0 ? (
        <p className="text-sm text-ink-light">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {passkeys.map((passkey) => (
            <li
              key={passkey.credentialId}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div>
                <p className="font-medium">{passkey.deviceName || t("unnamedDevice")}</p>
                <p className="text-xs text-ink-light">
                  {t("createdAtLabel")}
                  {"："}
                  {formatDate(passkey.createdAt)}
                  {passkey.lastUsedAt && (
                    <>
                      {" · "}
                      {t("lastUsedAtLabel")}
                      {"："}
                      {formatDate(passkey.lastUsedAt)}
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(passkey.credentialId)}
                disabled={deletingId === passkey.credentialId}
                className="shrink-0 rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === passkey.credentialId ? t("deleting") : t("deleteButton")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendingResponse ? (
        <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-ink-light">{t("deviceNamePrompt")}</p>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            {t("deviceNameLabel")}
            <input
              type="text"
              maxLength={100}
              autoFocus
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={t("deviceNamePlaceholder")}
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={registering}>
              {registering ? t("submitting") : t("saveButton")}
            </Button>
            <button type="button" onClick={cancelNaming} className="text-sm text-ink-light hover:underline">
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <Button type="button" onClick={handleStartRegistration} disabled={registering}>
            {registering ? t("registering") : t("addButton")}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-ended">{error}</p>}
    </div>
  );
}
