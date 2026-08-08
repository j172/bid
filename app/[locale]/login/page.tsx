"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import AuthFormShell from "../components/AuthFormShell";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("login");
  const tErrors = useTranslations("errors");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    if (data.twoFactorRequired) {
      setChallengeToken(data.challengeToken);
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
        <p className="mt-4 text-sm text-ink-light">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-interactive-primary hover:underline">
            {t("registerLink")}
          </Link>
        </p>
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
