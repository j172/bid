"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "../../components/Button";

export default function PurchaseForm({ listingId, stockRemaining }: { listingId: number; stockRemaining: number }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!confirm(`確定要購買 ${quantity} 件嗎？`)) return;

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
      setError(data.error ?? "購買失敗");
      return;
    }
    router.refresh();
  }

  if (stockRemaining === 0) {
    return <p className="text-sm text-ink-light">已售罄</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        購買數量（剩餘 {stockRemaining} 件）
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
          {submitting ? "處理中..." : "購買"}
        </Button>
        {error && <span className="text-sm text-ended">{error}</span>}
      </div>
    </form>
  );
}
