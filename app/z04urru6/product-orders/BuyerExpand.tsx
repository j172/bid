"use client";

import { useLazyExpand } from "../components/useLazyExpand";

interface Buyer {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

// products' own order-management page's "展開查看買家聯絡資訊" — byte-for-byte
// the same UI as app/z04urru6/orders/BuyerExpand.tsx, just pointed at the
// product-orders buyer endpoint. Kept as an independent copy rather than a
// shared component since that page/table is listings-only and out of scope
// for this ticket to touch.
export default function BuyerExpand({ orderId, email }: { orderId: number; email: string }) {
  const {
    open,
    loading,
    data: buyer,
    error,
    toggle,
  } = useLazyExpand<Buyer>(`/api/admin/product-orders/${orderId}/buyer`, (payload) => payload.buyer as Buyer);

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
