"use client";

import { useState } from "react";

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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (profile !== null) return;

    setLoading(true);
    setError(null);
    const response = await fetch(profileUrl);
    const data = await response.json();
    setLoading(false);
    if (!data.ok) {
      setError(data.error ?? "讀取失敗");
      return;
    }
    setProfile(data.winner ?? data.buyer);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
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
