"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import AuthFormShell from "../components/AuthFormShell";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const t = useTranslations("resetPassword");
  const tErrors = useTranslations("errors");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("mismatchError"));
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    setSucceeded(true);
  }

  if (succeeded) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-sm text-ink-light">{t("successMessage")}</p>
          <p className="mt-4 text-sm text-ink-light">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="font-medium text-interactive-primary hover:underline"
            >
              {t("backToLogin")}
            </button>
          </p>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-sm text-ended">{t("missingToken")}</p>
          <p className="mt-4 text-sm text-ink-light">
            <Link href="/forgot-password" className="font-medium text-interactive-primary hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      </main>
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
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("newPassword")}
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("confirmPassword")}
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </label>
    </AuthFormShell>
  );
}
