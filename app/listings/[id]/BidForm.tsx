"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BidForm({ listingId, minimumNextBid }: { listingId: number; minimumNextBid: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(minimumNextBid);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/listings/${listingId}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "出價失敗");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <label>
        出價金額（至少 {minimumNextBid}）
        <input
          type="number"
          min={minimumNextBid}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          required
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "送出中..." : "出價"}
      </button>
      {error && <span style={{ color: "red" }}>{error}</span>}
    </form>
  );
}
