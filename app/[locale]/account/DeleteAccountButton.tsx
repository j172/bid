"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

export default function DeleteAccountButton() {
  const router = useRouter();
  const t = useTranslations("deleteAccountButton");
  const tErrors = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    if (!confirm(t("confirm"))) {
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/account/delete", { method: "POST" });
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
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={submitting}
        className="rounded-md border border-ended px-4 py-2 font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("button")}
      </button>
      {error && <span className="text-sm text-ended">{error}</span>}
    </div>
  );
}
