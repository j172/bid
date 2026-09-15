"use client";

import ConfirmActionButton from "../components/ConfirmActionButton";

// Mirrors ../homepage/featured-lofts/DeleteButton.tsx — same native
// window.confirm choice.
export default function DeleteButton({ id, title }: { id: number; title: string }) {
  return (
    <ConfirmActionButton
      confirmMessage={`確定要刪除「${title}」這個商品嗎？此動作無法撤銷。`}
      endpoint={`/api/admin/products/${id}`}
      method="DELETE"
      errorFallback="刪除失敗"
      label="刪除"
      align="end"
      buttonClassName="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
