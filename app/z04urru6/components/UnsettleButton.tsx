"use client";

import ConfirmActionButton from "./ConfirmActionButton";

/**
 * 「取消已完成交易標記」按鈕，已結標商品（listings/closed/page.tsx）與訂單
 * （orders/page.tsx）共用一份 —— 兩邊原本是各自的 UnsettleButton /
 * OrderUnsettleButton，只差 confirm 文案與 API 路徑（issue #139 H10）。
 */
export default function UnsettleButton({ apiPath, confirmMessage }: { apiPath: string; confirmMessage: string }) {
  return (
    <ConfirmActionButton
      confirmMessage={confirmMessage}
      endpoint={apiPath}
      method="POST"
      errorFallback="取消標記失敗"
      label="取消標記"
      buttonClassName="rounded-md border border-ended px-3 py-1.5 text-sm font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
