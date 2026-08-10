"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Moved here from app/z04urru6/newsletter/ (issue #80) — the standalone
// newsletter status list is gone, so this is now the news admin list's
// inline "取消" action for a row's 電子報狀態 column (draft/scheduled only,
// see page.tsx). Logic unchanged: still just DELETEs the Resend broadcast
// via the same /api/admin/newsletter/[id] route.
export default function CancelBroadcastButton({ broadcastId }: { broadcastId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel() {
    if (!confirm("確定要取消這封電子報嗎？")) return;
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/newsletter/${broadcastId}`, { method: "DELETE" });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "取消失敗");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleCancel}
        disabled={submitting}
        className="rounded-md border border-ended px-2 py-1 text-xs font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "處理中..." : "取消"}
      </button>
      {error && <span className="text-xs text-ended">{error}</span>}
    </div>
  );
}
