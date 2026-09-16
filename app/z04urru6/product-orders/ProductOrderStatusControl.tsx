"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductOrderStatus } from "@/lib/productOrders";

const STATUS_LABELS: Record<ProductOrderStatus, string> = {
  pending: "待處理",
  shipped: "已出貨",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款",
};

// Action button copy differs from the plain status label above (e.g.
// "標記已出貨" rather than just "已出貨") since these read as verbs on a
// button, not a state badge.
const ACTION_LABELS: Record<ProductOrderStatus, string> = {
  pending: "標記待處理",
  shipped: "標記已出貨",
  completed: "標記完成",
  cancelled: "取消訂單",
  refunded: "標記已退款",
};

const ACTION_BUTTON_CLASS =
  "rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";
const DANGER_BUTTON_CLASS =
  "rounded-md border border-ended px-2 py-1 text-xs font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50";

/**
 * products 訂單狀態變更控制項（issue #298）——availableStatuses 是
 * lib/productOrders.ts's getAvailableProductOrderStatuses 依目前狀態算出的
 * 合法轉換清單（server component 算好才傳進來，這個 client component 本身
 * 不重複那份規則，避免兩邊規則drift）。'shipped' 額外多一步輸入物流單號
 * （選填），其餘狀態點擊後直接送出（並用 window.confirm 二次確認，同其他
 * 後台危險操作的既有慣例）。
 */
export default function ProductOrderStatusControl({
  orderId,
  currentStatus,
  availableStatuses,
  trackingNumber,
}: {
  orderId: number;
  currentStatus: ProductOrderStatus;
  availableStatuses: ProductOrderStatus[];
  trackingNumber: string | null;
}) {
  const router = useRouter();
  const [enteringTracking, setEnteringTracking] = useState(false);
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(status: ProductOrderStatus, nextTrackingNumber?: string) {
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/admin/product-orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        nextTrackingNumber === undefined ? { status } : { status, trackingNumber: nextTrackingNumber },
      ),
    });
    const data = await response.json().catch(() => ({ ok: false, error: "更新失敗" }));
    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "更新失敗");
      return;
    }
    setEnteringTracking(false);
    router.refresh();
  }

  function handleClick(status: ProductOrderStatus) {
    if (status === "shipped") {
      setEnteringTracking(true);
      return;
    }
    if (!confirm(`確定要將這筆訂單標記為「${STATUS_LABELS[status]}」嗎？`)) return;
    void apply(status);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{STATUS_LABELS[currentStatus]}</span>
      {trackingNumber && <span className="text-xs text-ink-light">物流單號：{trackingNumber}</span>}

      {!enteringTracking && availableStatuses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {availableStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleClick(status)}
              disabled={submitting}
              className={status === "cancelled" || status === "refunded" ? DANGER_BUTTON_CLASS : ACTION_BUTTON_CLASS}
            >
              {ACTION_LABELS[status]}
            </button>
          ))}
        </div>
      )}

      {enteringTracking && (
        <div className="flex flex-col gap-1">
          <input
            value={tracking}
            onChange={(event) => setTracking(event.target.value)}
            placeholder="物流單號（選填）"
            maxLength={100}
            className="rounded-md border border-border px-2 py-1 text-xs focus:border-interactive-primary focus:outline-none"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => void apply("shipped", tracking.trim())}
              disabled={submitting}
              className={ACTION_BUTTON_CLASS}
            >
              {submitting ? "處理中..." : "確認出貨"}
            </button>
            <button
              type="button"
              onClick={() => setEnteringTracking(false)}
              disabled={submitting}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-ink-light hover:bg-surface-muted"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {error && <span className="text-xs text-ended">{error}</span>}
    </div>
  );
}
