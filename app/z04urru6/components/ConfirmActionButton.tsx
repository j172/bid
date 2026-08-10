"use client";

import { useConfirmedAction, type ConfirmedActionOptions } from "./useConfirmedAction";

// Tailwind 需要看得到完整 class 字串，不能用樣板字串拼 items-${align}。
const ALIGN_CLASS: Record<"start" | "end", string> = {
  start: "flex flex-col items-start gap-1",
  end: "flex flex-col items-end gap-1",
};

/**
 * 後台單一動作按鈕（下架／刪除／停權／取消標記…）的共用外觀：
 * 按鈕本身 + 底下的錯誤（與選用的成功）訊息。行為全部來自
 * useConfirmedAction，呼叫端只提供文案、樣式與 API 位置。
 */
export default function ConfirmActionButton({
  label,
  pendingLabel = "處理中...",
  buttonClassName,
  align = "start",
  ...action
}: ConfirmedActionOptions & {
  label: string;
  pendingLabel?: string;
  buttonClassName: string;
  align?: "start" | "end";
}) {
  const { submitting, error, success, run } = useConfirmedAction(action);

  return (
    <div className={ALIGN_CLASS[align]}>
      <button type="button" onClick={run} disabled={submitting} className={buttonClassName}>
        {submitting ? pendingLabel : label}
      </button>
      {error && <span className="text-xs text-ended">{error}</span>}
      {success && <span className="text-xs text-leading">{success}</span>}
    </div>
  );
}
