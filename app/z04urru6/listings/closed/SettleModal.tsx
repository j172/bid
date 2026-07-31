"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettleModal({
  listingId,
  finalPrice,
  previousAccount,
  previousAmount,
}: {
  listingId: number;
  finalPrice: number;
  previousAccount: string | null;
  previousAmount: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(previousAccount ?? "");
  const [amount, setAmount] = useState(String(previousAmount ?? finalPrice));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/listings/${listingId}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, amount: Number(amount) }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "標記失敗");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-leading px-3 py-1.5 text-sm font-medium text-leading hover:bg-leading-bg"
      >
        標記已完成交易
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold">標記已完成交易</h2>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                匯款帳號
                <input
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  required
                  minLength={4}
                  maxLength={30}
                  pattern="[A-Za-z0-9-]+"
                  className="rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                金額
                <input
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  min={1}
                  step={1}
                  className="rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none"
                />
              </label>
              {error && <p className="text-sm text-ended">{error}</p>}
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-header px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "處理中..." : "確認標記"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
