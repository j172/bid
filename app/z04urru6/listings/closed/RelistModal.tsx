"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ENDS_AT_MAX_DAYS, PRICE_MAX } from "@/lib/listingValidation";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none";

function defaultEndsAt(): string {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function RelistModal({ listingId }: { listingId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [startingPrice, setStartingPrice] = useState("");
  const [buyItNowPrice, setBuyItNowPrice] = useState("");
  const [endsAt, setEndsAt] = useState(defaultEndsAt);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (loaded) return;

    setLoading(true);
    setLoadError(null);
    const response = await fetch(`/api/admin/listings/${listingId}`);
    const data = await response.json();
    setLoading(false);
    if (!data.ok) {
      setLoadError(data.error ?? "讀取失敗");
      return;
    }
    setStartingPrice(String(data.listing.startingPrice));
    setBuyItNowPrice(data.listing.buyItNowPrice === null ? "" : String(data.listing.buyItNowPrice));
    setLoaded(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/listings/${listingId}/relist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startingPrice: Number(startingPrice),
        buyItNowPrice: buyItNowPrice === "" ? null : Number(buyItNowPrice),
        endsAt,
      }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "重新上架失敗");
      return;
    }
    setOpen(false);
    router.push(`/listings/${data.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-md border border-gold px-3 py-1.5 text-sm font-medium text-gold hover:bg-gold-light"
      >
        重新上架
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold">重新上架</h2>
            <p className="mt-1 text-xs text-ink-light">標題、描述、照片會自動沿用原商品，建立一個全新的拍賣商品。</p>

            {loading && <p className="mt-4 text-sm text-ink-light">載入中...</p>}
            {loadError && <p className="mt-4 text-sm text-ended">{loadError}</p>}

            {loaded && (
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  起標價
                  <input
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    type="number"
                    min={1}
                    max={PRICE_MAX}
                    step={1}
                    required
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  買斷價（選填）
                  <input
                    value={buyItNowPrice}
                    onChange={(e) => setBuyItNowPrice(e.target.value)}
                    type="number"
                    min={1}
                    max={PRICE_MAX}
                    step={1}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  新結標時間（最遠 {ENDS_AT_MAX_DAYS} 天後）
                  <input
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    type="datetime-local"
                    required
                    className={inputClass}
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
                    {submitting ? "處理中..." : "確認重新上架"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
