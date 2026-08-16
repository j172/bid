"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SECONDARY_TRIGGER_CLASS } from "../components/adminButtonClasses";
import AdminModal from "../components/AdminModal";
import ModalFormActions from "../components/ModalFormActions";
import { ENDS_AT_MAX_DAYS } from "@/lib/listingValidation";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none disabled:opacity-50";

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

  // 取消時回到目前伺服器上的起標時間，不留下沒送出的編輯（issue #139 M2）。
  function resetForm() {
    setValue(toDatetimeLocalValue(startsAt));
    setOpenImmediately(false);
    setError(null);
  }

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
        className={SECONDARY_TRIGGER_CLASS}
      >
        調整起標時間
      </button>

      {open && (
        <AdminModal title="調整起標時間">
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
            <ModalFormActions
              onCancel={() => {
                setOpen(false);
                resetForm();
              }}
              submitting={submitting}
              submitLabel="儲存"
              pendingLabel="儲存中..."
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
