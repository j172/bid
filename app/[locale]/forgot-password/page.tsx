"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { inputClass } from "@/lib/formStyles";
import AuthFormShell from "../components/AuthFormShell";

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const t = useTranslations("forgotPassword");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The forgot-password API always responds { ok: true } regardless of
  // whether the email exists — see app/api/auth/forgot-password/route.ts's
  // anti-enumeration header comment — so this page has nothing to branch on
  // besides "was the request sent" vs "not yet submitted".
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });

    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-sm text-ink-light">{t("successMessage")}</p>
          <p className="mt-4 text-sm text-ink-light">
            <Link href="/login" className="font-medium text-interactive-primary hover:underline">
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
      footer={
        <p className="mt-4 text-sm text-ink-light">
          <Link href="/login" className="font-medium text-interactive-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      }
    >
      <p className="text-sm text-ink-light">{t("description")}</p>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("email")}
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </label>
    </AuthFormShell>
  );
}
