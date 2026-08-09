"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import Button from "@/app/components/Button";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";
import AuthFormShell from "../components/AuthFormShell";

interface TotpStepProps {
  /** The credentials the password step already collected — POST /api/auth/verify-totp re-verifies them itself. */
  email: string;
  password: string;
  /** Returns to the password form, discarding whatever was typed here. */
  onBack: () => void;
}

interface VerifyTotpResponse {
  ok?: boolean;
  errorCode?: string;
  usedBackupCode?: boolean;
  remainingBackupCodes?: number;
}

// TOTP ("App 驗證碼") second step of the login flow (issue #97) — the branch
// taken when the login response's twoFactorMethod is "totp". Split out of
// app/[locale]/login/page.tsx for issue #139 item 4; there is no
// challengeToken here (see app/api/auth/login/route.ts's totp branch), which
// is why the email/password are handed down as props and resubmitted.
//
// The code field accepts either a 6-digit app code or a backup code — the
// backend tells them apart by format. A successful backup-code verify
// doesn't navigate away immediately; it shows how many backup codes remain
// first, since that's the only time the visitor finds out, then a second
// click continues on.
export default function TotpStep({ email, password, onBack }: TotpStepProps) {
  const router = useRouter();
  const t = useTranslations("login");
  const [code, setCode] = useState("");
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const { post, submitting, error, setError } = usePostJson(t("defaultError"));

  function goHome() {
    router.push("/");
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const data = await post<VerifyTotpResponse>("/api/auth/verify-totp", { email, password, code });
    if (!data) return;

    if (data.usedBackupCode) {
      setBackupNotice(t("totpBackupCodeUsedNotice", { count: data.remainingBackupCodes ?? 0 }));
      return;
    }
    goHome();
  }

  if (backupNotice) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-bold">{t("totpTitle")}</h1>
          <p className="mt-6 text-sm text-ink-light">{backupNotice}</p>
          <Button type="button" onClick={goHome} className="mt-6 w-full">
            {t("totpContinue")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <AuthFormShell
      title={t("totpTitle")}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel={t("totpSubmit")}
      submittingLabel={t("totpSubmitting")}
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
      <p className="text-sm text-ink-light">{t("totpDescription")}</p>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("totpCodeLabel")}
        <input
          type="text"
          inputMode="text"
          maxLength={11}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("totpCodePlaceholder")}
          className={inputClass}
        />
      </label>
    </AuthFormShell>
  );
}
