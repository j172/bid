"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";
import AuthFormShell from "../components/AuthFormShell";
import PasswordStrengthMeter from "@/app/components/PasswordStrengthMeter";

export default function RegisterPage() {
  const locale = useLocale();
  const t = useTranslations("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  // Issue #118 (strict mode): registration no longer auto-logs-in, so a
  // successful submit has nothing to navigate to — instead this switches to
  // an inline "check your email" state, same single-state-flag step switch
  // as app/[locale]/forgot-password/page.tsx's `submitted`.
  const [registered, setRegistered] = useState(false);
  const { post, submitting, error } = usePostJson(t("defaultError"));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const data = await post("/api/auth/register", { email, password, displayName, phone, address, locale });
    if (!data) return;

    setRegistered(true);
  }

  if (registered) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-bold">{t("checkEmailTitle")}</h1>
          <p className="mt-4 text-sm text-ink-light">{t("checkEmailMessage")}</p>
          <p className="mt-4 text-sm text-ink-light">
            <Link href="/login" className="font-medium text-interactive-primary hover:underline">
              {t("loginLink")}
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
      footer={
        <p className="mt-4 text-sm text-ink-light">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-interactive-primary hover:underline">
            {t("loginLink")}
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <PasswordStrengthMeter password={password} />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            {t("displayName")}
            <input
              type="text"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              placeholder={t("displayNameOptionalHint")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            {t("phone")}
            <input
              type="tel"
              required
              maxLength={20}
              pattern="[0-9\- ]{7,20}"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            {t("address")}
            <input
              type="text"
              required
              maxLength={200}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
            />
          </label>
    </AuthFormShell>
  );
}
