"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ENDS_AT_MAX_DAYS } from "@/lib/listingValidation";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none disabled:opacity-50";

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditScheduleModal({ listingId, startsAt }: { listingId: number; startsAt: Date }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => toDatetimeLocalValue(startsAt));
  const [openImmediately, setOpenImmediately] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/listings/${listingId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: openImmediately ? null : value }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "更新失敗");
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
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
      >
        調整起標時間
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold">調整起標時間</h2>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                新起標時間（最遠 {ENDS_AT_MAX_DAYS} 天後）
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  type="datetime-local"
                  required={!openImmediately}
                  disabled={openImmediately}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
                <input type="checkbox" checked={openImmediately} onChange={(e) => setOpenImmediately(e.target.checked)} />
                取消起標時間限制，立即開放競標
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
                  {submitting ? "儲存中..." : "儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
