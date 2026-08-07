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
