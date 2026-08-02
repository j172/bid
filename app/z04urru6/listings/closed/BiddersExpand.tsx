"use client";

import { useState } from "react";

interface Bidder {
  email: string;
  amount: number;
  bidAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", { hour12: false });
}

export default function BiddersExpand({ listingId, bidCount }: { listingId: number; bidCount: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bidders, setBidders] = useState<Bidder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (bidders !== null) return;

    setLoading(true);
    setError(null);
    const response = await fetch(`/api/admin/listings/${listingId}/bidders`);
    const data = await response.json();
    setLoading(false);
    if (!data.ok) {
      setError(data.error ?? "讀取失敗");
      return;
    }
    setBidders(data.bidders);
  }

  if (bidCount === 0) {
    return <span className="text-xs text-ink-light">0</span>;
  }

  return (
    <div>
      <button type="button" onClick={handleToggle} className="text-xs font-medium text-interactive-primary hover:underline">
        {bidCount} {open ? "▲ 收合" : "▼ 展開"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-md border border-border bg-surface-muted p-2 text-xs">
          {loading && <p className="text-ink-light">載入中...</p>}
          {error && <p className="text-ended">{error}</p>}
          {bidders?.map((bidder, index) => (
            <div key={index} className="flex justify-between gap-3">
              <span>{bidder.email}</span>
              <span className="font-medium">{bidder.amount}</span>
              <span className="text-ink-light">{formatDate(bidder.bidAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
