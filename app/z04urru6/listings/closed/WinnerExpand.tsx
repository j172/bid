"use client";

import { useState } from "react";

interface Winner {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

export default function WinnerExpand({ listingId, email }: { listingId: number; email: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (winner !== null) return;

    setLoading(true);
    setError(null);
    const response = await fetch(`/api/admin/listings/${listingId}/winner`);
    const data = await response.json();
    setLoading(false);
    if (!data.ok) {
      setError(data.error ?? "讀取失敗");
      return;
    }
    setWinner(data.winner);
  }

  return (
    <div>
      <button type="button" onClick={handleToggle} className="text-xs font-medium text-interactive-primary hover:underline">
        {email} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-md border border-border bg-surface-muted p-2 text-xs">
          {loading && <p className="text-ink-light">載入中...</p>}
          {error && <p className="text-ended">{error}</p>}
          {winner && (
            <>
              <div>顯示名稱：{winner.displayName ?? "（帳號已刪除）"}</div>
              <div>電話：{winner.phone ?? "—"}</div>
              <div>地址：{winner.address ?? "—"}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
