"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettleButton({ listingId }: { listingId: number }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSettle() {
    setSubmitting(true);
    await fetch(`/api/admin/listings/${listingId}/settle`, { method: "POST" });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSettle}
      disabled={submitting}
      className="rounded-md border border-leading px-3 py-1.5 text-sm font-medium text-leading hover:bg-leading-bg disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting ? "處理中..." : "標記已完成交易"}
    </button>
  );
}
