"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";

// Unlike app/[locale]/reset-password/ResetPasswordForm.tsx (which collects a
// new password before submitting), there's no input to collect here — the
// token alone is the whole request, so the verify call fires automatically
// once on mount instead of waiting on a form submit. State is a small status
// enum rather than ResetPasswordForm's separate succeeded/error booleans,
// since here there's a fourth state (in-flight) that also needs its own
// render.
type Status = "verifying" | "success" | "error" | "missingToken";

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const t = useTranslations("verifyEmail");
  const tErrors = useTranslations("errors");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "missingToken");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  // StrictMode/effect-dependency churn must not fire this twice against the
  // same one-time-use token — a second call would just get back
  // EMAIL_VERIFICATION_TOKEN_INVALID and show a spurious failure after the
  // first call already succeeded.
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;

    void (async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!data.ok) {
        setErrorCode(data.errorCode ?? null);
        setStatus("error");
        return;
      }
      setStatus("success");
    })();
  }, [token]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-bold">{t("title")}</h1>

        {status === "verifying" && <p className="mt-4 text-sm text-ink-light">{t("verifying")}</p>}

        {status === "missingToken" && <p className="mt-4 text-sm text-ended">{t("missingToken")}</p>}

        {status === "error" && (
          <p className="mt-4 text-sm text-ended">{errorCode ? tErrors(errorCode) : t("defaultError")}</p>
        )}

        {status === "success" && <p className="mt-4 text-sm text-ink-light">{t("successMessage")}</p>}

        <p className="mt-4 text-sm text-ink-light">
          <Link href="/login" className="font-medium text-interactive-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}
