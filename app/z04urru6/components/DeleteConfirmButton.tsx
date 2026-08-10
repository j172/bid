"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AdminModal from "./AdminModal";

/**
 * 「刪除 + 確認 modal」按鈕，最新訊息（issue #56）與入賞鴿／進口鴿（issue #54）
 * 共用 —— 兩者原本只差欄位名稱與文案（issue #139 M1）。
 *
 * 合作鴿舍（app/z04urru6/homepage/partner-lofts/DeleteButton.tsx）刻意維持
 * 原生 window.confirm，是 issue #34 當初的要求，不走這裡。
 */
export default function DeleteConfirmButton({
  endpoint,
  itemLabel,
  itemNoun,
}: {
  endpoint: string;
  /** 顯示在確認文案引號內的名稱。 */
  itemLabel: string;
  /** 這筆資料的量詞說法，例如「這則訊息」「這筆鴿況資料」。 */
  itemNoun: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(endpoint, { method: "DELETE" });
    const data = await response.json().catch(() => ({ ok: false, error: "刪除失敗" }));

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "刪除失敗");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg"
      >
        刪除
      </button>

      {open && (
        <AdminModal
          title="確定要刪除嗎？"
          onOverlayClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <p className="mt-2 text-sm text-ink-light">
            確定要刪除「{itemLabel}」{itemNoun}嗎？此動作無法撤銷。
          </p>
          {error && <p className="mt-3 text-sm text-ended">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={submitting}
              className="rounded-md bg-ended px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "刪除中..." : "確定刪除"}
            </button>
          </div>
        </AdminModal>
      )}
    </>
  );
}
