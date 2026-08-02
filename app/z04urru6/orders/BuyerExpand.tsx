"use client";

import { useState } from "react";

interface Buyer {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

export default function BuyerExpand({ orderId, email }: { orderId: number; email: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (buyer !== null) return;

    setLoading(true);
    setError(null);
    const response = await fetch(`/api/admin/orders/${orderId}/buyer`);
    const data = await response.json();
    setLoading(false);
    if (!data.ok) {
      setError(data.error ?? "讀取失敗");
      return;
    }
    setBuyer(data.buyer);
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
          {buyer && (
            <>
              <div>顯示名稱：{buyer.displayName ?? "（帳號已刪除）"}</div>
              <div>電話：{buyer.phone ?? "—"}</div>
              <div>地址：{buyer.address ?? "—"}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
