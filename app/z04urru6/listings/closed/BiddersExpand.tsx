"use client";

import { useLazyExpand } from "../../components/useLazyExpand";

interface Bidder {
  email: string;
  amount: number;
  bidAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", { hour12: false });
}

export default function BiddersExpand({ listingId, bidCount }: { listingId: number; bidCount: number }) {
  const {
    open,
    loading,
    data: bidders,
    error,
    toggle,
  } = useLazyExpand<Bidder[]>(`/api/admin/listings/${listingId}/bidders`, (payload) => payload.bidders as Bidder[]);

  if (bidCount === 0) {
    return <span className="text-xs text-ink-light">0</span>;
  }

  return (
    <div>
      <button type="button" onClick={toggle} className="text-xs font-medium text-interactive-primary hover:underline">
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
