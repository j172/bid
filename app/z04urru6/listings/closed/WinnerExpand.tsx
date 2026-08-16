"use client";

import { useState } from "react";
import { formatAdminDateTime } from "@/lib/format";
import { useLazyExpand } from "../../components/useLazyExpand";

interface Winner {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

export default function WinnerExpand({
  listingId,
  email,
  winnerNotifiedAt,
}: {
  listingId: number;
  email: string;
  /** Null: never sent, or the last attempt failed — see lib/listings.ts's ClosedListingSummary. */
  winnerNotifiedAt: Date | null;
}) {
  const {
    open,
    loading,
    data: winner,
    error,
    toggle,
  } = useLazyExpand<Winner>(`/api/admin/listings/${listingId}/winner`, (payload) => payload.winner as Winner);

  // Local copy so a successful resend reflects immediately without a full
  // page reload — same fetch-then-setState pattern as the winner lookup
  // above, updated in place instead of re-fetching the whole page (issue #48).
  const [notifiedAt, setNotifiedAt] = useState<Date | null>(winnerNotifiedAt);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend() {
    setResending(true);
    setResendError(null);
    const response = await fetch(`/api/admin/listings/${listingId}/notify-winner`, { method: "POST" });
    const data = await response.json();
    setResending(false);
    if (!data.ok) {
      setResendError(data.error ?? "寄送失敗");
      return;
    }
    setNotifiedAt(data.winnerNotifiedAt ? new Date(data.winnerNotifiedAt) : new Date());
  }

  return (
    <div>
      <button type="button" onClick={toggle} className="text-xs font-medium text-interactive-primary hover:underline">
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
          <div className="mt-1 flex flex-col gap-1 border-t border-border pt-1">
            {notifiedAt ? (
              <p className="text-leading">得標信已寄送 {formatAdminDateTime(notifiedAt)}</p>
            ) : (
              <p className="text-ink-light">尚未寄送成功</p>
            )}
            {resendError && <p className="text-ended">{resendError}</p>}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="self-start rounded-md border border-interactive-primary px-2 py-1 text-xs font-medium text-interactive-primary hover:bg-interactive-primary-subtle disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending ? "寄送中..." : "重新寄送得標信"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
