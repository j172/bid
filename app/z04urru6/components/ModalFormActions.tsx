"use client";

/**
 * 後台表單 modal 底部的「取消 / 送出」按鈕組。
 *
 * onCancel 一律同時負責關閉與重置表單（issue #139 M2）—— 取消後再次打開
 * 應該看到伺服器的真實資料，而不是上次沒送出的編輯內容。
 */
export default function ModalFormActions({
  onCancel,
  submitting,
  submitLabel,
  pendingLabel,
  submitDisabled = false,
}: {
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
  pendingLabel: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="mt-2 flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
      >
        取消
      </button>
      <button
        type="submit"
        disabled={submitting || submitDisabled}
        className="rounded-md bg-header px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
