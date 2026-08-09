"use client";

import { useLazyExpand } from "../../components/useLazyExpand";

interface Profile {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

export default function SettlementExpand({
  account,
  amount,
  profileUrl,
}: {
  account: string | null;
  amount: number | null;
  /** Full path to the winner/buyer profile API, e.g. `/api/admin/listings/${id}/winner` or `/api/admin/orders/${id}/buyer`. */
  profileUrl: string;
}) {
  const {
    open,
    loading,
    data: profile,
    error,
    toggle,
  } = useLazyExpand<Profile>(profileUrl, (payload) => (payload.winner ?? payload.buyer) as Profile);

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="text-sm font-medium text-leading hover:underline"
      >
        已完成交易 {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-md border border-border bg-surface-muted p-2 text-xs">
          {account !== null && amount !== null && (
            <>
              <div>匯款帳號：{account}</div>
              <div>金額：{amount}</div>
            </>
          )}
          {loading && <p className="text-ink-light">載入中...</p>}
          {error && <p className="text-ended">{error}</p>}
          {profile && (
            <>
              <div>顯示名稱：{profile.displayName ?? "（帳號已刪除）"}</div>
              <div>電話：{profile.phone ?? "—"}</div>
              <div>地址：{profile.address ?? "—"}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
