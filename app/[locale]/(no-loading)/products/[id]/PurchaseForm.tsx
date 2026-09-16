"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import Button from "@/app/components/Button";
import { usePostJson } from "@/lib/usePostJson";

// products' own purchase form (issue #298) — byte-for-byte the same shape as
// app/[locale]/listings/(no-loading)/[id]/PurchaseForm.tsx, just pointed at
// /api/products/[id]/purchase. Only ever rendered when the product has a
// non-null price and stockRemaining > 0 — see the caller in
// app/[locale]/(no-loading)/products/[id]/page.tsx.
export default function PurchaseForm({ productId, stockRemaining }: { productId: number; stockRemaining: number }) {
  const router = useRouter();
  const t = useTranslations("productPurchaseForm");
  const [quantity, setQuantity] = useState(1);
  const { post, submitting, error } = usePostJson(t("defaultError"));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!confirm(t("confirm", { count: quantity }))) return;

    const data = await post(`/api/products/${productId}/purchase`, { quantity });
    if (!data) return;

    router.refresh();
  }

  if (stockRemaining === 0) {
    return <p className="text-sm text-ink-light">{t("soldOut")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-ink-light">
        {t("quantityLabel", { count: stockRemaining })}
        <input
          type="number"
          min={1}
          max={stockRemaining}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
          className="w-full rounded-xl border border-border px-4 py-3 text-base focus:border-interactive-primary focus:outline-none"
        />
      </label>
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={submitting} className="w-full rounded-xl py-3 text-base font-bold">
          {submitting ? t("submitting") : t("submit")}
        </Button>
        {error && <span className="rounded-lg bg-ended-bg px-3 py-2 text-sm text-ended">{error}</span>}
      </div>
    </form>
  );
}
