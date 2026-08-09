"use client";

import ConfirmActionButton from "../../components/ConfirmActionButton";

export default function UnsettleButton({ listingId }: { listingId: number }) {
  return (
    <ConfirmActionButton
      confirmMessage="確定要取消這筆交易的「已完成交易」標記嗎？"
      endpoint={`/api/admin/listings/${listingId}/unsettle`}
      method="POST"
      errorFallback="取消標記失敗"
      label="取消標記"
      buttonClassName="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
