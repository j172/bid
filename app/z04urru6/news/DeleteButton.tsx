"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Same confirmation-modal pattern as
// app/z04urru6/pigeon-showcase/DeleteButton.tsx — issue #56 explicitly asks
// for a confirmation modal here rather than a plain window.confirm().
export default function DeleteButton({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">確定要刪除嗎？</h2>
            <p className="mt-2 text-sm text-ink-light">
              確定要刪除「{title}」這則訊息嗎？此動作無法撤銷。
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
          </div>
        </div>
      )}
    </>
  );
}
