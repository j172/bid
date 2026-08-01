"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import Button from "@/app/components/Button";

export default function BidForm({ listingId, minimumNextBid }: { listingId: number; minimumNextBid: number }) {
  const router = useRouter();
  const t = useTranslations("bidForm");
  const tErrors = useTranslations("errors");
  const [maxAmount, setMaxAmount] = useState(minimumNextBid);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/listings/${listingId}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxAmount }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(
        data.errorCode ? tErrors(data.errorCode, { minimum: data.minimumNextBid }) : t("defaultError"),
      );
      return;
    }
    if (data.closedViaBuyItNow) {
      setNotice(data.youAreLeading ? t("closedViaBinLeading") : t("closedViaBinNotLeading"));
    } else {
      setNotice(data.youAreLeading ? t("leading") : t("notLeading"));
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("label", { minimum: minimumNextBid })}
        <input
          type="number"
          min={minimumNextBid}
          step={1}
          value={maxAmount}
          onChange={(e) => setMaxAmount(Number(e.target.value))}
          required
          className="w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("submitting") : t("submit")}
        </Button>
        {error && <span className="text-sm text-ended">{error}</span>}
        {notice && <span className="text-sm text-ink-light">{notice}</span>}
      </div>
    </form>
  );
}
