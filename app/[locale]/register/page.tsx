"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import AuthFormShell from "../components/AuthFormShell";
import PasswordStrengthMeter from "@/app/components/PasswordStrengthMeter";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

export default function RegisterPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("register");
  const tErrors = useTranslations("errors");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName, phone, address, locale }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    router.push("/");
    router.refresh();
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
