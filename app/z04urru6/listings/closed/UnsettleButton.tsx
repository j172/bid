"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UnsettleButton({ listingId }: { listingId: number }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleUnsettle() {
    if (!confirm("確定要取消這筆交易的「已完成交易」標記嗎？")) return;
    setSubmitting(true);
    await fetch(`/api/admin/listings/${listingId}/unsettle`, { method: "POST" });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleUnsettle}
      disabled={submitting}
      className="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting ? "處理中..." : "取消標記"}
    </button>
  );
}
