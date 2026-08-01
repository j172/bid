"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import Button from "@/app/components/Button";

export default function PurchaseForm({ listingId, stockRemaining }: { listingId: number; stockRemaining: number }) {
  const router = useRouter();
  const t = useTranslations("purchaseForm");
  const tErrors = useTranslations("errors");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!confirm(t("confirm", { count: quantity }))) return;

    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/listings/${listingId}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    router.refresh();
  }

  if (stockRemaining === 0) {
    return <p className="text-sm text-ink-light">{t("soldOut")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("quantityLabel", { count: stockRemaining })}
        <input
          type="number"
          min={1}
          max={stockRemaining}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
          className="w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("submitting") : t("submit")}
        </Button>
        {error && <span className="text-sm text-ended">{error}</span>}
      </div>
    </form>
  );
}
