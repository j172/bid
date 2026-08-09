"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";
import AuthFormShell from "../components/AuthFormShell";
import EmailOtpStep from "./EmailOtpStep";
import PasskeyLoginButton from "./PasskeyLoginButton";
import TotpStep from "./TotpStep";

interface LoginResponse {
  ok?: boolean;
  errorCode?: string;
  twoFactorRequired?: boolean;
  twoFactorMethod?: string;
  challengeToken?: string;
}

// The password half of the login flow, plus the routing between the second
// steps it can hand off to. Issue #139 item 4 moved each of those steps into
// its own component (TotpStep / EmailOtpStep / PasskeyLoginButton), so this
// file now only owns what the password form itself needs: the credentials,
// the "verify your email first" branch, and which step is currently showing.
export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { post, submitting, error, setError } = usePostJson(t("defaultError"));

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

  // Which second step (if any) the login response asked for. Both are
  // entered in place, without navigating — see the two step components.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpRequired, setTotpRequired] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setEmailNotVerified(false);
    setResendSent(false);

    const data = await post<LoginResponse>(
      "/api/auth/login",
      { email, password },
      {
        onFailure: (failure) => {
          if (failure.errorCode === "EMAIL_NOT_VERIFIED") {
            setEmailNotVerified(true);
          }
        },
      },
    );
    if (!data) return;

    if (data.twoFactorRequired) {
      if (data.twoFactorMethod === "totp") {
        setTotpRequired(true);
      } else {
        setChallengeToken(data.challengeToken ?? null);
      }
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleResendVerification() {
    setResendSubmitting(true);
    setResendSent(false);

    // Deliberately not routed through usePostJson: this endpoint always
    // answers neutrally (see app/api/auth/resend-verification/route.ts), so
    // there is no ok/errorCode branch to take.
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });

    setResendSubmitting(false);
    setResendSent(true);
  }

  if (totpRequired) {
    return <TotpStep email={email} password={password} onBack={() => setTotpRequired(false)} />;
  }

  if (challengeToken) {
    return (
      <EmailOtpStep
        challengeToken={challengeToken}
        onBack={() => setChallengeToken(null)}
        onChallengeSpent={(message) => {
          setChallengeToken(null);
          setError(message);
        }}
      />
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
          <PasskeyLoginButton />
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
