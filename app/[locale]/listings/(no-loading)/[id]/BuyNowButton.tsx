"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { usePostJson } from "@/lib/usePostJson";

export default function BuyNowButton({ listingId, buyItNowPrice }: { listingId: number; buyItNowPrice: number }) {
  const router = useRouter();
  const t = useTranslations("buyNowButton");
  const { post, submitting, error } = usePostJson(t("defaultError"));

  async function handleBuyNow() {
    if (!confirm(t("confirm", { price: buyItNowPrice }))) {
      return;
    }

    const data = await post(`/api/listings/${listingId}/buy-now`);
    if (!data) return;

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleBuyNow}
        disabled={submitting}
        className="w-full rounded-xl border-2 border-interactive-primary px-4 py-3 text-base font-bold text-interactive-primary transition hover:bg-interactive-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("button", { price: buyItNowPrice })}
      </button>
      {error && <span className="rounded-lg bg-ended-bg px-3 py-2 text-sm text-ended">{error}</span>}
    </div>
  );
}
