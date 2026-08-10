"use client";

import ConfirmActionButton from "../components/ConfirmActionButton";

export default function CancelButton({ listingId }: { listingId: number }) {
  return (
    <ConfirmActionButton
      confirmMessage="確定要下架這個商品嗎？此動作無法撤銷。"
      endpoint={`/api/admin/listings/${listingId}/cancel`}
      method="POST"
      errorFallback="下架失敗"
      label="下架"
      align="end"
      buttonClassName="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
