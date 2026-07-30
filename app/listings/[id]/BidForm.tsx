"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BidForm({ listingId, minimumNextBid }: { listingId: number; minimumNextBid: number }) {
  const router = useRouter();
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
      setError(data.error ?? "出價失敗");
      return;
    }
    if (data.closedViaBuyItNow) {
      setNotice(data.youAreLeading ? "你的出價達到買斷價，直接得標！" : "出價已達買斷價，商品已由他人得標。");
    } else {
      setNotice(data.youAreLeading ? "你目前是最高出價者！" : "已送出，但目前有人出價更高，你並未領先。");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label>
        你願意出的最高價（至少 {minimumNextBid}，系統只會自動幫你加價到剛好贏過對手，不會直接扣到這個金額）
        <input
          type="number"
          min={minimumNextBid}
          step={1}
          value={maxAmount}
          onChange={(e) => setMaxAmount(Number(e.target.value))}
          required
        />
      </label>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button type="submit" disabled={submitting}>
          {submitting ? "送出中..." : "出價"}
        </button>
        {error && <span style={{ color: "red" }}>{error}</span>}
        {notice && <span>{notice}</span>}
      </div>
    </form>
  );
}
