"use client";

import { useState } from "react";

interface Winner {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("zh-TW", { hour12: false });
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local copy so a successful resend reflects immediately without a full
  // page reload — same fetch-then-setState pattern as the winner lookup
  // above, updated in place instead of re-fetching the whole page (issue #48).
  const [notifiedAt, setNotifiedAt] = useState<Date | null>(winnerNotifiedAt);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

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
          <div className="mt-1 flex flex-col gap-1 border-t border-border pt-1">
            {notifiedAt ? (
              <p className="text-leading">得標信已寄送 {formatDateTime(notifiedAt)}</p>
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
