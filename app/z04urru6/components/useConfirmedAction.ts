"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 後台 API 一律回傳 `{ ok, error? }`，其餘欄位視路由而定。 */
export interface ActionResponse {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface ConfirmedActionOptions {
  /** window.confirm 的訊息；使用者按取消就完全不送出請求。 */
  confirmMessage: string;
  endpoint: string;
  method: "POST" | "DELETE";
  /** 有值時以 JSON 送出（自動帶上 Content-Type）。 */
  body?: unknown;
  /** 後端沒回 error 字串時顯示的訊息。 */
  errorFallback: string;
  /** 成功後是否 router.refresh()，預設 true。 */
  refreshOnSuccess?: boolean;
  /** 成功後要顯示的訊息（例如「已寄出重設密碼信至 …」）。 */
  successMessage?: (data: ActionResponse) => string;
}

/**
 * 後台「確認 → 呼叫 API → 顯示錯誤／成功 → refresh」單一動作按鈕的共用邏輯。
 *
 * 這個流程原本在 9 個按鈕元件裡各抄一份（issue #139 H4），其中兩個
 * Unsettle 按鈕還漏掉了 `data.ok` 檢查而會靜默失敗（H1）。集中在這裡之後，
 * 錯誤處理與 loading 狀態對所有按鈕都一致。
 */
export function useConfirmedAction({
  confirmMessage,
  endpoint,
  method,
  body,
  errorFallback,
  refreshOnSuccess = true,
  successMessage,
}: ConfirmedActionOptions) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function run() {
    if (!confirm(confirmMessage)) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(
      endpoint,
      body === undefined
        ? { method }
        : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    const data: ActionResponse = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? errorFallback);
      return;
    }
    if (successMessage) setSuccess(successMessage(data));
    if (refreshOnSuccess) router.refresh();
  }

  return { submitting, error, success, run };
}
