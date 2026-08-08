"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/app/components/Button";
import AuthFormShell from "../components/AuthFormShell";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("login");
  const tErrors = useTranslations("errors");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Registration email-ownership verification (issue #118): a login attempt
  // against a not-yet-verified account fails with EMAIL_NOT_VERIFIED instead
  // of creating a session (see app/api/auth/login/route.ts). This flag
  // switches the error message into one offering a resend button rather than
  // the generic error text — the email the visitor already typed into the
  // form above is reused for the resend call, so they never have to retype
  // it. Same "resend, rate-limited the same way as forgot-password" endpoint
  // as app/[locale]/forgot-password/page.tsx's submit — the response is
  // deliberately neutral (see that route's header comment) so this always
  // just reports "sent" without revealing whether the account existed.
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Email OTP (issue #93): a successful password check doesn't always mean
  // "logged in" — when the account has Email OTP turned on, the login
  // response carries twoFactorRequired + a challengeToken instead of a
  // session, and this page switches into a second step in place (no
  // navigation) to collect the 6-digit code. Mirrors
  // app/[locale]/forgot-password/page.tsx's single-state-flag step switch.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // TOTP (issue #97) — parallel branch to the Email OTP step above, entered
  // when the login response's twoFactorMethod is "totp" instead of
  // "email_otp". There's no challengeToken here (see
  // app/api/auth/login/route.ts's totp branch): POST /api/auth/verify-totp
  // re-verifies email+password itself, so this step resubmits the same
  // email/password state the form above already collected, alongside
  // whatever the visitor types into totpCode (accepts either a 6-digit app
  // code or a backup code — the backend tells them apart by format). A
  // successful backup-code verify doesn't navigate away immediately; it
  // shows how many backup codes remain first (totpBackupNotice) since that's
  // the only time the visitor finds out, then a second click continues on.
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [totpVerifying, setTotpVerifying] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpBackupNotice, setTotpBackupNotice] = useState<string | null>(null);

  // Passkey login (issue #95) — a separate, parallel entry point to the
  // password form above, not a replacement for it. Usernameless/discoverable-
  // credential flow (@simplewebauthn/browser's startAuthentication): no
  // email is collected first, the browser itself lists whichever passkeys it
  // holds for this site. A successful verify goes straight to the same
  // router.push("/") + router.refresh() the password flow ends with — it
  // never touches the Email OTP step above, since passkey login already
  // calls createSession server-side on its own (see
  // app/api/auth/webauthn/login-verify/route.ts).
  const [passkeySubmitting, setPasskeySubmitting] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setEmailNotVerified(false);
    setResendSent(false);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      if (data.errorCode === "EMAIL_NOT_VERIFIED") {
        setEmailNotVerified(true);
      }
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    if (data.twoFactorRequired) {
      if (data.twoFactorMethod === "totp") {
        setTotpRequired(true);
      } else {
        setChallengeToken(data.challengeToken);
      }
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleResendVerification() {
    setResendSubmitting(true);
    setResendSent(false);

    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });

    setResendSubmitting(false);
    setResendSent(true);
  }

  async function handleTotpSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTotpVerifying(true);
    setTotpError(null);

    const response = await fetch("/api/auth/verify-totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, code: totpCode }),
    });
    const data = await response.json();

    setTotpVerifying(false);
    if (!data.ok) {
      setTotpError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    if (data.usedBackupCode) {
      setTotpBackupNotice(t("totpBackupCodeUsedNotice", { count: data.remainingBackupCodes }));
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleVerifySubmit(event: React.FormEvent) {
    event.preventDefault();
    setVerifying(true);
    setVerifyError(null);

    const response = await fetch("/api/auth/verify-email-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: challengeToken, code }),
    });
    const data = await response.json();

    setVerifying(false);
    if (!data.ok) {
      if (data.errorCode === "EMAIL_OTP_TOO_MANY_ATTEMPTS") {
        // The challenge is permanently spent — the only way forward is a
        // fresh login attempt (which issues a brand-new code).
        setChallengeToken(null);
        setCode("");
        setError(tErrors("EMAIL_OTP_TOO_MANY_ATTEMPTS"));
        return;
      }
      setVerifyError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handlePasskeyLogin() {
    setPasskeyError(null);
    setPasskeySubmitting(true);
    try {
      const optionsResponse = await fetch("/api/auth/webauthn/login-options", { method: "POST" });
      const optionsData = await optionsResponse.json();
      if (!optionsData.ok) {
        setPasskeyError(optionsData.errorCode ? tErrors(optionsData.errorCode) : t("defaultError"));
        return;
      }

      const authResponse = await startAuthentication({ optionsJSON: optionsData.options });

      const verifyResponse = await fetch("/api/auth/webauthn/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResponse }),
      });
      const data = await verifyResponse.json();
      if (!data.ok) {
        setPasskeyError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setPasskeyError(t("passkeyBrowserError"));
    } finally {
      setPasskeySubmitting(false);
    }
  }

  if (totpRequired) {
    if (totpBackupNotice) {
      return (
        <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
            <h1 className="text-2xl font-bold">{t("totpTitle")}</h1>
            <p className="mt-6 text-sm text-ink-light">{totpBackupNotice}</p>
            <Button
              type="button"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
              className="mt-6 w-full"
            >
              {t("totpContinue")}
            </Button>
          </div>
        </main>
      );
    }

    return (
      <AuthFormShell
        title={t("totpTitle")}
        onSubmit={handleTotpSubmit}
        submitting={totpVerifying}
        submitLabel={t("totpSubmit")}
        submittingLabel={t("totpSubmitting")}
        error={totpError}
        footer={
          <p className="mt-4 text-sm text-ink-light">
            <button
              type="button"
              onClick={() => {
                setTotpRequired(false);
                setTotpCode("");
                setTotpError(null);
              }}
              className="font-medium text-interactive-primary hover:underline"
            >
              {t("otpBackToLogin")}
            </button>
          </p>
        }
      >
        <p className="text-sm text-ink-light">{t("totpDescription")}</p>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
          {t("totpCodeLabel")}
          <input
            type="text"
            inputMode="text"
            maxLength={11}
            required
            autoFocus
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            placeholder={t("totpCodePlaceholder")}
            className={inputClass}
          />
        </label>
      </AuthFormShell>
    );
  }

  if (challengeToken) {
    return (
      <AuthFormShell
        title={t("otpTitle")}
        onSubmit={handleVerifySubmit}
        submitting={verifying}
        submitLabel={t("otpSubmit")}
        submittingLabel={t("otpSubmitting")}
        error={verifyError}
        footer={
          <p className="mt-4 text-sm text-ink-light">
            <button
              type="button"
              onClick={() => {
                setChallengeToken(null);
                setCode("");
                setVerifyError(null);
              }}
              className="font-medium text-interactive-primary hover:underline"
            >
              {t("otpBackToLogin")}
            </button>
          </p>
        }
      >
        <p className="text-sm text-ink-light">{t("otpDescription")}</p>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
          {t("otpCodeLabel")}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={inputClass}
          />
        </label>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      title={t("title")}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel={t("submit")}
      submittingLabel={t("submitting")}
      error={error}
      footer={
        <div className="mt-4 flex flex-col gap-3">
          {emailNotVerified && (
            <div className="rounded-md border border-border bg-surface-muted p-3">
              {resendSent ? (
                <p className="text-sm text-ink-light">{t("resendVerificationSent")}</p>
              ) : (
                <>
                  <p className="text-sm text-ink-light">{t("resendVerificationPrompt")}</p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendSubmitting}
                    className="mt-2 font-medium text-interactive-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendSubmitting ? t("resendVerificationSubmitting") : t("resendVerificationButton")}
                  </button>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-ink-light">
            <span className="h-px flex-1 bg-border" />
            {t("passkeyDivider")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={passkeySubmitting}
            className="w-full rounded-md border border-border px-4 py-2 font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {passkeySubmitting ? t("passkeySubmitting") : t("passkeyLoginButton")}
          </button>
          {passkeyError && <p className="text-sm text-ended">{passkeyError}</p>}
          <p className="text-sm text-ink-light">
            {t("noAccount")}{" "}
            <Link href="/register" className="font-medium text-interactive-primary hover:underline">
              {t("registerLink")}
            </Link>
          </p>
        </div>
      }
    >
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            {t("email")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            {t("password")}
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <Link href="/forgot-password" className="text-sm text-interactive-primary hover:underline">
            {t("forgotPasswordLink")}
          </Link>
    </AuthFormShell>
  );
}
