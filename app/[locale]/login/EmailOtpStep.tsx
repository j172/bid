"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";
import AuthFormShell from "../components/AuthFormShell";

interface EmailOtpStepProps {
  /** Issued by the login response instead of a session — see app/api/auth/login/route.ts. */
  challengeToken: string;
  /** Returns to the password form, discarding this challenge. */
  onBack: () => void;
  /**
   * The challenge is permanently spent after too many wrong codes: the only
   * way forward is a fresh login attempt (which issues a brand-new code), so
   * the parent drops back to the password form and shows this message there.
   */
  onChallengeSpent: (message: string) => void;
}

// Email OTP second step of the login flow (issue #93) — the branch taken
// when the login response carries twoFactorRequired without
// twoFactorMethod === "totp". Split out of app/[locale]/login/page.tsx for
// issue #139 item 4.
export default function EmailOtpStep({ challengeToken, onBack, onChallengeSpent }: EmailOtpStepProps) {
  const router = useRouter();
  const t = useTranslations("login");
  const tErrors = useTranslations("errors");
  const [code, setCode] = useState("");
  const { post, submitting, error, setError } = usePostJson(t("defaultError"));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const data = await post(
      "/api/auth/verify-email-otp",
      { token: challengeToken, code },
      {
        onFailure: (failure) => {
          if (failure.errorCode === "EMAIL_OTP_TOO_MANY_ATTEMPTS") {
            onChallengeSpent(tErrors("EMAIL_OTP_TOO_MANY_ATTEMPTS"));
          }
        },
      },
    );
    if (!data) return;

    router.push("/");
    router.refresh();
  }

  return (
    <AuthFormShell
      title={t("otpTitle")}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel={t("otpSubmit")}
      submittingLabel={t("otpSubmitting")}
      error={error}
      footer={
        <p className="mt-4 text-sm text-ink-light">
          <button
            type="button"
            onClick={() => {
              setCode("");
              setError(null);
              onBack();
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
