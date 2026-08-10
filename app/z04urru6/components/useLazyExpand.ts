"use client";

import { useState } from "react";

/**
 * 「展開時才去抓明細、抓過就不再重抓」的共用邏輯（issue #139 M5）——
 * 出價者、得標者、買家與結算明細四個展開元件原本各自抄一份。
 *
 * 快取判斷沿用原本的 `data !== null`：後端回傳 null（例如帳號已刪除）時
 * 下次展開仍會重抓，行為與抽出前一致。
 */
export function useLazyExpand<T>(fetchUrl: string, select: (payload: Record<string, unknown>) => T) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data !== null) return;

    setLoading(true);
    setError(null);
    const response = await fetch(fetchUrl);
    const payload: Record<string, unknown> = await response.json();
    setLoading(false);
    if (!payload.ok) {
      setError(typeof payload.error === "string" ? payload.error : "讀取失敗");
      return;
    }
    setData(select(payload));
  }

  return { open, loading, data, error, toggle };
}
