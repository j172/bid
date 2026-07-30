"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BuyNowButton({ listingId, buyItNowPrice }: { listingId: number; buyItNowPrice: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleBuyNow() {
    if (!confirm(`確定要以買斷價 ${buyItNowPrice} 直接得標嗎？此動作無法撤銷。`)) {
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/listings/${listingId}/buy-now`, { method: "POST" });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "買斷失敗");
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
        {submitting ? "處理中..." : `一鍵買斷（${buyItNowPrice}）`}
      </button>
      {error && <span className="text-sm text-ended">{error}</span>}
    </div>
  );
}
