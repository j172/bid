"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { usePostJson } from "@/lib/usePostJson";

type AuthenticationOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];

// Passkey login (issue #95) — a separate, parallel entry point to the
// password form, not a replacement for it, so it lives beside that form
// rather than inside it (issue #139 item 4). Usernameless/discoverable-
// credential flow (@simplewebauthn/browser's startAuthentication): no email
// is collected first, the browser itself lists whichever passkeys it holds
// for this site. A successful verify goes straight home — it never touches
// the Email OTP or TOTP steps, since passkey login already calls
// createSession server-side on its own (see
// app/api/auth/webauthn/login-verify/route.ts).
export default function PasskeyLoginButton() {
  const router = useRouter();
  const t = useTranslations("login");
  const [running, setRunning] = useState(false);
  const { post, error, setError } = usePostJson(t("defaultError"));

  async function handlePasskeyLogin() {
    setRunning(true);
    try {
      const optionsData = await post<{ ok?: boolean; options: AuthenticationOptions }>(
        "/api/auth/webauthn/login-options",
      );
      if (!optionsData) return;

      const authResponse = await startAuthentication({ optionsJSON: optionsData.options });

      const data = await post("/api/auth/webauthn/login-verify", { response: authResponse });
      if (!data) return;

      router.push("/");
      router.refresh();
    } catch {
      setError(t("passkeyBrowserError"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 text-xs text-ink-light">
        <span className="h-px flex-1 bg-border" />
        {t("passkeyDivider")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={handlePasskeyLogin}
        disabled={running}
        className="w-full rounded-md border border-border px-4 py-2 font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? t("passkeySubmitting") : t("passkeyLoginButton")}
      </button>
      {error && <p className="text-sm text-ended">{error}</p>}
    </>
  );
}
