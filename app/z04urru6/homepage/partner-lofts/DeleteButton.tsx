"use client";

import ConfirmActionButton from "../../components/ConfirmActionButton";

// 這裡刻意使用原生 window.confirm（而非 news／pigeon-showcase 的確認 modal），
// 是 issue #34 當初的要求 —— ConfirmActionButton 用的正是 window.confirm。
export default function DeleteButton({ id, title }: { id: number; title: string }) {
  return (
    <ConfirmActionButton
      confirmMessage={`確定要刪除「${title}」這筆合作鴿舍資料嗎？此動作無法撤銷。`}
      endpoint={`/api/admin/homepage-sections/${id}`}
      method="DELETE"
      errorFallback="刪除失敗"
      label="刪除"
      align="end"
      buttonClassName="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
