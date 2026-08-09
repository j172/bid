"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import Button from "@/app/components/Button";
import { usePostJson } from "@/lib/usePostJson";

interface BidResponse {
  ok?: boolean;
  errorCode?: string;
  /** Only present on a BID_TOO_LOW rejection — interpolated into that message. */
  minimumNextBid?: number;
  closedViaBuyItNow?: boolean;
  youAreLeading?: boolean;
}

export default function BidForm({ listingId, minimumNextBid }: { listingId: number; minimumNextBid: number }) {
  const router = useRouter();
  const t = useTranslations("bidForm");
  const [maxAmount, setMaxAmount] = useState(minimumNextBid);
  const [notice, setNotice] = useState<string | null>(null);
  const { post, submitting, error } = usePostJson(t("defaultError"));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);

    const data = await post<BidResponse>(
      `/api/listings/${listingId}/bids`,
      { maxAmount },
      { errorValues: (failure) => ({ minimum: failure.minimumNextBid ?? "" }) },
    );
    if (!data) return;

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
