"use client";

import { useLazyExpand } from "../components/useLazyExpand";

interface Buyer {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

export default function BuyerExpand({ orderId, email }: { orderId: number; email: string }) {
  const {
    open,
    loading,
    data: buyer,
    error,
    toggle,
  } = useLazyExpand<Buyer>(`/api/admin/orders/${orderId}/buyer`, (payload) => payload.buyer as Buyer);

  return (
    <div>
      <button type="button" onClick={toggle} className="text-xs font-medium text-interactive-primary hover:underline">
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
