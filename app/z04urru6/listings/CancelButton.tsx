"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelButton({ listingId }: { listingId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel() {
    if (!confirm("確定要下架這個商品嗎？此動作無法撤銷。")) {
      return;
    }
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/listings/${listingId}/cancel`, { method: "POST" });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "下架失敗");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCancel}
        disabled={submitting}
        className="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "處理中..." : "下架"}
      </button>
      {error && <span className="text-xs text-ended">{error}</span>}
    </div>
  );
}
