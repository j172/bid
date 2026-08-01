"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

export default function BuyNowButton({ listingId, buyItNowPrice }: { listingId: number; buyItNowPrice: number }) {
  const router = useRouter();
  const t = useTranslations("buyNowButton");
  const tErrors = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleBuyNow() {
    if (!confirm(t("confirm", { price: buyItNowPrice }))) {
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/listings/${listingId}/buy-now`, { method: "POST" });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleBuyNow}
        disabled={submitting}
        className="rounded-md border-2 border-header px-4 py-2 font-medium text-header transition hover:bg-header hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("button", { price: buyItNowPrice })}
      </button>
      {error && <span className="text-sm text-ended">{error}</span>}
    </div>
  );
}
