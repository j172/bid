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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-ink-light">
        {t("label", { minimum: minimumNextBid })}
        <input
          type="number"
          min={minimumNextBid}
          step={1}
          value={maxAmount}
          onChange={(e) => setMaxAmount(Number(e.target.value))}
          required
          className="w-full rounded-xl border border-border px-4 py-3 text-base focus:border-interactive-primary focus:outline-none"
        />
        {/* Bid amount is always NTD — the multi-currency display elsewhere on
            this page (issue #45) is reference-only, never an input option. */}
        <span className="text-xs font-normal text-ink-light">{t("ntdHint")}</span>
      </label>
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={submitting} className="w-full rounded-xl py-3 text-base font-bold">
          {submitting ? t("submitting") : t("submit")}
        </Button>
        {error && <span className="rounded-lg bg-ended-bg px-3 py-2 text-sm text-ended">{error}</span>}
        {notice && <span className="rounded-lg bg-interactive-primary-subtle px-3 py-2 text-sm text-interactive-primary">{notice}</span>}
      </div>
    </form>
  );
}
